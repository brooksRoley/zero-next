/**
 * Spaced review for puzzles you missed — a small Leitner system.
 *
 * A puzzle enters review the first time you fail it. It comes due a day later;
 * each time you solve it once it is due, it moves up a box and comes back after
 * a longer gap (1 → 3 → 7 days); solving it from the last box graduates it.
 * Failing it at any point drops it back to the first box. Solving it again
 * before it is due (an immediate retry) does not count: the point is to recall
 * it after forgetting has had a chance to work.
 *
 * The schedule is derived from the attempt history each game already keeps
 * (Go's attempts, Pente's rating history), so there is no new save to sync or
 * corrupt, and the rules can change without migrating anything.
 */

export const INTERVAL_DAYS = [1, 3, 7] as const
const DAY_MS = 24 * 60 * 60 * 1000

export type Attempt = { puzzleId: string; solved: boolean; at: number }

export type ReviewItem = {
  puzzleId: string
  /** 0-based Leitner box; INTERVAL_DAYS[box] is the gap before it comes due. */
  box: number
  dueAt: number
  lapses: number
}

/** Replays a history (any order) into the puzzles currently in review. Graduated puzzles are dropped. */
export function reviewState(history: Attempt[]): Map<string, ReviewItem> {
  const items = new Map<string, ReviewItem>()
  const sorted = [...history].filter((a) => Number.isFinite(a.at)).sort((a, b) => a.at - b.at)
  for (const { puzzleId, solved, at } of sorted) {
    const item = items.get(puzzleId)
    if (!solved) {
      items.set(puzzleId, { puzzleId, box: 0, dueAt: at + INTERVAL_DAYS[0] * DAY_MS, lapses: (item?.lapses ?? 0) + 1 })
      continue
    }
    if (!item || at < item.dueAt) continue
    const box = item.box + 1
    if (box >= INTERVAL_DAYS.length) items.delete(puzzleId)
    else items.set(puzzleId, { ...item, box, dueAt: at + INTERVAL_DAYS[box] * DAY_MS })
  }
  return items
}

/** Puzzles due now, most overdue first; ties go to the one missed most often. */
export function dueForReview(history: Attempt[], now: number): ReviewItem[] {
  return [...reviewState(history).values()]
    .filter((item) => item.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || b.lapses - a.lapses)
}

/** The next time anything comes due, or null if nothing is in review. */
export function nextDue(history: Attempt[]): number | null {
  const times = [...reviewState(history).values()].map((i) => i.dueAt)
  return times.length ? Math.min(...times) : null
}

// ── Adapters from each game's own history ───────────────────────────────────

/** Go keeps `attempts: [{ puzzleId, solved, createdAt }]` (newest first) in its profile. */
export function goAttempts(attempts: unknown): Attempt[] {
  if (!Array.isArray(attempts)) return []
  return attempts.flatMap((a) => {
    if (typeof a !== 'object' || a === null) return []
    const { puzzleId, solved, createdAt } = a as Record<string, unknown>
    const at = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN
    return typeof puzzleId === 'string' && typeof solved === 'boolean' && Number.isFinite(at) ? [{ puzzleId, solved, at }] : []
  })
}

/**
 * Pente has no attempt list; its rating history logs `{ timestamp, puzzleId,
 * event: 'solve' | 'wrong' }` for every puzzle result. Only ids accepted by
 * `isCatalogPuzzle` count — Endless puzzles are generated once and never return.
 */
export function penteAttempts(eloHistory: unknown, isCatalogPuzzle: (id: string) => boolean): Attempt[] {
  if (!Array.isArray(eloHistory)) return []
  return eloHistory.flatMap((e): Attempt[] => {
    if (typeof e !== 'object' || e === null) return []
    const { puzzleId, event, timestamp } = e as Record<string, unknown>
    if (typeof puzzleId !== 'string' || !isCatalogPuzzle(puzzleId) || typeof timestamp !== 'number') return []
    if (event === 'solve') return [{ puzzleId, solved: true, at: timestamp }]
    if (event === 'wrong') return [{ puzzleId, solved: false, at: timestamp }]
    return []
  })
}
