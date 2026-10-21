import {
  FOREST, TIERS, createGame, generateMap, placeTower, sRng, startWave, stepGame, towerDPS, upgradeCost, upgradeTower,
  type Difficulty, type GameState,
} from './engine'

/**
 * A fixed, greedy player used to measure the campaign's difficulty curve.
 *
 * Before every wave it spends its gold on whichever purchase adds the most
 * damage per gold over the road it covers — a new tower at its best spot, or an
 * upgrade. Splash and slow get a flat bonus rather than real placement
 * thinking, so a thoughtful human beats it; what matters is that it plays every
 * level the same way, so its results rank the levels.
 */

/** Road cells within `range` of a spot: how much of the path a tower there sees. */
function coverage(g: GameState, row: number, col: number, range: number) {
  let n = 0
  for (const p of g.path) if (Math.hypot(p.row - row, p.col - col) <= range) n++
  return n
}

/** Damage a tower is worth per second, crediting splash and slow roughly. */
function worth(tierIdx: number, level: number) {
  const tier = TIERS[tierIdx]
  return towerDPS(tier, level) * (1 + tier.splash) * (tier.slow ? 1.5 : 1)
}

function spend(g: GameState) {
  for (;;) {
    let best: { value: number; act: () => void } | null = null
    for (let tierIdx = 0; tierIdx < TIERS.length; tierIdx++) {
      const tier = TIERS[tierIdx]
      if (g.gold < tier.cost) continue
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          if (g.grid[r][c] !== FOREST || g.towers.some((t) => t.row === r && t.col === c)) continue
          const value = (worth(tierIdx, 1) * coverage(g, r, c, tier.range)) / tier.cost
          if (!best || value > best.value) best = { value, act: () => placeTower(g, r, c, tierIdx) }
        }
      }
    }
    for (const t of g.towers) {
      const tier = TIERS[t.tierIdx]
      const cost = upgradeCost(tier, t.level)
      if (g.gold < cost) continue
      const value = ((worth(t.tierIdx, t.level + 1) - worth(t.tierIdx, t.level)) * coverage(g, t.row, t.col, t.range)) / cost
      if (!best || value > best.value) best = { value, act: () => upgradeTower(g, t) }
    }
    if (!best) return
    best.act()
  }
}

export type BotResult = {
  won: boolean
  /** Waves fully survived (all of them on a win). */
  wavesCleared: number
  livesLeft: number
  /** 1–2 on a win (1 + share of lives kept), under 1 on a loss (share of waves cleared). */
  score: number
}

export function playLevel(
  level: { template: string; cols: number; rows: number } & Difficulty,
  { tall = false, seed = 1, stepMs = 16 }: { tall?: boolean; seed?: number; stepMs?: number } = {},
): BotResult {
  const g = createGame(generateMap(level.template, level.cols, level.rows, tall), level, sRng(seed))
  let wavesCleared = 0
  for (;;) {
    spend(g)
    startWave(g)
    let event = null
    while (!event) event = stepGame(g, stepMs)
    if (event === 'gameover') {
      return { won: false, wavesCleared, livesLeft: 0, score: wavesCleared / level.waves }
    }
    wavesCleared++
    if (event === 'victory') {
      return { won: true, wavesCleared, livesLeft: g.lives, score: 1 + g.lives / level.lives }
    }
  }
}

type LevelSpec = Parameters<typeof playLevel>[0]

/**
 * How much tougher a level's ants could be before the bot loses: the largest
 * factor on `hpMult` it still wins at, on every seed. Above 1 the bot has
 * slack; below 1 the level as shipped beats it. Higher means easier, and
 * unlike lives left it keeps ranking levels the bot wins without a scratch.
 */
export function headroom(level: LevelSpec, { tall = false, seeds = [1, 2, 3] }: { tall?: boolean; seeds?: number[] } = {}) {
  const winsAt = (k: number) => seeds.every((seed) => playLevel({ ...level, hpMult: level.hpMult * k }, { tall, seed }).won)
  let lo = 0
  let hi = 1
  while (winsAt(hi) && hi < 64) { lo = hi; hi *= 2 }
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    if (winsAt(mid)) lo = mid
    else hi = mid
  }
  return Math.round(lo * 100) / 100
}
