/**
 * Shootaround — the daily quest's puzzles, as pure data and checkers.
 *
 * Every station borrows a real rule from one of the site's games and teaches
 * the computer-science or math idea underneath it:
 *
 *   starUp    Hardwood's three-copies-make-a-★★ rule      → hash maps (data structures)
 *   capSpace  Hardwood's 10G salary cap                    → 0/1 knapsack, dynamic programming
 *   cutLanes  Pass & Cut's passing graphs                  → minimum cut (graph theory)
 *   readD     Read & React's payoff matrices               → matrix × vector (linear algebra)
 *
 * The fifth station is a real Hardwood round; see progress.ts.
 *
 * Generators are seeded, so everyone gets the same puzzles on the same day and
 * a test can replay any day. No React, no DOM, no storage.
 */
import { LEVELS as PASSCUT_LEVELS } from 'src/lib/games/passcut/levels'
import { canonicalEdges, connected, edgeKey, minimalCut, type Edge, type EdgeKey, type Level as CutLevel } from 'src/lib/games/passcut/graph'
import { LEVELS as READREACT_LEVELS, evMatrix, type RRLevel } from 'src/lib/games/readreact/levels'

export type QuestStats = { shooting: number; speed: number; defense: number }

/** The fields the quest needs from a Hardwood roster entry (public/hardwood/engine_roster.json). */
export type QuestPlayer = { id: number; name: string; team: string; cost: number; stats: QuestStats }

// ── Seeded randomness ─────────────────────────────────────────────

/** FNV-1a over a string: the day and the station name become a 32-bit seed. */
export function seedFor(day: string, salt: string): number {
  let h = 0x811c9dc5
  for (const ch of `${day}:${salt}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast, and the same sequence on every browser. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], r: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Roster entries usable in a puzzle: active players with a real cost and stats. */
export function questRoster(raw: unknown): QuestPlayer[] {
  if (!Array.isArray(raw)) return []
  const out: QuestPlayer[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const { id, name, team, cost, stats, is_active } = p as Record<string, unknown>
    const s = stats as Record<string, unknown> | undefined
    if (is_active === false) continue
    if (typeof id !== 'number' || typeof name !== 'string' || typeof team !== 'string' || typeof cost !== 'number') continue
    if (!s || typeof s.shooting !== 'number' || typeof s.speed !== 'number' || typeof s.defense !== 'number') continue
    out.push({ id, name, team, cost, stats: { shooting: s.shooting, speed: s.speed, defense: s.defense } })
  }
  return out
}

/** One number per player for the quest: the mean of shooting, speed and defense. */
export const rating = (p: QuestPlayer) => Math.round((p.stats.shooting + p.stats.speed + p.stats.defense) / 3)

// ── Station 1: Star-up (hash map) ─────────────────────────────────

/** Hardwood: three copies of one player merge into a ★★ with ×1.8 stats. */
export const COPIES_FOR_STAR = 3

export type StarUp = {
  /** Your bench, in the order a player would scan it. */
  bench: QuestPlayer[]
  /** Five shop cards; exactly one is the third copy of a benched player. */
  shop: QuestPlayer[]
  /** Id of the shop card that completes a ★★. */
  answer: number
}

export function makeStarUp(roster: QuestPlayer[], seed: number): StarUp {
  if (roster.length < 8) throw new Error('Star-up needs at least 8 players')
  const r = rng(seed)
  // A and B sit on the bench twice; only A is in the shop. D and E are in both, once each:
  // buying either makes a pair, not a ★★. H and I are new faces.
  const [a, b, d, e, f, g, h, i] = shuffle(roster, r).slice(0, 8)
  return {
    bench: shuffle([a, a, b, b, d, e, f, g], r),
    shop: shuffle([a, d, e, h, i], r),
    answer: a.id,
  }
}

/** The hash map a player builds in one pass over the bench: name → copies, in first-seen order. */
export function countCopies(bench: QuestPlayer[]): Map<number, { player: QuestPlayer; copies: number }> {
  const counts = new Map<number, { player: QuestPlayer; copies: number }>()
  for (const p of bench) {
    const seen = counts.get(p.id)
    if (seen) seen.copies += 1
    else counts.set(p.id, { player: p, copies: 1 })
  }
  return counts
}

/** What buying `id` would make: the copies you'd own afterwards. */
export function copiesAfterBuying(bench: QuestPlayer[], id: number): number {
  return (countCopies(bench).get(id)?.copies ?? 0) + 1
}

// ── Station 2: Cap space (0/1 knapsack) ───────────────────────────

/** Hardwood's opening salary cap. */
export const CAP = 10

export type Knapsack = {
  /** Best total rating within the budget. */
  value: number
  /** Indices of one best set, ascending. */
  pick: number[]
  /** best[g]: the best rating any subset can reach spending at most g gold. */
  best: number[]
}

/** Exact 0/1 knapsack by dynamic programming over (items × gold). */
export function knapsack(items: { cost: number; value: number }[], budget: number): Knapsack {
  const n = items.length
  // table[i][g]: best value using the first i items with at most g gold.
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(budget + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    const { cost, value } = items[i - 1]
    for (let g = 0; g <= budget; g++) {
      table[i][g] = table[i - 1][g]
      if (cost <= g) table[i][g] = Math.max(table[i][g], table[i - 1][g - cost] + value)
    }
  }
  const pick: number[] = []
  let g = budget
  for (let i = n; i >= 1; i--) {
    if (table[i][g] !== table[i - 1][g]) {
      pick.push(i - 1)
      g -= items[i - 1].cost
    }
  }
  return { value: table[n][budget], pick: pick.reverse(), best: table[n].slice() }
}

/** The tempting shortcut: sign the best-rated players first, while they fit. */
export function greedyByRating(items: { cost: number; value: number }[], budget: number): number[] {
  const order = items.map((_, i) => i).sort((x, y) => items[y].value - items[x].value || x - y)
  const pick: number[] = []
  let left = budget
  for (const i of order) {
    if (items[i].cost <= left) {
      pick.push(i)
      left -= items[i].cost
    }
  }
  return pick.sort((x, y) => x - y)
}

export type CapItem = { player: QuestPlayer; cost: number; value: number }
export type CapSpace = { items: CapItem[]; budget: number; solution: Knapsack; greedyValue: number }

const sumOf = (items: CapItem[], pick: number[], key: 'cost' | 'value') => pick.reduce((s, i) => s + items[i][key], 0)

/**
 * Six free agents and a 10G cap. Prefers a board where signing the best-rated
 * players first comes up short, so the lesson (greedy isn't optimal) is real.
 */
export function makeCapSpace(roster: QuestPlayer[], seed: number): CapSpace {
  if (roster.length < 6) throw new Error('Cap space needs at least 6 players')
  const r = rng(seed)
  let fallback: CapSpace | null = null
  for (let attempt = 0; attempt < 60; attempt++) {
    const items = shuffle(roster, r)
      .slice(0, 6)
      .map((player) => ({ player, cost: player.cost, value: rating(player) }))
    const total = items.reduce((s, it) => s + it.cost, 0)
    if (total <= CAP) continue // everyone fits: no choice to make
    const solution = knapsack(items, CAP)
    const greedyValue = sumOf(items, greedyByRating(items, CAP), 'value')
    const board = { items, budget: CAP, solution, greedyValue }
    if (greedyValue < solution.value) return board
    fallback ??= board
  }
  if (!fallback) throw new Error('Cap space could not build a board')
  return fallback
}

export type CapVerdict =
  | { ok: true; value: number }
  | { ok: false; reason: 'over' | 'short'; value: number; cost: number }

export function checkCapSpace(board: CapSpace, pick: number[]): CapVerdict {
  const cost = sumOf(board.items, pick, 'cost')
  const value = sumOf(board.items, pick, 'value')
  if (cost > board.budget) return { ok: false, reason: 'over', value, cost }
  if (value < board.solution.value) return { ok: false, reason: 'short', value, cost }
  return { ok: true, value }
}

// ── Station 3: Cut the lanes (minimum cut) ────────────────────────

export type CutLanes = { level: CutLevel; edges: Edge[]; minCut: Edge[] }

/** A Pass & Cut board where the defense needs at least two cuts: one-cut boards teach nothing new. */
export function makeCutLanes(seed: number): CutLanes {
  const boards = PASSCUT_LEVELS.map((level) => {
    const edges = canonicalEdges(level.edges)
    return { level, edges, minCut: minimalCut(edges, level.terminals) }
  }).filter((b) => b.minCut.length >= 2)
  return boards[Math.floor(rng(seed)() * boards.length)]
}

export type CutVerdict =
  | { ok: true; size: number }
  | { ok: false; reason: 'open' | 'extra'; size: number; min: number }

export function checkCut(board: CutLanes, cut: ReadonlySet<EdgeKey>): CutVerdict {
  const min = board.minCut.length
  const left = board.edges.filter((e) => !cut.has(edgeKey(e.a, e.b)))
  if (connected(board.level.terminals, left)) return { ok: false, reason: 'open', size: cut.size, min }
  if (cut.size > min) return { ok: false, reason: 'extra', size: cut.size, min }
  return { ok: true, size: cut.size }
}

// ── Station 4: Read the defense (matrix × vector) ─────────────────

const MIXES_2 = [
  [0.7, 0.3],
  [0.3, 0.7],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.6, 0.4],
  [0.4, 0.6],
]
const MIXES_3 = [
  [0.5, 0.3, 0.2],
  [0.2, 0.5, 0.3],
  [0.3, 0.2, 0.5],
  [0.6, 0.2, 0.2],
  [0.2, 0.6, 0.2],
  [0.2, 0.2, 0.6],
]

/** Smallest gap between the best play and the next, so rounding never decides the answer. */
export const READ_MARGIN = 0.03

export type ReadDefense = {
  level: RRLevel
  /** A[play][scheme]: points per trip, Read & React's EV matrix. */
  matrix: number[][]
  /** The scouting report: how often the defense calls each scheme (sums to 1). */
  mix: number[]
  /** A·mix: expected points per trip for each play. */
  expected: number[]
  answer: number
}

/** y = A·x — each entry is one row of A dotted with x. */
export function multiply(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0))
}

/** True when play `row` scores at least as well as every other play against every coverage. */
export function dominatesEveryColumn(A: number[][], row: number): boolean {
  return A[0].every((_, j) => A.every((r) => A[row][j] >= r[j]))
}

export function makeReadDefense(seed: number): ReadDefense {
  const r = rng(seed)
  const levels = shuffle(READREACT_LEVELS, r)
  for (const level of levels) {
    const matrix = evMatrix(level)
    const mixes = shuffle(level.schemes.length === 2 ? MIXES_2 : MIXES_3, r)
    for (const mix of mixes) {
      if (mix.length !== level.schemes.length) continue
      const expected = multiply(matrix, mix)
      const order = expected.map((_, i) => i).sort((a, b) => expected[b] - expected[a])
      // If the best play also wins every column on its own, the scouting report doesn't
      // matter and there's no multiplying to do. Those boards stay in Read & React.
      if (dominatesEveryColumn(matrix, order[0])) continue
      if (expected[order[0]] - expected[order[1]] >= READ_MARGIN) {
        return { level, matrix, mix, expected, answer: order[0] }
      }
    }
  }
  throw new Error('Read the defense could not build a board')
}

// ── The day's lineup ──────────────────────────────────────────────

export type StationId = 'starUp' | 'capSpace' | 'cutLanes' | 'readD' | 'hardwood'

export type StationInfo = {
  id: StationId
  title: string
  /** The CS or math track this station teaches. */
  track: 'Data structures' | 'Algorithms' | 'Graph theory' | 'Linear algebra' | 'The game'
  /** Which game the rule comes from. */
  game: 'Hardwood' | 'Pass & Cut' | 'Read & React'
  concept: string
}

export const STATIONS: StationInfo[] = [
  { id: 'starUp', title: 'Star-up', track: 'Data structures', game: 'Hardwood', concept: 'Hash map: count in one pass' },
  { id: 'capSpace', title: 'Cap space', track: 'Algorithms', game: 'Hardwood', concept: 'Knapsack: dynamic programming' },
  { id: 'cutLanes', title: 'Cut the lanes', track: 'Graph theory', game: 'Pass & Cut', concept: 'Minimum cut' },
  { id: 'readD', title: 'Read the defense', track: 'Linear algebra', game: 'Read & React', concept: 'Matrix times vector' },
  { id: 'hardwood', title: 'Hardwood round', track: 'The game', game: 'Hardwood', concept: 'Use all four in a real fight' },
]

export type DailySet = { day: string; starUp: StarUp; capSpace: CapSpace; cutLanes: CutLanes; readD: ReadDefense }

export function dailySet(day: string, roster: QuestPlayer[]): DailySet {
  return {
    day,
    starUp: makeStarUp(roster, seedFor(day, 'starUp')),
    capSpace: makeCapSpace(roster, seedFor(day, 'capSpace')),
    cutLanes: makeCutLanes(seedFor(day, 'cutLanes')),
    readD: makeReadDefense(seedFor(day, 'readD')),
  }
}
