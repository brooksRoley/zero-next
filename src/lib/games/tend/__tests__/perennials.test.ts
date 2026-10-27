import { describe, it, expect } from 'vitest'
import { checkIn, newGarden, resolveSeasons, type GardenState } from 'src/lib/games/tend/engine'
import { dateToDay, importHabits, parseHabitFile, type HabitFile } from 'src/lib/games/tend/habitImport'
import {
  byBranch,
  isPermanent,
  mergePerennials,
  parseSkills,
  perennialStage,
  type Perennial,
} from 'src/lib/games/tend/perennials'
import { sampleGarden } from 'src/lib/games/tend/sample'
import { isGardenState, loadGarden } from 'src/lib/games/tend/storage'

/**
 * M3 of the job-search garden: the skill tree from the habit file (version 3)
 * drawn as perennials, which only ever grow and never reset.
 */

const D = dateToDay('2026-10-20') as number
const node = (id: string, branch: string, dates: (string | null)[], name = id) => ({
  id,
  name,
  branch,
  rungs: dates.length,
  unlocked: dates.filter((d) => d !== null).length,
  dates,
})
const file = (version: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'tend-habits', version, days: { '2026-10-20': ['body'] }, ...extra })
const v3 = (skills: unknown[], days: Record<string, string[]> = {}) =>
  parseHabitFile(JSON.stringify({ format: 'tend-habits', version: 3, days, results: {}, skills })) as HabitFile

const TREE = [
  node('typescript', 'Frontend', ['', null, null, null], 'TypeScript'),
  node('nextjs', 'Frontend', ['', '2026-10-01', null, null], 'Next.js'),
  node('search-relevance', 'Search + AI', [null, null, null, null], 'Search relevance'),
]

describe('habit file versions', () => {
  it('reads version 1, 2 and 3 files', () => {
    const one = parseHabitFile(file(1))
    expect(one?.version).toBe(1)
    expect(one?.skills).toBeNull()
    const two = parseHabitFile(file(2, { days: { '2026-10-20': ['search'] }, results: { '2026-10-20': ['reply'] } }))
    expect(two?.days['2026-10-20']).toEqual(['search'])
    expect(two?.results['2026-10-20']).toEqual(['reply'])
    expect(two?.skills).toBeNull()
    const three = parseHabitFile(file(3, { results: { '2026-10-20': ['screen'] }, skills: TREE }))
    expect(three?.version).toBe(3)
    expect(three?.results['2026-10-20']).toEqual(['screen'])
    expect(three?.skills?.map((p) => p.id)).toEqual(['typescript', 'nextjs', 'search-relevance'])
    expect(three?.skills?.[1].dates).toEqual(['', '2026-10-01', null, null])
  })

  it('a version 3 file without skills is fine, and only version 3 may carry them', () => {
    expect(parseHabitFile(file(3))?.skills).toBeNull()
    // Older versions never carried a tree, so one there is ignored, not trusted.
    expect(parseHabitFile(file(2, { skills: TREE }))?.skills).toBeNull()
    expect(parseHabitFile(file(4, { skills: TREE }))).toBeNull()
  })

  it('refuses a skill tree the tool would not have written', () => {
    const bad = [
      'not a list',
      [{ ...TREE[0], unlocked: 3 }], // count disagrees with the slots
      [{ ...TREE[0], dates: ['', null] }], // slots disagree with rungs
      [{ ...TREE[0], dates: ['2026-13-40', null, null, null] }], // not a date
      [{ ...TREE[0], dates: ['yesterday', null, null, null] }],
      [{ ...TREE[0], id: 'Has Spaces' }],
      [TREE[0], TREE[0]], // duplicate id
      [{ ...TREE[0], name: 'https://github.com/someone/repo' }], // a link is never a skill name
      [{ ...TREE[0], name: '' }],
      [{ ...TREE[0], branch: 'x'.repeat(41) }],
      [node('a', 'B', Array(9).fill(null))], // more rungs than any tree has
      Array.from({ length: 121 }, (_, i) => node(`n${i}`, 'B', [null])),
    ]
    for (const skills of bad) {
      expect(parseSkills(skills), JSON.stringify(skills).slice(0, 80)).toBeNull()
      expect(parseHabitFile(file(3, { skills }))).toBeNull()
    }
  })
})

describe('perennial stages', () => {
  const p = (dates: (string | null)[]): Perennial => ({ id: 'x', name: 'X', branch: 'B', dates })

  it('grow a stage per rung, and every rung makes a permanent tree', () => {
    expect(perennialStage(p([null, null, null, null]))).toBe(0)
    expect(perennialStage(p(['', null, null, null]))).toBe(1)
    // Rungs are independent: a design note alone is one rung, not the top one.
    expect(perennialStage(p([null, null, null, '2026-10-20']))).toBe(1)
    expect(perennialStage(p(['', '', '2026-10-20', null]))).toBe(3)
    expect(isPermanent(p(['', '', '2026-10-20', null]))).toBe(false)
    expect(perennialStage(p(['', '', '2026-10-20', '2026-10-21']))).toBe(4)
    expect(isPermanent(p(['', '', '2026-10-20', '2026-10-21']))).toBe(true)
  })

  it('only a fully open node reaches the top stage, whatever its size', () => {
    expect(perennialStage(p(['', '', null]))).toBe(2)
    expect(perennialStage(p(['', '', '']))).toBe(4)
    expect(perennialStage(p(['', null]))).toBe(2)
  })

  it('group by branch in the order the file lists them', () => {
    expect(byBranch(parseSkills(TREE)!).map((g) => [g.branch, g.nodes.length])).toEqual([
      ['Frontend', 2],
      ['Search + AI', 1],
    ])
  })
})

describe('importing a skill tree', () => {
  it('adds perennials to the garden and counts the rungs it opened', () => {
    const r = importHabits(newGarden(D), v3(TREE), D)
    expect(r.state.perennials?.map((p) => p.id)).toEqual(['typescript', 'nextjs', 'search-relevance'])
    expect(r.rungs).toBe(3)
    // Perennials are not beds and earn no seeds.
    expect(r.state.beds).toEqual([])
    expect(r.state.seeds).toEqual([])
  })

  it('is idempotent: the same file twice changes nothing more', () => {
    const once = importHabits(newGarden(D - 5), v3(TREE, { [String('2026-10-18')]: ['craft'] }), D)
    const twice = importHabits(once.state, v3(TREE, { '2026-10-18': ['craft'] }), D)
    expect(twice.state).toEqual(once.state)
    expect(twice.state.perennials).toBe(once.state.perennials)
    expect(twice.rungs).toBe(0)
    expect(twice.added + twice.merged).toBe(0)
  })

  it('never takes a rung away, never drops a node and never moves a date later', () => {
    const first = importHabits(newGarden(D), v3(TREE), D).state
    const later = v3([
      node('typescript', 'Frontend', [null, '2026-10-25', null, null], 'TypeScript'),
      node('nextjs', 'Frontend', ['', '2026-10-15', '2026-10-19', null], 'Next.js'),
    ])
    const r = importHabits(first, later, D)
    const by = Object.fromEntries((r.state.perennials ?? []).map((p) => [p.id, p.dates]))
    expect(by.typescript).toEqual(['', '2026-10-25', null, null])
    expect(by.nextjs).toEqual(['', '2026-10-01', '2026-10-19', null])
    expect(by['search-relevance']).toEqual([null, null, null, null])
    expect(r.rungs).toBe(2)
  })

  it('a real date replaces an unknown one, and a node can be renamed', () => {
    const { perennials } = mergePerennials(
      [{ id: 'llm', name: 'LLM', branch: 'AI', dates: ['', null] }],
      [{ id: 'llm', name: 'LLM integration', branch: 'Search + AI', dates: ['2026-09-09', null] }],
    )
    expect(perennials).toEqual([{ id: 'llm', name: 'LLM integration', branch: 'Search + AI', dates: ['2026-09-09', null] }])
  })

  it('a file without skills leaves the perennials alone, and seasons never touch them', () => {
    const g = importHabits(newGarden(D - 20), v3(TREE), D - 20).state
    const after = importHabits(g, parseHabitFile(file(2))!, D).state
    expect(after.perennials).toBe(g.perennials)
    let tended: GardenState = after
    for (let d = D - 19; d <= D; d++) tended = checkIn(tended, d, [])
    const weathered = resolveSeasons(tended, D)
    expect(weathered.seasons.length).toBeGreaterThan(0)
    expect(weathered.perennials).toEqual(g.perennials)
  })
})

describe('saves', () => {
  const store = (v: unknown) => ({ getItem: () => JSON.stringify(v) })

  it('an old save with no perennials still loads, as the same garden', () => {
    const old = checkIn(newGarden(D), D, ['body', 'joy'])
    expect('perennials' in old).toBe(false)
    expect(loadGarden(store(old))).toEqual(old)
    // An M1 save, with the opt-in lanes and results.
    const m1 = { ...old, extraLanes: ['search'], results: { [String(D)]: ['reply'] } }
    expect(loadGarden(store(m1))).toEqual(m1)
  })

  it('a save with perennials round-trips, and a corrupted one starts fresh', () => {
    const g = importHabits(newGarden(D), v3(TREE), D).state
    expect(loadGarden(store(g))).toEqual(g)
    expect(isGardenState({ ...g, perennials: [{ id: 'x', name: 'X', branch: 'B', dates: ['soon'] }] })).toBe(false)
    expect(isGardenState({ ...g, perennials: 'tree' })).toBe(false)
  })

  it('the sample garden and a new garden have no perennials', () => {
    expect(sampleGarden(20_000).perennials).toBeUndefined()
    expect(newGarden(D).perennials).toBeUndefined()
  })
})
