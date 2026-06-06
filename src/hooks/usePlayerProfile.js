import { useState, useEffect, useCallback, useRef } from 'react'
import { STARTING_ELO, MIN_ELO, MAX_ELO, calculateEloChange, calculatePuzzleEloChange, getZone } from 'src/lib/pente/elo'

/**
 * Unified player profile hook.
 * Supabase-first with localStorage as offline cache.
 *
 * Replaces usePlayerId + usePuzzleProgress.
 * On mount: reads localStorage for instant UI, then syncs from/to Supabase.
 * On updates: writes to both localStorage and Supabase.
 */

const LOCAL_KEY = 'pente_puzzle_progress'
const ID_KEY = 'pente_player_id'
const NAME_KEY = 'pente_player_name'

const defaultProfile = {
  id: null,
  name: '',
  elo: STARTING_ELO,
  peakElo: STARTING_ELO,
  puzzlesSolved: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastSolveDate: null,
  eloHistory: [],
  solvedPuzzles: [],
  attemptedPuzzles: {},
}

function profileFromLocal() {
  if (typeof window === 'undefined') return defaultProfile
  const id = localStorage.getItem(ID_KEY) || crypto.randomUUID()
  localStorage.setItem(ID_KEY, id)
  const name = localStorage.getItem(NAME_KEY) || ''

  const stored = localStorage.getItem(LOCAL_KEY)
  let progress = {}
  if (stored) {
    try { progress = JSON.parse(stored) } catch { /* corrupted */ }
  }

  return {
    id,
    name,
    elo: progress.elo ?? STARTING_ELO,
    peakElo: progress.peakElo ?? STARTING_ELO,
    puzzlesSolved: progress.solved?.length ?? 0,
    gamesPlayed: progress.gamesPlayed ?? 0,
    gamesWon: progress.gamesWon ?? 0,
    currentStreak: progress.currentStreak ?? 0,
    bestStreak: progress.bestStreak ?? 0,
    lastSolveDate: progress.lastSolveDate ?? null,
    eloHistory: progress.eloHistory ?? [],
    solvedPuzzles: progress.solved ?? [],
    attemptedPuzzles: progress.attempted ?? {},
  }
}

function profileToLocal(profile) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ID_KEY, profile.id)
  if (profile.name) localStorage.setItem(NAME_KEY, profile.name)
  // Mirror the legacy localStorage shape so the offline cache stays readable.
  const compat = {
    solved: profile.solvedPuzzles,
    attempted: profile.attemptedPuzzles,
    currentStreak: profile.currentStreak,
    bestStreak: profile.bestStreak,
    lastSolveDate: profile.lastSolveDate,
    elo: profile.elo,
    peakElo: profile.peakElo,
    eloHistory: profile.eloHistory,
    gamesPlayed: profile.gamesPlayed,
    gamesWon: profile.gamesWon,
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(compat))
}

function profileToSupabase(profile) {
  return {
    id: profile.id,
    name: profile.name,
    elo: profile.elo,
    peak_elo: profile.peakElo,
    puzzles_solved: profile.puzzlesSolved,
    games_played: profile.gamesPlayed,
    games_won: profile.gamesWon,
    current_streak: profile.currentStreak,
    best_streak: profile.bestStreak,
    last_solve_date: profile.lastSolveDate,
    elo_history: profile.eloHistory,
    solved_puzzles: profile.solvedPuzzles,
    attempted_puzzles: profile.attemptedPuzzles,
  }
}

function profileFromSupabase(row) {
  return {
    id: row.id,
    name: row.name || '',
    elo: row.elo,
    peakElo: row.peak_elo,
    puzzlesSolved: row.puzzles_solved,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    lastSolveDate: row.last_solve_date,
    eloHistory: row.elo_history || [],
    solvedPuzzles: row.solved_puzzles || [],
    attemptedPuzzles: row.attempted_puzzles || {},
  }
}

// Merge: union historical data (solved puzzles, peaks, totals), but take
// live state (current ELO + streak) from whichever side played most recently.
// This prevents an old device with a stale-but-higher ELO from ratcheting
// the rating upward on every sync.
function mergeProfiles(local, remote) {
  const merged = { ...remote }
  // Date-based winner for live state. Null dates lose to any real date.
  const localTs = local.lastSolveDate ? Date.parse(local.lastSolveDate) : -Infinity
  const remoteTs = remote.lastSolveDate ? Date.parse(remote.lastSolveDate) : -Infinity
  const localIsNewer = localTs > remoteTs
  merged.elo = localIsNewer ? local.elo : remote.elo
  merged.currentStreak = localIsNewer ? local.currentStreak : remote.currentStreak
  merged.lastSolveDate = localIsNewer ? local.lastSolveDate : remote.lastSolveDate
  // Peak ELO is a historical high-water mark — keep the max.
  merged.peakElo = Math.max(local.peakElo, remote.peakElo)
  // Union solved puzzles
  const solvedSet = new Set([...local.solvedPuzzles, ...remote.solvedPuzzles])
  merged.solvedPuzzles = [...solvedSet]
  merged.puzzlesSolved = merged.solvedPuzzles.length
  // Merge attempted (take max attempts per puzzle)
  merged.attemptedPuzzles = { ...remote.attemptedPuzzles }
  for (const [k, v] of Object.entries(local.attemptedPuzzles)) {
    merged.attemptedPuzzles[k] = Math.max(v, merged.attemptedPuzzles[k] || 0)
  }
  // Cumulative totals — keep higher
  merged.gamesPlayed = Math.max(local.gamesPlayed, remote.gamesPlayed)
  merged.gamesWon = Math.max(local.gamesWon, remote.gamesWon)
  merged.bestStreak = Math.max(local.bestStreak, remote.bestStreak)
  // Longer ELO history wins
  merged.eloHistory = local.eloHistory.length > remote.eloHistory.length
    ? local.eloHistory : remote.eloHistory
  // Prefer local name if remote is empty
  if (!merged.name && local.name) merged.name = local.name
  return merged
}

export default function usePlayerProfile() {
  const [profile, setProfile] = useState(defaultProfile)
  const [synced, setSynced] = useState(false)
  const syncingRef = useRef(false)

  // 1. Load from localStorage immediately
  useEffect(() => {
    const local = profileFromLocal()
    setProfile(local)
  }, [])

  // 2. Sync with Supabase after localStorage loads
  useEffect(() => {
    if (!profile.id || synced || syncingRef.current) return
    syncingRef.current = true

    async function sync() {
      try {
        const resp = await fetch(`/api/pente/player?id=${profile.id}`)
        if (resp.ok) {
          const { player } = await resp.json()
          const remote = profileFromSupabase(player)
          const merged = mergeProfiles(profile, remote)
          setProfile(merged)
          profileToLocal(merged)
          // Push merged back to Supabase
          await fetch('/api/pente/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileToSupabase(merged)),
          })
        } else if (resp.status === 404) {
          // First time — push local to Supabase
          await fetch('/api/pente/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileToSupabase(profile)),
          })
        }
      } catch {
        // Offline — localStorage is the source of truth
      }
      setSynced(true)
      syncingRef.current = false
    }
    sync()
  }, [profile.id, synced, profile])

  // Persist helper — writes to both localStorage and Supabase (fire-and-forget)
  const persist = useCallback((updated) => {
    profileToLocal(updated)
    fetch('/api/pente/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileToSupabase(updated)),
    }).catch(() => { /* offline — localStorage has it */ })
  }, [])

  // ── Actions ──

  const setPlayerName = useCallback((name) => {
    setProfile(prev => {
      const updated = { ...prev, name }
      persist(updated)
      return updated
    })
  }, [persist])

  const markSolved = useCallback((puzzleId, puzzleRating, attempts = 0, usedHint = false, solveTimeMs = null) => {
    let result = { delta: 0, newElo: STARTING_ELO, zone: getZone(STARTING_ELO) }

    setProfile(prev => {
      if (prev.solvedPuzzles.includes(puzzleId)) {
        result = { delta: 0, newElo: prev.elo, zone: getZone(prev.elo) }
        return prev
      }

      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const isToday = prev.lastSolveDate === today
      const wasYesterday = prev.lastSolveDate === yesterday

      let newStreak = prev.currentStreak
      if (!isToday) {
        newStreak = wasYesterday ? prev.currentStreak + 1 : 1
      }

      const delta = calculatePuzzleEloChange(prev.elo, puzzleRating, true, attempts, usedHint, solveTimeMs)
      const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, prev.elo + delta))
      const newPeak = Math.max(prev.peakElo, newElo)

      result = { delta, newElo, zone: getZone(newElo) }

      const updated = {
        ...prev,
        elo: newElo,
        peakElo: newPeak,
        puzzlesSolved: prev.puzzlesSolved + 1,
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        lastSolveDate: today,
        solvedPuzzles: [...prev.solvedPuzzles, puzzleId],
        eloHistory: [...prev.eloHistory, {
          timestamp: Date.now(), elo: newElo, delta, puzzleId, event: 'solve',
          solveTimeMs: typeof solveTimeMs === 'number' ? solveTimeMs : null,
        }],
      }
      persist(updated)
      return updated
    })

    return result
  }, [persist])

  const recordAttempt = useCallback((puzzleId, puzzleRating) => {
    setProfile(prev => {
      const delta = Math.round(-8 * (1 / (1 + Math.pow(10, (puzzleRating - prev.elo) / 400))))
      const newElo = Math.max(MIN_ELO, prev.elo + delta)

      const updated = {
        ...prev,
        elo: newElo,
        attemptedPuzzles: {
          ...prev.attemptedPuzzles,
          [puzzleId]: (prev.attemptedPuzzles[puzzleId] || 0) + 1,
        },
        eloHistory: [...prev.eloHistory, {
          timestamp: Date.now(), elo: newElo, delta, puzzleId, event: 'wrong',
        }],
      }
      persist(updated)
      return updated
    })
  }, [persist])

  const recordGameResult = useCallback((opponentElo, won) => {
    setProfile(prev => {
      const delta = calculateEloChange(prev.elo, opponentElo, won ? 1.0 : 0.0, 20)
      const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, prev.elo + delta))

      const updated = {
        ...prev,
        elo: newElo,
        peakElo: Math.max(prev.peakElo, newElo),
        gamesPlayed: prev.gamesPlayed + 1,
        gamesWon: won ? prev.gamesWon + 1 : prev.gamesWon,
        eloHistory: [...prev.eloHistory, {
          timestamp: Date.now(), elo: newElo, delta,
          event: won ? 'game_win' : 'game_loss',
        }],
      }
      persist(updated)
      return updated
    })
  }, [persist])

  const isSolved = useCallback((puzzleId) => {
    return profile.solvedPuzzles.includes(puzzleId)
  }, [profile.solvedPuzzles])

  return {
    // Identity
    playerId: profile.id,
    playerName: profile.name,
    setPlayerName,
    // ELO
    elo: profile.elo,
    peakElo: profile.peakElo,
    eloHistory: profile.eloHistory,
    zone: getZone(profile.elo),
    // Stats
    puzzlesSolved: profile.puzzlesSolved,
    gamesPlayed: profile.gamesPlayed,
    gamesWon: profile.gamesWon,
    currentStreak: profile.currentStreak,
    bestStreak: profile.bestStreak,
    solvedCount: profile.solvedPuzzles.length,
    // Actions
    markSolved,
    recordAttempt,
    recordGameResult,
    isSolved,
    // Sync state
    synced,
    // Raw profile for components that need everything
    profile,
  }
}
