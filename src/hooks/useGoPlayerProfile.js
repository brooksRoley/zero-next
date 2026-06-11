import { useCallback, useEffect, useRef, useState } from 'react'
import { STARTING_ELO, eloUpdate } from 'src/lib/go/elo'

const STORAGE_KEY = 'go.profile.v2'
const LEGACY_V1_KEY = 'go.profile.v1'
const LEGACY_SOLVED_KEY = 'go.puzzles.solved'
const ATTEMPTS_CAP = 200

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function newPlayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback: synthesize a UUID-shaped string so the DB column still accepts it.
  const r = () => Math.random().toString(16).slice(2, 10)
  return `${r()}-${r().slice(0, 4)}-4${r().slice(0, 3)}-8${r().slice(0, 3)}-${r()}${r().slice(0, 4)}`
}

// Older builds stored `go-<uuid>`. Strip the prefix so Supabase (uuid column) accepts it.
function normalizeId(id) {
  if (!id) return newPlayerId()
  const stripped = id.startsWith('go-') ? id.slice(3) : id
  return UUID_RE.test(stripped) ? stripped : newPlayerId()
}

function nowIso() {
  return new Date().toISOString()
}

function emptyProfile() {
  return {
    playerId: newPlayerId(),
    name: '',
    goElo: STARTING_ELO,
    peakElo: STARTING_ELO,
    solved: [],
    attempts: [],          // local-only: not synced to Supabase
    lessonProgress: {},
    gamesPlayed: 0,
    gamesWon: 0,
    coachEnabled: true,    // local-only: not synced to Supabase
    createdAt: nowIso(),
    lastSeen: nowIso(),
  }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const merged = { ...emptyProfile(), ...parsed }
      merged.playerId = normalizeId(merged.playerId)
      return merged
    }
  } catch { /* ignore */ }
  // Migrate from v1 profile if present
  try {
    const v1Raw = localStorage.getItem(LEGACY_V1_KEY)
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw)
      const migrated = { ...emptyProfile(), ...parsed }
      migrated.playerId = normalizeId(migrated.playerId)
      saveProfile(migrated)
      return migrated
    }
  } catch { /* ignore */ }
  // Migrate from the original solved-only key if present
  const fresh = emptyProfile()
  try {
    const oldSolved = localStorage.getItem(LEGACY_SOLVED_KEY)
    if (oldSolved) fresh.solved = JSON.parse(oldSolved)
  } catch { /* ignore */ }
  return fresh
}

function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch { /* ignore */ }
}

function profileToSupabase(profile) {
  return {
    id: profile.playerId,
    name: profile.name || '',
    go_elo: profile.goElo,
    peak_elo: profile.peakElo,
    puzzles_solved: profile.solved.length,
    games_played: profile.gamesPlayed,
    games_won: profile.gamesWon,
    lesson_progress: profile.lessonProgress,
    solved_puzzles: profile.solved,
  }
}

function profileFromSupabase(row, base) {
  return {
    ...base,
    playerId: row.id,
    name: row.name || base.name || '',
    goElo: row.go_elo ?? base.goElo,
    peakElo: row.peak_elo ?? base.peakElo,
    solved: row.solved_puzzles || [],
    lessonProgress: row.lesson_progress || {},
    gamesPlayed: row.games_played ?? base.gamesPlayed,
    gamesWon: row.games_won ?? base.gamesWon,
  }
}

// Merge local + remote. Live state (current Elo) follows whichever side has the
// most attempts — that's the device that played most recently. Historical
// counters (peak, totals, solved set, lessons) union or take the max.
function mergeProfiles(local, remote) {
  const localActivity = local.attempts?.length ?? 0
  const lastLocalAttempt = local.attempts?.[0]?.createdAt
  const localIsNewer = lastLocalAttempt
    ? Date.parse(lastLocalAttempt) > Date.parse(remote.lastSeen || 0)
    : localActivity > 0

  const merged = { ...local }
  merged.playerId = remote.playerId
  merged.goElo = localIsNewer ? local.goElo : remote.goElo
  merged.peakElo = Math.max(local.peakElo, remote.peakElo)
  merged.gamesPlayed = Math.max(local.gamesPlayed, remote.gamesPlayed)
  merged.gamesWon = Math.max(local.gamesWon, remote.gamesWon)

  const solvedSet = new Set([...(local.solved || []), ...(remote.solved || [])])
  merged.solved = [...solvedSet]

  merged.lessonProgress = { ...remote.lessonProgress }
  for (const [k, v] of Object.entries(local.lessonProgress || {})) {
    const existing = merged.lessonProgress[k] || {}
    merged.lessonProgress[k] = {
      completed: existing.completed || v.completed,
      lastVisited: [existing.lastVisited, v.lastVisited]
        .filter(Boolean)
        .sort()
        .pop() || null,
    }
  }

  if (!merged.name && remote.name) merged.name = remote.name
  return merged
}

export default function useGoPlayerProfile() {
  const [profile, setProfile] = useState(null)
  const [synced, setSynced] = useState(false)
  const initRan = useRef(false)
  const syncingRef = useRef(false)

  // 1. Load from localStorage immediately
  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    const loaded = loadProfile()
    loaded.lastSeen = nowIso()
    setProfile(loaded)
    saveProfile(loaded)
  }, [])

  // 2. Sync with Supabase once localStorage has loaded
  useEffect(() => {
    if (!profile?.playerId || synced || syncingRef.current) return
    syncingRef.current = true

    async function sync() {
      try {
        const resp = await fetch(`/api/go/player?id=${profile.playerId}`)
        if (resp.ok) {
          const { player } = await resp.json()
          const remote = profileFromSupabase(player, profile)
          const merged = mergeProfiles(profile, remote)
          setProfile(merged)
          saveProfile(merged)
          await fetch('/api/go/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileToSupabase(merged)),
          })
        } else if (resp.status === 404) {
          // First time on Supabase — push local up.
          await fetch('/api/go/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileToSupabase(profile)),
          })
        }
      } catch {
        // Offline — localStorage remains the source of truth.
      }
      setSynced(true)
      syncingRef.current = false
    }
    sync()
  }, [profile, synced])

  // Persist helper: writes to localStorage and fires off a Supabase upsert.
  const persist = useCallback((updated) => {
    saveProfile(updated)
    fetch('/api/go/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileToSupabase(updated)),
    }).catch(() => { /* offline — localStorage has it */ })
  }, [])

  const update = useCallback((mutator) => {
    setProfile(prev => {
      if (!prev) return prev
      const next = mutator(prev)
      next.lastSeen = nowIso()
      persist(next)
      return next
    })
  }, [persist])

  const recordAttempt = useCallback(({ puzzleId, puzzleRating, solved, usedHint, solveTimeMs }) => {
    let result = null
    update(prev => {
      const eloBefore = prev.goElo
      const eloAfter = eloUpdate(eloBefore, puzzleRating, solved, usedHint)
      const attempt = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        puzzleId,
        solved: !!solved,
        usedHint: !!usedHint,
        solveTimeMs: Number.isFinite(solveTimeMs) ? solveTimeMs : null,
        eloBefore,
        eloAfter,
        createdAt: nowIso(),
      }
      const attempts = [attempt, ...prev.attempts].slice(0, ATTEMPTS_CAP)
      const solvedList = solved && !prev.solved.includes(puzzleId)
        ? [...prev.solved, puzzleId]
        : prev.solved
      result = { eloBefore, eloAfter, attempt }

      // Persist the attempt server-side. Fire-and-forget: local state is the
      // source of truth, so a failed/offline POST must never block the UI.
      fetch('/api/go/puzzle-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: prev.playerId,
          puzzle_id: puzzleId,
          puzzle_rating: puzzleRating ?? null,
          solved: !!solved,
          used_hint: !!usedHint,
          elo_before: eloBefore,
          elo_after: eloAfter,
          solve_time_ms: Number.isFinite(solveTimeMs) ? solveTimeMs : null,
        }),
      }).catch(() => { /* offline — local attempts log has it */ })

      return {
        ...prev,
        goElo: eloAfter,
        peakElo: Math.max(prev.peakElo, eloAfter),
        solved: solvedList,
        attempts,
      }
    })
    return result
  }, [update])

  const markLessonComplete = useCallback((stageNum) => {
    update(prev => ({
      ...prev,
      lessonProgress: {
        ...prev.lessonProgress,
        [String(stageNum)]: {
          completed: true,
          lastVisited: nowIso(),
        },
      },
    }))
  }, [update])

  const noteLessonVisit = useCallback((stageNum) => {
    update(prev => {
      const existing = prev.lessonProgress[String(stageNum)] || {}
      return {
        ...prev,
        lessonProgress: {
          ...prev.lessonProgress,
          [String(stageNum)]: { ...existing, lastVisited: nowIso() },
        },
      }
    })
  }, [update])

  const recordGameEnd = useCallback(({ won, newElo }) => {
    update(prev => ({
      ...prev,
      gamesPlayed: (prev.gamesPlayed || 0) + 1,
      gamesWon: (prev.gamesWon || 0) + (won ? 1 : 0),
      goElo: newElo !== undefined ? newElo : prev.goElo,
      peakElo: newElo !== undefined ? Math.max(prev.peakElo, newElo) : prev.peakElo,
    }))
  }, [update])

  const setCoachEnabled = useCallback((enabled) => {
    // Local-only field — bypass persist to avoid an unnecessary Supabase write.
    setProfile(prev => {
      if (!prev) return prev
      const next = { ...prev, coachEnabled: !!enabled, lastSeen: nowIso() }
      saveProfile(next)
      return next
    })
  }, [])

  const setPlayerName = useCallback((name) => {
    update(prev => ({ ...prev, name }))
  }, [update])

  const resetProfile = useCallback(() => {
    const fresh = emptyProfile()
    setProfile(fresh)
    saveProfile(fresh)
    setSynced(false)
    syncingRef.current = false
  }, [])

  const solvedSet = profile ? new Set(profile.solved) : new Set()

  return {
    ready: !!profile,
    playerId: profile?.playerId,
    playerName: profile?.name ?? '',
    goElo: profile?.goElo ?? STARTING_ELO,
    peakElo: profile?.peakElo ?? STARTING_ELO,
    solved: solvedSet,
    attempts: profile?.attempts ?? [],
    lessonProgress: profile?.lessonProgress ?? {},
    gamesPlayed: profile?.gamesPlayed ?? 0,
    gamesWon: profile?.gamesWon ?? 0,
    coachEnabled: profile?.coachEnabled ?? true,
    synced,
    recordAttempt,
    recordGameEnd,
    setCoachEnabled,
    setPlayerName,
    markLessonComplete,
    noteLessonVisit,
    resetProfile,
  }
}
