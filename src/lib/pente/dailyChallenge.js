/**
 * Daily Challenge — deterministic puzzle-of-the-day + streak math.
 *
 * Everything here is pure: given the same date stamp and prior state, every
 * player (and the server) derives the same puzzle and the same streak result.
 * That determinism is what makes a shared "today's puzzle" and a leaderboard
 * possible without storing the puzzle assignment anywhere.
 */
import { puzzles } from 'src/lib/pente/puzzles'

// Premium tier this surface teases. No payment wiring yet — the gate is a
// demand-capture CTA (see DailyChallenge.jsx) that fires an analytics event.
export const DAILY_PRO_PRICE = 7 // USD / month
export const DAILY_PRO_TIER = 'pente_daily_pro'

/** Local-date YYYY-MM-DD so the puzzle rolls over at the player's midnight,
 *  matching how usePlayerProfile computes solve dates. */
export function getDailyStamp(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10)
}

/** Stable 32-bit hash of the date string. Same stamp → same number everywhere. */
function hashStamp(stamp) {
  let h = 0
  for (let i = 0; i < stamp.length; i++) {
    h = (Math.imul(h, 31) + stamp.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * The curated puzzle assigned to a given day. Deterministic across all players.
 * Returns null only if the catalog is somehow empty.
 */
export function getDailyPuzzle(stamp = getDailyStamp()) {
  if (!puzzles.length) return null
  return puzzles[hashStamp(stamp) % puzzles.length]
}

export const emptyDailyState = Object.freeze({
  streak: 0,
  bestStreak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
  // Keyed by date stamp → light record of that day's result. Powers the
  // (premium) history/replay surface and the recent-activity dots.
  history: {},
})

/** Has today's daily already been completed in this state? */
export function isCompletedOn(state, stamp = getDailyStamp()) {
  return Boolean(state && state.lastCompletedDate === stamp)
}

function stampMinusDays(stamp, days) {
  const base = new Date(`${stamp}T00:00:00`)
  base.setDate(base.getDate() - days)
  return getDailyStamp(base)
}

/**
 * Fold a completion into the state. Idempotent per day: completing the same
 * day twice does not double-count or re-bump the streak. A gap of more than one
 * day resets the streak to 1.
 */
export function applyCompletion(state, result, stamp = getDailyStamp()) {
  const prev = state || emptyDailyState
  if (prev.lastCompletedDate === stamp) return prev // already done today

  const yesterday = stampMinusDays(stamp, 1)
  const continued = prev.lastCompletedDate === yesterday
  const streak = continued ? prev.streak + 1 : 1

  return {
    streak,
    bestStreak: Math.max(prev.bestStreak || 0, streak),
    lastCompletedDate: stamp,
    totalCompleted: (prev.totalCompleted || 0) + 1,
    history: {
      ...prev.history,
      [stamp]: {
        puzzleId: result?.puzzleId ?? null,
        attempts: result?.attempts ?? 0,
        usedHint: Boolean(result?.usedHint),
        solveTimeMs: typeof result?.solveTimeMs === 'number' ? result.solveTimeMs : null,
        completedAt: Date.now(),
      },
    },
  }
}

/**
 * Merge two daily states (local cache vs remote). Streak/last-date follow the
 * most recent completion; bestStreak and totals keep the high-water mark;
 * history is unioned. Mirrors the merge philosophy in usePlayerProfile.
 */
export function mergeDailyState(local, remote) {
  const a = local || emptyDailyState
  const b = remote || emptyDailyState
  const aTs = a.lastCompletedDate ? Date.parse(a.lastCompletedDate) : -Infinity
  const bTs = b.lastCompletedDate ? Date.parse(b.lastCompletedDate) : -Infinity
  const newer = aTs >= bTs ? a : b
  return {
    streak: newer.streak || 0,
    bestStreak: Math.max(a.bestStreak || 0, b.bestStreak || 0),
    lastCompletedDate: newer.lastCompletedDate || null,
    totalCompleted: Math.max(a.totalCompleted || 0, b.totalCompleted || 0),
    history: { ...b.history, ...a.history },
  }
}

/** Last `count` day stamps ending today, oldest → newest (for the dot strip). */
export function recentStamps(count = 14, stamp = getDailyStamp()) {
  const out = []
  for (let i = count - 1; i >= 0; i--) out.push(stampMinusDays(stamp, i))
  return out
}
