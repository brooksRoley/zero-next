/**
 * Adaptive bot configuration for Go.
 * Maps player ELO to engine parameters (level, randomRate, timeBudget)
 * with continuous interpolation. Mirrors the Pente adaptive bot pattern.
 */

const ANCHORS = [
  { playerElo: 0,    level: 1, randomRate: 0.75, botElo: 400,  timeBudget: 1000 },
  { playerElo: 600,  level: 1, randomRate: 0.75, botElo: 400,  timeBudget: 1000 },
  { playerElo: 900,  level: 2, randomRate: 0.30, botElo: 750,  timeBudget: 1500 },
  { playerElo: 1200, level: 3, randomRate: 0.05, botElo: 1150, timeBudget: 2000 },
  { playerElo: 1500, level: 4, randomRate: 0,    botElo: 1350, timeBudget: 2500 },
  { playerElo: 2000, level: 5, randomRate: 0,    botElo: 1600, timeBudget: 3000 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolate(elo) {
  if (elo <= ANCHORS[0].playerElo) return { ...ANCHORS[0] }
  if (elo >= ANCHORS[ANCHORS.length - 1].playerElo) return { ...ANCHORS[ANCHORS.length - 1] }

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const lo = ANCHORS[i]
    const hi = ANCHORS[i + 1]
    if (elo >= lo.playerElo && elo <= hi.playerElo) {
      const t = (elo - lo.playerElo) / (hi.playerElo - lo.playerElo)
      return {
        level: Math.round(lerp(lo.level, hi.level, t)),
        randomRate: Math.max(0, lerp(lo.randomRate, hi.randomRate, t)),
        botElo: Math.round(lerp(lo.botElo, hi.botElo, t)),
        timeBudget: Math.round(lerp(lo.timeBudget, hi.timeBudget, t)),
      }
    }
  }

  return { ...ANCHORS[1] }
}

/**
 * Get bot engine config calibrated to a player's ELO.
 *
 * @param {number} playerElo - Player's current ELO
 * @param {number} gamesPlayed - Total bot games completed
 * @param {string|null} teachingFocus - 'capture' | 'eyes' | 'territory' | null
 * @returns {{ level: number, randomRate: number, botElo: number, timeBudget: number, teachingFocus: string|null }}
 */
export function getAdaptiveBotConfig(playerElo, gamesPlayed, teachingFocus) {
  const rampFactor = Math.min(gamesPlayed, 5) / 5
  const eloOffset = Math.round(200 * (1 - rampFactor))

  const config = interpolate(playerElo)

  return {
    level: config.level,
    randomRate: config.randomRate,
    botElo: config.botElo - eloOffset,
    timeBudget: config.timeBudget,
    teachingFocus: teachingFocus || null,
  }
}
