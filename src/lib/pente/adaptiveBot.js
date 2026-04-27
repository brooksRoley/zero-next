// src/lib/pente/adaptiveBot.js

/**
 * Adaptive bot configuration.
 * Interpolates engine params across BOT_LEVELS anchor points
 * so the bot plays at any ELO, not just 4 fixed tiers.
 */

// Anchor points — sorted by ELO ascending
const ANCHORS = [
  { elo: 600,  searchDepth: 1, timeBudgetMs: 200,  blunderRate: 0.15 },
  { elo: 1000, searchDepth: 2, timeBudgetMs: 800,  blunderRate: 0.05 },
  { elo: 1400, searchDepth: 3, timeBudgetMs: 2000, blunderRate: 0.01 },
  { elo: 1800, searchDepth: 4, timeBudgetMs: 4000, blunderRate: 0.00 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolateConfig(elo) {
  // Clamp to anchor range
  if (elo <= ANCHORS[0].elo) return { ...ANCHORS[0] }
  if (elo >= ANCHORS[ANCHORS.length - 1].elo) return { ...ANCHORS[ANCHORS.length - 1] }

  // Find the two anchors to interpolate between
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const lo = ANCHORS[i]
    const hi = ANCHORS[i + 1]
    if (elo >= lo.elo && elo <= hi.elo) {
      const t = (elo - lo.elo) / (hi.elo - lo.elo)
      return {
        elo,
        searchDepth: Math.round(lerp(lo.searchDepth, hi.searchDepth, t)),
        timeBudgetMs: Math.round(lerp(lo.timeBudgetMs, hi.timeBudgetMs, t)),
        blunderRate: Math.max(0, lerp(lo.blunderRate, hi.blunderRate, t)),
      }
    }
  }

  // Fallback (shouldn't reach here)
  return { ...ANCHORS[1] }
}

/**
 * Get bot engine config calibrated to a player's ELO.
 *
 * @param {number} playerElo - Player's current ELO rating
 * @param {number} gamesPlayed - Total bot games the player has completed
 * @returns {{ searchDepth: number, timeBudgetMs: number, blunderRate: number, effectiveElo: number }}
 */
export function getAdaptiveBotConfig(playerElo, gamesPlayed) {
  // New player ramp-up: first 5 games, bot plays below stated ELO
  // Game 0 → -200 ELO, game 5+ → 0 offset
  const rampFactor = Math.min(gamesPlayed, 5) / 5
  const eloOffset = 200 * (1 - rampFactor)
  const effectiveElo = Math.max(400, playerElo - eloOffset)

  const config = interpolateConfig(effectiveElo)

  return {
    searchDepth: config.searchDepth,
    timeBudgetMs: config.timeBudgetMs,
    blunderRate: config.blunderRate,
    effectiveElo: Math.round(effectiveElo),
  }
}
