/**
 * Standard Elo update for puzzle solves.
 *
 *   expected = 1 / (1 + 10^((puzzle - me) / 400))
 *   new      = me + K * (actual - expected)
 *
 * Actual outcome:
 *   - solved without hint    → 1.0
 *   - solved after hint      → 0.5  (partial credit)
 *   - failed                 → 0.0
 *
 * K = 32 keeps movement responsive without being chaotic. Floor at 100 so
 * a long losing streak doesn't take the player to nonsense ratings.
 */
export const STARTING_ELO = 1000
export const MIN_ELO = 100
const K = 32

export function eloUpdate(playerElo, puzzleRating, solved, usedHint) {
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerElo) / 400))
  let actual = 0
  if (solved && !usedHint) actual = 1
  else if (solved && usedHint) actual = 0.5
  const next = Math.round(playerElo + K * (actual - expected))
  return Math.max(MIN_ELO, next)
}

/**
 * Map a Go-style rating (1000 ≈ 20 kyu, +100 per stone) to a kyu/dan label.
 * This is rough — real Go ranks vary by server — but it gives the climb a
 * shape the player can feel.
 */
export function rankLabel(elo) {
  if (elo >= 2700) return '9 dan'
  if (elo >= 2100) return `${Math.min(9, Math.floor((elo - 2100) / 100) + 1)} dan`
  // 30 kyu at 100; 1 kyu at 2000
  const kyu = Math.max(1, Math.min(30, 21 - Math.floor((elo - 1000) / 100)))
  return `${kyu} kyu`
}

/**
 * ELO update for a completed bot game.
 * outcome: 1.0 = win, 0.5 = draw, 0.0 = loss
 */
export function eloUpdateGame(playerElo, botElo, outcome) {
  const expected = 1 / (1 + Math.pow(10, (botElo - playerElo) / 400))
  const next = Math.round(playerElo + K * (outcome - expected))
  return Math.max(MIN_ELO, next)
}

/**
 * Tiny helper for showing "+24" or "−16" deltas after a puzzle attempt.
 */
export function eloDelta(before, after) {
  const d = after - before
  if (d === 0) return '±0'
  return d > 0 ? `+${d}` : `${d}`
}
