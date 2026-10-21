/**
 * Nanu & Pika tower defense: the rules, with no canvas.
 *
 * The component draws and animates; everything that decides who wins lives
 * here — maps, towers, ant scaling, and the per-frame combat step — so the
 * campaign's difficulty curve can be measured by a headless bot
 * (`bot.ts`, `__tests__/campaign.test.ts`) instead of asserted.
 */

export const FOREST = 0
export const ROAD = 1
export const OBSTACLE = 2
export const SELL_REFUND = 0.7

export type Cell = { row: number; col: number }

// ─── Towers ──────────────────────────────────────────────────────────────────
export type Tier = {
  id: string
  name: string
  cost: number
  baseDmg: number
  range: number
  cooldown: number
  splash: number
  slow: number
  desc: string
  hueBase: number
  color: string
  tip: string
}

export const TIERS: Tier[] = [
  { id: 'apprentice', name: 'Apprentice', cost: 20, baseDmg: 10, range: 2.0, cooldown: 800, splash: 0.2, slow: 0, desc: 'Cheap all-rounder', hueBase: 210, color: '#7eb8ff', tip: 'Versatile starter. Works anywhere — place along straight roads for steady coverage.' },
  { id: 'pyromancer', name: 'Pyromancer', cost: 60, baseDmg: 18, range: 2.0, cooldown: 1000, splash: 0.9, slow: 0, desc: 'Area damage', hueBase: 10, color: '#d14624', tip: 'Big splash radius but short range. Best at tight corners and U-turns where ants cluster together.' },
  { id: 'frostclaw', name: 'Frostclaw', cost: 50, baseDmg: 7, range: 3.5, cooldown: 600, splash: 0.2, slow: 800, desc: 'Slows, fast', hueBase: 190, color: '#55ddff', tip: 'Long range + slow effect. Place near long straight sections so other towers get more hits on slowed ants.' },
  { id: 'archsage', name: 'Archsage', cost: 100, baseDmg: 40, range: 3.0, cooldown: 1700, splash: 1.2, slow: 0, desc: 'Devastating', hueBase: 55, color: '#ffdd44', tip: 'Slow but devastating splash. Place at bends where the path loops back — the range can cover two lanes at once.' },
]

export const upgradeCost = (tier: Tier, lvl: number) => Math.floor(tier.cost * 0.5 * Math.pow(lvl, 1.4))
export const towerDmg = (tier: Tier, lvl: number) => Math.floor(tier.baseDmg * (1 + 0.4 * Math.log(lvl + 1)))
export const towerDPS = (tier: Tier, lvl: number) => towerDmg(tier, lvl) / (tier.cooldown / 1000)

// ─── Ant scaling (a level's multipliers apply on top) ────────────────────────
export const antHp = (w: number) => Math.floor(40 * Math.pow(w, 1.55))
export const waveSize = (w: number) => 6 + Math.floor(w * 1.8)
export const spawnInterval = (w: number) => Math.max(300, 1400 - w * 55)
export const antSpeed = (w: number) => 0.012 * (1 + (w - 1) * 0.02)
export const killReward = (w: number) => Math.floor(5 + w * 0.8)
export const waveBonus = (w: number) => 20 + w * 5

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function dist(a: Cell, b: Cell) {
  return Math.sqrt((a.col - b.col) ** 2 + (a.row - b.row) ** 2)
}

export function lerpPath(path: Cell[], t: number): Cell {
  const i = Math.min(Math.floor(t), path.length - 2)
  const f = t - i
  const a = path[i]
  const b = path[Math.min(i + 1, path.length - 1)]
  return { row: a.row + (b.row - a.row) * f, col: a.col + (b.col - a.col) * f }
}

/** Park–Miller generator: the same seed replays the same game. */
export function sRng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ─── Maps ────────────────────────────────────────────────────────────────────
// Each template draws a road on a landscape grid (cols ≥ rows) and may drop
// obstacles. A tall board is the same map transposed, so a level plays
// identically on a phone held upright.

/** Waypoints → one cell per step. Segments run along a column or a row. */
export function wpToPath(waypoints: Cell[]): Cell[] {
  const path: Cell[] = [{ ...waypoints[0] }]
  for (let w = 1; w < waypoints.length; w++) {
    let { row: r, col: c } = path[path.length - 1]
    const { row: tr, col: tc } = waypoints[w]
    while (r !== tr || c !== tc) {
      if (c !== tc) c += c < tc ? 1 : -1
      else r += r < tr ? 1 : -1
      path.push({ row: r, col: c })
    }
  }
  return path
}

type Grid = number[][]
type Template = { id: string; name: string; draw: (g: Grid, C: number, R: number) => Cell[] }

function block(g: Grid, path: Cell[], spots: [number, number][]) {
  const R = g.length
  const C = g[0].length
  for (const [r, c] of spots) {
    if (r >= 0 && r < R && c >= 0 && c < C && !path.some((p) => p.row === r && p.col === c)) g[r][c] = OBSTACLE
  }
}

export const MAP_TEMPLATES: Template[] = [
  {
    // Three long lanes with a forest strip between each: every tower in a
    // strip covers two lanes. The gentlest map.
    id: 'serpentine',
    name: 'Serpentine',
    draw(g, C, R) {
      const mid = Math.floor(R / 2)
      const p = wpToPath([
        { row: 1, col: 0 }, { row: 1, col: C - 3 }, { row: mid, col: C - 3 },
        { row: mid, col: 2 }, { row: R - 2, col: 2 }, { row: R - 2, col: C - 1 },
      ])
      block(g, p, [[0, Math.floor(C / 3)], [R - 1, Math.floor((2 * C) / 3)]])
      return p
    },
  },
  {
    // Spirals inward to Nanu & Pika's den in the middle.
    id: 'spiral',
    name: 'Spiral',
    draw(g, C, R) {
      let top = 1
      let bottom = R - 2
      let left = 1
      let right = C - 2
      const wp: Cell[] = [{ row: top, col: 0 }, { row: top, col: right }]
      for (;;) {
        if (bottom - top < 2) break
        wp.push({ row: bottom, col: right })
        if (right - left < 2) break
        wp.push({ row: bottom, col: left })
        if (bottom - (top + 2) < 2) break
        wp.push({ row: top + 2, col: left })
        top += 2; bottom -= 2; left += 2; right -= 2
        if (right - left < 2) break
        wp.push({ row: top, col: right })
      }
      const p = wpToPath(wp)
      block(g, p, [[0, 1], [R - 1, C - 2]])
      return p
    },
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    draw(g, C, R) {
      const s = Math.floor(C / 5)
      const b = R - 2
      const p = wpToPath([
        { row: 1, col: 0 }, { row: 1, col: s }, { row: b, col: s }, { row: b, col: s * 2 }, { row: 1, col: s * 2 },
        { row: 1, col: s * 3 }, { row: b, col: s * 3 }, { row: b, col: s * 4 }, { row: Math.floor(R / 2), col: s * 4 },
        { row: Math.floor(R / 2), col: C - 1 },
      ])
      const spots: [number, number][] = []
      for (let i = 1; i <= 4; i++) spots.push([0, s * i - 1], [R - 1, s * i - 1])
      block(g, p, spots)
      return p
    },
  },
  {
    id: 'switchback',
    name: 'Switchback',
    draw(g, C, R) {
      const gap = Math.max(3, Math.floor(C / 6))
      const b = R - 2
      const wp: Cell[] = [{ row: 1, col: 0 }]
      let row = 1
      for (let c = gap; c < C - 1; c += gap) {
        const nr = row === 1 ? b : 1
        wp.push({ row, col: c }, { row: nr, col: c })
        row = nr
      }
      wp.push({ row, col: C - 1 })
      const p = wpToPath(wp)
      const spots: [number, number][] = []
      for (let c = gap; c < C - 1; c += gap) for (let r = 2; r < R - 2; r++) spots.push([r, c - 1])
      block(g, p, spots)
      return p
    },
  },
  {
    id: 's-curve',
    name: 'S-Curve',
    draw(g, C, R) {
      const m = Math.floor(C / 4)
      const b = R - 2
      const p = wpToPath([
        { row: 1, col: 0 }, { row: 1, col: m }, { row: b, col: m }, { row: b, col: m * 2 },
        { row: 1, col: m * 2 }, { row: 1, col: m * 3 }, { row: b, col: m * 3 }, { row: b, col: C - 1 },
      ])
      block(g, p, [[0, m - 2], [0, m - 1], [R - 1, m - 2], [R - 1, m - 1], [0, m * 2 + 1], [R - 1, m * 2 + 1]])
      return p
    },
  },
  {
    // A short, wandering road with wide-open forest: lots of room to build,
    // little time to shoot. The sharpest map.
    id: 'diamond',
    name: 'Diamond',
    draw(g, C, R) {
      const mid = Math.floor(R / 2)
      const q1 = Math.floor(C / 4)
      const q3 = Math.floor((C * 3) / 4)
      const p = wpToPath([
        { row: mid, col: 0 }, { row: mid, col: q1 }, { row: 1, col: q1 }, { row: 1, col: Math.floor(C / 2) },
        { row: R - 2, col: Math.floor(C / 2) }, { row: R - 2, col: q3 }, { row: mid, col: q3 }, { row: mid, col: C - 1 },
      ])
      block(g, p, [[0, q1 + 2], [R - 1, q1 + 1], [0, q3 + 1], [R - 1, q3 + 2]])
      return p
    },
  },
]

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(MAP_TEMPLATES.map((t) => [t.id, t]))

/**
 * Builds a level's map. `cols`×`rows` is the landscape size; `tall` returns
 * the same map transposed (rows×cols), road and obstacles included.
 */
export function generateMap(templateId: string, cols: number, rows: number, tall = false) {
  const template = TEMPLATE_BY_ID[templateId]
  if (!template) throw new Error(`Unknown map template: ${templateId}`)
  const land: Grid = Array.from({ length: rows }, () => Array(cols).fill(FOREST))
  const landPath = template.draw(land, cols, rows)
  for (const p of landPath) land[p.row][p.col] = ROAD
  if (!tall) return { grid: land, path: landPath, cols, rows }
  const grid: Grid = Array.from({ length: cols }, (_, r) => Array.from({ length: rows }, (_, c) => land[c][r]))
  const path = landPath.map(({ row, col }) => ({ row: col, col: row }))
  return { grid, path, cols: rows, rows: cols }
}

/**
 * A playable road: every step moves one cell, it stays on the board, it never
 * revisits a cell, it starts on the board's edge, and no two stretches of road
 * touch side-on (touching lanes render as one blob and read as a shortcut).
 */
export function validatePath(path: Cell[], cols: number, rows: number): string | null {
  if (path.length < 2) return 'too short'
  const seen = new Map<string, number>()
  for (let i = 0; i < path.length; i++) {
    const { row, col } = path[i]
    if (row < 0 || row >= rows || col < 0 || col >= cols) return `cell ${i} off the board`
    if (i > 0 && Math.abs(row - path[i - 1].row) + Math.abs(col - path[i - 1].col) !== 1) return `jump at step ${i}`
    const key = `${row},${col}`
    if (seen.has(key)) return `revisits ${key} at step ${i}`
    seen.set(key, i)
  }
  for (let i = 0; i < path.length; i++) {
    const { row, col } = path[i]
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = seen.get(`${row + dr},${col + dc}`)
      if (j !== undefined && Math.abs(j - i) > 1) return `road touches itself at ${row},${col}`
    }
  }
  const s = path[0]
  if (s.row !== 0 && s.col !== 0 && s.row !== rows - 1 && s.col !== cols - 1) return 'does not start at an edge'
  return null
}

// ─── Game state and the combat step ──────────────────────────────────────────
export type Difficulty = {
  waves: number
  startGold: number
  lives: number
  /** Multiplies every ant's hit points. */
  hpMult: number
  /** Multiplies every ant's walking speed. */
  speedMult: number
}

export type Tower = {
  row: number
  col: number
  tierId: string
  tierIdx: number
  level: number
  range: number
  cooldown: number
  splash: number
  slow: number
  lastFired: number
  state: 'idle' | 'attack'
  attackTimer: number
  id: number
  hue: number
}

export type Ant = {
  t: number
  hp: number
  maxHp: number
  id: number
  speed: number
  dead: boolean
  deathTime: number
  variant: number
  slow: number
}

export type GameState = {
  grid: Grid
  path: Cell[]
  cols: number
  rows: number
  difficulty: Difficulty
  towers: Tower[]
  ants: Ant[]
  gold: number
  lives: number
  wave: number
  maxWaves: number
  phase: 'prep' | 'wave' | 'gameover' | 'victory'
  score: number
  spawnTimer: number
  spawned: number
  ws: number
  gameTime: number
  /** Frame time not yet spent on a whole step; see advance(). */
  pendingMs: number
  rng: () => number
}

export function createGame(
  map: { grid: Grid; path: Cell[]; cols: number; rows: number },
  difficulty: Difficulty,
  rng: () => number = Math.random,
): GameState {
  return {
    grid: map.grid,
    path: map.path,
    cols: map.cols,
    rows: map.rows,
    difficulty,
    towers: [],
    ants: [],
    gold: difficulty.startGold,
    lives: difficulty.lives,
    wave: 1,
    maxWaves: difficulty.waves,
    phase: 'prep',
    score: 0,
    spawnTimer: 0,
    spawned: 0,
    ws: waveSize(1),
    gameTime: 0,
    pendingMs: 0,
    rng,
  }
}

export function canPlace(g: GameState, row: number, col: number, tierIdx: number) {
  return (
    g.phase !== 'gameover' && g.phase !== 'victory' &&
    g.grid[row]?.[col] === FOREST &&
    !g.towers.some((t) => t.row === row && t.col === col) &&
    g.gold >= TIERS[tierIdx].cost
  )
}

export function placeTower(g: GameState, row: number, col: number, tierIdx: number): Tower | null {
  if (!canPlace(g, row, col, tierIdx)) return null
  const tier = TIERS[tierIdx]
  g.gold -= tier.cost
  const tower: Tower = {
    row, col, tierId: tier.id, tierIdx, level: 1, range: tier.range, cooldown: tier.cooldown,
    splash: tier.splash, slow: tier.slow, lastFired: 0, state: 'idle', attackTimer: 0,
    id: g.rng() * 1e9, hue: tier.hueBase + Math.floor(g.rng() * 30 - 15),
  }
  g.towers.push(tower)
  return tower
}

export function upgradeTower(g: GameState, tower: Tower): boolean {
  const cost = upgradeCost(TIERS[tower.tierIdx], tower.level)
  if (g.gold < cost) return false
  g.gold -= cost
  tower.level++
  return true
}

export function sellValue(tower: Tower) {
  const tier = TIERS[tower.tierIdx]
  let invested = tier.cost
  for (let l = 1; l < tower.level; l++) invested += upgradeCost(tier, l)
  return Math.floor(invested * SELL_REFUND)
}

export function startWave(g: GameState): boolean {
  if (g.phase !== 'prep') return false
  g.phase = 'wave'
  g.spawned = 0
  g.spawnTimer = 0
  g.ants = []
  g.pendingMs = 0
  return true
}

/** What the canvas needs to animate a shot or a kill; the rules ignore them. */
export type StepHooks = {
  onShot?: (tower: Tower, at: Cell, killed: boolean) => void
  onKill?: (at: Cell) => void
}

export type StepEvent = 'wave_cleared' | 'victory' | 'gameover' | null

/** Advances the wave by `dt` ms of game time. */
export function stepGame(g: GameState, dt: number, hooks: StepHooks = {}): StepEvent {
  if (g.phase !== 'wave') return null
  g.gameTime += dt
  const { hpMult, speedMult } = g.difficulty

  g.spawnTimer -= dt
  if (g.spawnTimer <= 0 && g.spawned < g.ws) {
    g.spawnTimer = spawnInterval(g.wave)
    const hp = Math.floor(antHp(g.wave) * hpMult)
    g.ants.push({
      t: 0, hp, maxHp: hp, id: g.gameTime + g.rng(),
      speed: antSpeed(g.wave) * speedMult * (0.85 + g.rng() * 0.3),
      dead: false, deathTime: 0, variant: g.rng() * 100, slow: 0,
    })
    g.spawned++
  }

  for (const ant of g.ants) {
    if (ant.dead) { ant.deathTime += dt; continue }
    ant.t += ant.speed * (ant.slow > 0 ? 0.5 : 1) * (dt / 16)
    if (ant.slow > 0) ant.slow -= dt
    if (ant.t >= g.path.length - 1) {
      ant.dead = true
      ant.deathTime = 999
      g.lives = Math.max(0, g.lives - 1)
    }
  }

  const kill = (ant: Ant, at: Cell) => {
    ant.dead = true
    ant.deathTime = 0
    g.gold += killReward(g.wave)
    g.score += 10 + g.wave * 3
    hooks.onKill?.(at)
  }

  for (const tower of g.towers) {
    if (tower.state === 'attack') {
      tower.attackTimer += dt
      if (tower.attackTimer > 300) tower.state = 'idle'
      continue
    }
    if (g.gameTime - tower.lastFired < tower.cooldown) continue
    const dmg = towerDmg(TIERS[tower.tierIdx], tower.level)
    let closest: Ant | null = null
    let cDist = Infinity
    for (const ant of g.ants) {
      if (ant.dead) continue
      const d = dist(lerpPath(g.path, ant.t), tower)
      if (d <= tower.range && d < cDist) { closest = ant; cDist = d }
    }
    if (!closest) continue
    tower.lastFired = g.gameTime
    tower.state = 'attack'
    tower.attackTimer = 0
    const at = lerpPath(g.path, closest.t)
    closest.hp -= dmg
    if (tower.slow) closest.slow = tower.slow
    if (tower.splash > 0) {
      for (const a2 of g.ants) {
        if (a2.dead || a2 === closest) continue
        const p2 = lerpPath(g.path, a2.t)
        if (dist(p2, at) < tower.splash) {
          a2.hp -= Math.floor(dmg * 0.5)
          if (a2.hp <= 0) kill(a2, p2)
        }
      }
    }
    const killed = closest.hp <= 0 && !closest.dead
    hooks.onShot?.(tower, at, killed)
    if (killed) kill(closest, at)
  }

  g.ants = g.ants.filter((a) => !(a.dead && a.deathTime > 500))

  if (g.spawned >= g.ws && g.ants.every((a) => a.dead)) {
    if (g.lives <= 0) {
      g.phase = 'gameover'
      return 'gameover'
    }
    if (g.wave >= g.maxWaves) {
      g.phase = 'victory'
      g.score += g.lives * 100 + g.gold
      return 'victory'
    }
    g.wave++
    g.gold += waveBonus(g.wave - 1)
    g.phase = 'prep'
    g.ws = waveSize(g.wave)
    g.ants = []
    g.gameTime = 0
    for (const t of g.towers) t.lastFired = 0
    return 'wave_cleared'
  }
  return null
}

/** Game time covered by one combat step. */
export const STEP_MS = 16

/**
 * Advances by a frame's worth of game time using fixed STEP_MS steps, carrying
 * any remainder to the next frame. A tower fires at most once per step and ants
 * move a whole step at a time, so one big step (a 3× speed frame on a slow
 * device covers 300 ms) let ants cross a tower's range between checks: level 1
 * with five Apprentices was won at 16–100 ms steps and lost at 150 ms. With a
 * fixed step the outcome is identical at any frame rate or game speed.
 */
export function advance(g: GameState, dt: number, hooks: StepHooks = {}): StepEvent {
  g.pendingMs += dt
  while (g.pendingMs >= STEP_MS && g.phase === 'wave') {
    g.pendingMs -= STEP_MS
    const event = stepGame(g, STEP_MS, hooks)
    if (event) {
      g.pendingMs = 0
      return event
    }
  }
  return null
}

/** Rough "can this defense hold?" read shown when a wave starts. */
export function analyzeBalance(g: GameState) {
  const { hpMult, speedMult } = g.difficulty
  const totalHp = Math.floor(antHp(g.wave) * hpMult) * waveSize(g.wave)
  const speed = antSpeed(g.wave) * speedMult
  let totalDps = 0
  for (const t of g.towers) {
    const tier = TIERS[t.tierIdx]
    const exposure = ((tier.range * 2) / (speed / 0.016)) * 60
    totalDps += towerDPS(tier, t.level) * Math.min(exposure, 8)
  }
  const ratio = g.towers.length > 0 ? totalDps / (totalHp / 10) : 0
  return { totalHp, totalDps: Math.floor(totalDps), ratio: Math.round(ratio * 100) / 100 }
}
