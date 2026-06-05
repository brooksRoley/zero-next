/**
 * ELO calculation for Pente puzzles and games.
 * Shared between puzzle progress and future game rating.
 */

// Altitude zones — maps ELO ranges to mountain positions
export const ALTITUDE_ZONES = [
  { name: 'Trailhead', min: 0, max: 800, color: '#4a7c59', emoji: '' },
  { name: 'Forest Path', min: 800, max: 1000, color: '#2d6a4f', emoji: '' },
  { name: 'Ridge Line', min: 1000, max: 1200, color: '#6b7280', emoji: '' },
  { name: 'Alpine Zone', min: 1200, max: 1400, color: '#94a3b8', emoji: '' },
  { name: 'Snow Field', min: 1400, max: 1600, color: '#cbd5e1', emoji: '' },
  { name: 'Summit Push', min: 1600, max: 1800, color: '#e2e8f0', emoji: '' },
  { name: 'Peak', min: 1800, max: 2400, color: '#f8fafc', emoji: '' },
]

export const STARTING_ELO = 800
export const MIN_ELO = 400
export const MAX_ELO = 2400

export function getZone(elo) {
  for (let i = ALTITUDE_ZONES.length - 1; i >= 0; i--) {
    if (elo >= ALTITUDE_ZONES[i].min) return ALTITUDE_ZONES[i]
  }
  return ALTITUDE_ZONES[0]
}

export function getAltitudePercent(elo) {
  const clamped = Math.max(MIN_ELO, Math.min(MAX_ELO, elo))
  return ((clamped - MIN_ELO) / (MAX_ELO - MIN_ELO)) * 100
}

/**
 * Standard ELO calculation.
 * @param {number} playerElo - Player's current rating
 * @param {number} opponentElo - Puzzle or opponent rating
 * @param {number} score - 1.0 = win, 0.5 = draw/partial, 0.0 = loss
 * @param {number} K - K-factor (higher = more volatile)
 * @returns {number} ELO change (can be negative)
 */
export function calculateEloChange(playerElo, opponentElo, score, K = 20) {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
  return Math.round(K * (score - expected))
}

// Speed bonus tuning: a solve in 0ms earns the full bonus, decaying linearly to
// zero at SPEED_BONUS_WINDOW_MS. MAX_SPEED_BONUS caps the multiplier uplift.
const SPEED_BONUS_WINDOW_MS = 30000
const MAX_SPEED_BONUS = 0.3

/**
 * Puzzle-specific ELO change.
 * Accounts for attempts, hints, and (optionally) solve speed.
 *
 * @param {number} [solveTimeMs] - Time-to-solve in ms. When provided AND the
 *   puzzle rating is at or above the player's rating, fast solves earn up to a
 *   +30% score bonus. Speed is only rewarded on puzzles at/above the player's
 *   level — quickly solving an easy puzzle is expected, not a skill signal.
 */
export function calculatePuzzleEloChange(playerElo, puzzleRating, solved, attempts, usedHint, solveTimeMs) {
  if (!solved) {
    // Failed the puzzle (skipped or gave up)
    return calculateEloChange(playerElo, puzzleRating, 0, 16)
  }

  // Base score for solving
  let score = 1.0

  // Penalty for extra attempts
  if (attempts > 0) {
    score = Math.max(0.3, 1.0 - attempts * 0.15)
  }

  // Penalty for using hint
  if (usedHint) {
    score = Math.max(0.2, score * 0.6)
  }

  // Speed bonus for fast solves on puzzles at or above the player's rating.
  if (typeof solveTimeMs === 'number' && solveTimeMs >= 0 && puzzleRating >= playerElo) {
    const raw = (SPEED_BONUS_WINDOW_MS - solveTimeMs) / SPEED_BONUS_WINDOW_MS
    const speedBonus = Math.max(0, Math.min(MAX_SPEED_BONUS, raw))
    score *= 1 + speedBonus
  }

  return calculateEloChange(playerElo, puzzleRating, score, 20)
}
