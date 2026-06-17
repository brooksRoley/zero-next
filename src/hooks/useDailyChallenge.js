import { useState, useEffect, useCallback, useRef } from 'react'
import {
  emptyDailyState,
  applyCompletion,
  mergeDailyState,
  getDailyStamp,
  isCompletedOn,
} from 'src/lib/pente/dailyChallenge'

/**
 * Daily Challenge progress hook. localStorage-first (instant, offline-safe)
 * with a best-effort Supabase sync through /api/pente/daily, mirroring the
 * Supabase-first-with-local-cache pattern in usePlayerProfile.
 *
 * `playerId` comes from usePlayerProfile so the daily streak attaches to the
 * same lazy-auth identity as the rest of the player's record.
 */

const LOCAL_KEY = 'pente_daily_challenge'

function loadLocal() {
  if (typeof window === 'undefined') return emptyDailyState
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? { ...emptyDailyState, ...JSON.parse(raw) } : emptyDailyState
  } catch {
    return emptyDailyState
  }
}

function saveLocal(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    /* storage blocked (private mode) — in-memory state still works this session */
  }
}

export default function useDailyChallenge(playerId) {
  const [daily, setDaily] = useState(emptyDailyState)
  const [loaded, setLoaded] = useState(false)
  const syncedRef = useRef(false)

  // 1. localStorage immediately (after mount, to avoid SSR hydration mismatch).
  useEffect(() => {
    setDaily(loadLocal())
    setLoaded(true)
  }, [])

  // 2. Merge remote once we have an identity. Silent on failure / unsupported.
  useEffect(() => {
    if (!playerId || syncedRef.current) return
    syncedRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(`/api/pente/daily?id=${playerId}`)
        if (!resp.ok) return
        const { daily: remote, supported } = await resp.json()
        if (cancelled || !supported || !remote) return
        setDaily((prev) => {
          const merged = mergeDailyState(prev, remote)
          saveLocal(merged)
          return merged
        })
      } catch {
        /* offline — localStorage is the source of truth */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerId])

  // Record today's completion. Idempotent per day (see applyCompletion).
  const recordCompletion = useCallback(
    (result) => {
      const stamp = getDailyStamp()
      let next = emptyDailyState
      setDaily((prev) => {
        next = applyCompletion(prev, result, stamp)
        saveLocal(next)
        if (playerId) {
          fetch('/api/pente/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: playerId, daily: next }),
          }).catch(() => {
            /* offline — localStorage has it; will reconcile on next sync */
          })
        }
        return next
      })
      return next
    },
    [playerId]
  )

  return {
    daily,
    loaded,
    completedToday: isCompletedOn(daily),
    recordCompletion,
  }
}
