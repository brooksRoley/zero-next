import { useCallback, useEffect, useRef, useState } from 'react'
import { STARTING_ELO, eloUpdate } from 'src/lib/go/elo'

const STORAGE_KEY = 'go.profile.v2'
const LEGACY_V1_KEY = 'go.profile.v1'
const LEGACY_SOLVED_KEY = 'go.puzzles.solved'
const ATTEMPTS_CAP = 200

/**
 * Generate a stable player id. Uses crypto.randomUUID when available, falls
 * back to a timestamp+random scheme so the hook works in older environments.
 */
function newPlayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `go-${crypto.randomUUID()}`
  return `go-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function emptyProfile() {
  return {
    playerId: newPlayerId(),
    goElo: STARTING_ELO,
    peakElo: STARTING_ELO,
    solved: [],            // serialized as array; surfaced as Set
    attempts: [],          // [{ id, puzzleId, solved, usedHint, eloBefore, eloAfter, createdAt }]
    lessonProgress: {},    // { '0': { completed: true, lastVisited: iso }, ... }
    gamesPlayed: 0,
    gamesWon: 0,
    coachEnabled: true,
    createdAt: nowIso(),
    lastSeen: nowIso(),
  }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...emptyProfile(), ...parsed }
    }
  } catch { /* ignore */ }
  // Migrate from v1 profile if present
  try {
    const v1Raw = localStorage.getItem(LEGACY_V1_KEY)
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw)
      const migrated = { ...emptyProfile(), ...parsed }
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

/**
 * Single source of truth for Go player state on the client. Backed by
 * localStorage with a Supabase-shaped record so a future migration is just
 * an upsert. Exposes `solved` as a Set for O(1) lookup; everything else
 * passes through as-is.
 */
export default function useGoPlayerProfile() {
  const [profile, setProfile] = useState(null) // null until hydrated
  const initRan = useRef(false)

  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    const loaded = loadProfile()
    loaded.lastSeen = nowIso()
    setProfile(loaded)
    saveProfile(loaded)
  }, [])

  const update = useCallback((mutator) => {
    setProfile(prev => {
      if (!prev) return prev
      const next = mutator(prev)
      next.lastSeen = nowIso()
      saveProfile(next)
      return next
    })
  }, [])

  /**
   * Record a puzzle attempt and update Elo. Returns { eloBefore, eloAfter, solved }
   * via callback-side-effect (the new profile is reflected on next render).
   */
  const recordAttempt = useCallback(({ puzzleId, puzzleRating, solved, usedHint }) => {
    let result = null
    update(prev => {
      const eloBefore = prev.goElo
      const eloAfter = eloUpdate(eloBefore, puzzleRating, solved, usedHint)
      const attempt = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        puzzleId,
        solved: !!solved,
        usedHint: !!usedHint,
        eloBefore,
        eloAfter,
        createdAt: nowIso(),
      }
      const attempts = [attempt, ...prev.attempts].slice(0, ATTEMPTS_CAP)
      const solvedList = solved && !prev.solved.includes(puzzleId)
        ? [...prev.solved, puzzleId]
        : prev.solved
      result = { eloBefore, eloAfter, attempt }
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
    update(prev => ({
      ...prev,
      coachEnabled: !!enabled,
    }))
  }, [update])

  const resetProfile = useCallback(() => {
    const fresh = emptyProfile()
    setProfile(fresh)
    saveProfile(fresh)
  }, [])

  // Surface solved as a Set for callers
  const solvedSet = profile ? new Set(profile.solved) : new Set()

  return {
    ready: !!profile,
    playerId: profile?.playerId,
    goElo: profile?.goElo ?? STARTING_ELO,
    peakElo: profile?.peakElo ?? STARTING_ELO,
    solved: solvedSet,
    attempts: profile?.attempts ?? [],
    lessonProgress: profile?.lessonProgress ?? {},
    gamesPlayed: profile?.gamesPlayed ?? 0,
    gamesWon: profile?.gamesWon ?? 0,
    coachEnabled: profile?.coachEnabled ?? true,
    recordAttempt,
    recordGameEnd,
    setCoachEnabled,
    markLessonComplete,
    noteLessonVisit,
    resetProfile,
  }
}
