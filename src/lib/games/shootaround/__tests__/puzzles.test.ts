import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { edgeKey } from 'src/lib/games/passcut/graph'
import {
  CAP,
  COPIES_FOR_STAR,
  READ_MARGIN,
  STATIONS,
  checkCapSpace,
  checkCut,
  copiesAfterBuying,
  countCopies,
  dailySet,
  dominatesEveryColumn,
  greedyByRating,
  knapsack,
  makeCapSpace,
  makeCutLanes,
  makeReadDefense,
  makeStarUp,
  multiply,
  questRoster,
  rating,
  seedFor,
} from '../puzzles'

// The real roster Hardwood ships with, so the quest is tested on the data players see.
const ROSTER = questRoster(
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/hardwood/engine_roster.json'), 'utf8')),
)

/** Every subset, for checking the DP against brute force. */
function bruteKnapsack(items: { cost: number; value: number }[], budget: number): number {
  let best = 0
  for (let mask = 0; mask < 1 << items.length; mask++) {
    let cost = 0
    let value = 0
    items.forEach((it, i) => {
      if (mask & (1 << i)) {
        cost += it.cost
        value += it.value
      }
    })
    if (cost <= budget) best = Math.max(best, value)
  }
  return best
}

const DAYS = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(2026, 10, 1 + i)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

describe('the roster', () => {
  it('reads Hardwood’s shipped roster', () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(8)
    for (const p of ROSTER) expect(p.cost).toBeGreaterThanOrEqual(1)
  })

  it('drops inactive and malformed entries', () => {
    const base = { id: 1, name: 'A', team: 'X', cost: 2, stats: { shooting: 1, speed: 2, defense: 3 } }
    expect(questRoster([base, { ...base, id: 2, is_active: false }, { id: 3 }, null])).toEqual([base])
    expect(questRoster('nope')).toEqual([])
  })
})

describe('seeds', () => {
  it('are stable per day and station, and differ between them', () => {
    expect(seedFor('2026-11-05', 'starUp')).toBe(seedFor('2026-11-05', 'starUp'))
    expect(seedFor('2026-11-05', 'starUp')).not.toBe(seedFor('2026-11-06', 'starUp'))
    expect(seedFor('2026-11-05', 'starUp')).not.toBe(seedFor('2026-11-05', 'capSpace'))
  })

  it('give everyone the same puzzles on the same day', () => {
    expect(dailySet('2026-11-05', ROSTER)).toEqual(dailySet('2026-11-05', ROSTER))
  })
})

describe('Star-up (hash map)', () => {
  it.each(DAYS)('%s has exactly one shop card that makes a ★★', (day) => {
    const p = makeStarUp(ROSTER, seedFor(day, 'starUp'))
    expect(p.bench).toHaveLength(8)
    expect(p.shop).toHaveLength(5)
    const completes = p.shop.filter((c) => copiesAfterBuying(p.bench, c.id) === COPIES_FOR_STAR)
    expect(completes.map((c) => c.id)).toEqual([p.answer])
  })

  it('has a decoy pair on the bench that is not in the shop', () => {
    const p = makeStarUp(ROSTER, 7)
    const pairs = [...countCopies(p.bench).values()].filter((c) => c.copies === 2)
    expect(pairs).toHaveLength(2)
    expect(pairs.filter((c) => p.shop.some((s) => s.id === c.player.id))).toHaveLength(1)
  })

  it('counts copies in first-seen order', () => {
    const [a, b] = ROSTER
    const counts = countCopies([b, a, b])
    expect([...counts.values()].map((c) => [c.player.id, c.copies])).toEqual([
      [b.id, 2],
      [a.id, 1],
    ])
  })
})

describe('Cap space (knapsack)', () => {
  it('matches brute force on every day', () => {
    for (const day of DAYS) {
      const board = makeCapSpace(ROSTER, seedFor(day, 'capSpace'))
      expect(board.solution.value).toBe(bruteKnapsack(board.items, CAP))
      expect(checkCapSpace(board, board.solution.pick)).toEqual({ ok: true, value: board.solution.value })
    }
  })

  it('usually makes the greedy shortcut fall short', () => {
    const traps = DAYS.filter((day) => {
      const b = makeCapSpace(ROSTER, seedFor(day, 'capSpace'))
      return b.greedyValue < b.solution.value
    })
    expect(traps.length).toBeGreaterThanOrEqual(DAYS.length * 0.8)
  })

  it('never offers a board where everyone fits under the cap', () => {
    for (const day of DAYS) {
      const b = makeCapSpace(ROSTER, seedFor(day, 'capSpace'))
      expect(b.items.reduce((s, it) => s + it.cost, 0)).toBeGreaterThan(CAP)
    }
  })

  it('rejects an over-cap roster and a short one', () => {
    const board = makeCapSpace(ROSTER, seedFor('2026-11-05', 'capSpace'))
    const all = board.items.map((_, i) => i)
    expect(checkCapSpace(board, all)).toMatchObject({ ok: false, reason: 'over' })
    expect(checkCapSpace(board, [])).toMatchObject({ ok: false, reason: 'short', value: 0 })
  })

  it('reconstructs a pick that is within budget', () => {
    const items = [
      { cost: 5, value: 60 },
      { cost: 4, value: 50 },
      { cost: 3, value: 45 },
      { cost: 3, value: 44 },
    ]
    const k = knapsack(items, 10)
    expect(k.value).toBe(139)
    expect(k.pick).toEqual([1, 2, 3])
    expect(greedyByRating(items, 10)).toEqual([0, 1])
    expect(k.best[10]).toBe(139)
  })

  it('rates a player as the mean of their three stats', () => {
    expect(rating({ id: 0, name: '', team: '', cost: 1, stats: { shooting: 70, speed: 60, defense: 50 } })).toBe(60)
  })
})

describe('Cut the lanes (min cut)', () => {
  it.each(DAYS.slice(0, 20))('%s picks a board that needs two or more cuts', (day) => {
    const b = makeCutLanes(seedFor(day, 'cutLanes'))
    expect(b.minCut.length).toBeGreaterThanOrEqual(2)
    expect(checkCut(b, new Set(b.minCut.map((e) => edgeKey(e.a, e.b))))).toEqual({ ok: true, size: b.minCut.length })
  })

  it('says when the lanes are still open, and when a cut is bigger than it needs to be', () => {
    const b = makeCutLanes(1)
    expect(checkCut(b, new Set())).toMatchObject({ ok: false, reason: 'open' })
    const everything = new Set(b.edges.map((e) => edgeKey(e.a, e.b)))
    expect(checkCut(b, everything)).toMatchObject({ ok: false, reason: 'extra', min: b.minCut.length })
  })
})

describe('Read the defense (matrix × vector)', () => {
  it('multiplies a matrix by a vector', () => {
    expect(multiply([[1, 2], [3, 4]], [0.5, 0.5])).toEqual([1.5, 3.5])
  })

  it.each(DAYS)('%s has one clearly best play against the scouting mix', (day) => {
    const b = makeReadDefense(seedFor(day, 'readD'))
    expect(b.mix.reduce((s, x) => s + x, 0)).toBeCloseTo(1)
    expect(b.mix).toHaveLength(b.level.schemes.length)
    const others = b.expected.filter((_, i) => i !== b.answer)
    for (const v of others) expect(b.expected[b.answer] - v).toBeGreaterThanOrEqual(READ_MARGIN)
  })

  it.each(DAYS)('%s needs the scouting report: no play wins every column by itself', (day) => {
    const b = makeReadDefense(seedFor(day, 'readD'))
    expect(dominatesEveryColumn(b.matrix, b.answer)).toBe(false)
  })

  it('spots a dominant play', () => {
    expect(dominatesEveryColumn([[1.12, 1.2], [0.88, 0.84]], 0)).toBe(true)
    expect(dominatesEveryColumn([[1.2, 0.9], [1.0, 1.1]], 0)).toBe(false)
  })
})

describe('the lineup', () => {
  it('covers data structures, algorithms, graph theory and linear algebra, then a Hardwood round', () => {
    expect(STATIONS.map((s) => s.track)).toEqual([
      'Data structures',
      'Algorithms',
      'Graph theory',
      'Linear algebra',
      'The game',
    ])
    expect(STATIONS.at(-1)?.game).toBe('Hardwood')
  })
})
