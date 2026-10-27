import { describe, it, expect } from 'vitest'
import {
  activeLanes,
  checkIn,
  newGarden,
  placeSeed,
  placementEffect,
  resolveDrought,
  resultLog,
  stageOf,
  type GardenState,
} from 'src/lib/games/tend/engine'
import { dateToDay, dayToDate, importHabits, parseHabitFile, type HabitFile } from 'src/lib/games/tend/habitImport'
import { LANES, orientations, PLANTS, type Cell, type PlantKind } from 'src/lib/games/tend/plants'
import { isGardenState, loadGarden } from 'src/lib/games/tend/storage'
import { effectText } from 'src/components/games/TendBoard'

/**
 * M1 of the job-search garden: two opt-in lanes (search grows toyon, study
 * grows buckwheat), an oak that speeds up a touching toyon, and results that
 * are recorded to be celebrated and never scored.
 */

const D = dateToDay('2026-10-20') as number
const v2 = (days: Record<string, string[]>, results?: Record<string, string[]>) =>
  parseHabitFile(JSON.stringify({ format: 'tend-habits', version: 2, days, ...(results ? { results } : {}) })) as HabitFile

/** Root one bed of `kind` at `anchor`, without a check-in. */
function root(g: GardenState, kind: PlantKind, anchor: Cell, day = D): GardenState {
  const id = `t${g.nextId}`
  const withSeed = { ...g, seeds: [...g.seeds, { id, kind, earnedDay: day }], nextId: g.nextId + 1 }
  const next = placeSeed(withSeed, id, orientations(kind)[0], anchor, day)
  expect(next.beds.length, `${kind} at ${anchor}`).toBe(g.beds.length + 1)
  return next
}

/** Empty check-ins on the days after `from`: each one is a tended day. */
function tend(g: GardenState, from: number, days: number): GardenState {
  for (let d = 1; d <= days; d++) g = checkIn(g, from + d, [])
  return g
}

describe('the opt-in lanes', () => {
  it('a garden that never imported them plays the same five lanes', () => {
    const g = newGarden(D)
    expect(activeLanes(g)).toEqual([...LANES])
    const next = checkIn(g, D, ['search', 'study', 'body'])
    expect(next.checkins[String(D)]).toEqual(['body'])
    expect(next.seeds.map((s) => s.kind)).toEqual(['oak'])
  })

  it('turned on, they check in after the five, each earning one seed of its plant', () => {
    const g = { ...newGarden(D), extraLanes: ['search' as const, 'study' as const] }
    expect(activeLanes(g)).toEqual([...LANES, 'search', 'study'])
    const next = checkIn(g, D, ['study', 'search', 'craft'])
    expect(next.checkins[String(D)]).toEqual(['craft', 'search', 'study'])
    expect(next.seeds.map((s) => s.kind)).toEqual(['vine', 'toyon', 'buckwheat'])
  })

  it('each new plant has its own bed shape, distinct from the five', () => {
    const key = (k: PlantKind) => JSON.stringify(orientations(k).map((o) => JSON.stringify(o)).sort())
    const shapes = (Object.keys(PLANTS) as PlantKind[]).map(key)
    expect(new Set(shapes).size).toBe(shapes.length)
    expect(PLANTS.toyon.note.source).toMatch(/^https:\/\/calscape\.org\//)
    expect(PLANTS.buckwheat.note.source).toMatch(/^https:\/\/calscape\.org\//)
  })
})

describe('lifting holds up the search', () => {
  const base = root(newGarden(D), 'oak', [0, 0])
  const beside = root(base, 'toyon', [2, 0]) // touches the oak along x = 1 → 2
  const alone = root(newGarden(D), 'toyon', [2, 0])

  it('a toyon touching an oak grows a stage sooner than one alone', () => {
    const a = tend(beside, D, 3)
    const b = tend(alone, D, 3)
    expect(stageOf(a, a.beds[1], D + 3)).toBe(2)
    expect(stageOf(b, b.beds[0], D + 3)).toBe(1)
  })

  it('shows in the preview, both ways', () => {
    const fromToyon = placementEffect(base, 'toyon', [[2, 0], [2, 1], [2, 2], [3, 2]])
    expect(fromToyon.self).toBe('helped')
    expect(effectText('toyon', fromToyon)).toBe('grows faster beside the oak')

    const withVine = root(alone, 'vine', [0, 3])
    const fromOak = placementEffect(withVine, 'oak', [[0, 1], [1, 1], [0, 2], [1, 2]])
    expect(fromOak.helps.map((b) => b.kind).sort()).toEqual(['toyon', 'vine'])
    expect(effectText('oak', fromOak)).toBe('speeds up 1 vine and 1 toyon')
  })

  it('a vine-only oak preview reads exactly as before', () => {
    const g = root(newGarden(D), 'vine', [2, 0])
    expect(effectText('oak', placementEffect(g, 'oak', [[0, 0], [1, 0], [0, 1], [1, 1]]))).toBe('speeds up 1 vine')
  })
})

describe('buckwheat is drought hardy', () => {
  it('holds through a drought on its own, and shelters nobody', () => {
    let g = root(newGarden(D), 'buckwheat', [0, 0])
    g = root(g, 'oak', [2, 0])
    const after = resolveDrought(g, D + 7)
    const [buck, oak] = g.beds
    expect(after.seasons[0].held).toEqual([buck.id])
    expect(after.seasons[0].hit).toEqual([oak.id])
  })

  it("a fern beside it isn't counted as help it doesn't need", () => {
    const g = root(newGarden(D), 'buckwheat', [0, 0])
    const effect = placementEffect(g, 'fern', [[2, 0], [3, 0], [1, 1], [2, 1]])
    expect(effect.helps).toEqual([])
  })
})

describe('importing a version 2 file', () => {
  it('still refuses the new lanes in a version 1 file', () => {
    const v1 = JSON.stringify({ format: 'tend-habits', version: 1, days: { '2026-10-20': ['search'] } })
    expect(parseHabitFile(v1)).toBeNull()
  })

  it('reads a version 1 file as having no results, even if it carries some', () => {
    const v1 = JSON.stringify({ format: 'tend-habits', version: 1, days: {}, results: { '2026-10-20': ['offer'] } })
    expect(parseHabitFile(v1)?.results).toEqual({})
  })

  it('refuses a result kind that is not one, such as a passed drill', () => {
    expect(parseHabitFile(JSON.stringify({ format: 'tend-habits', version: 2, days: {}, results: { '2026-10-20': ['drill_pass'] } }))).toBeNull()
    expect(parseHabitFile(JSON.stringify({ format: 'tend-habits', version: 2, days: {}, results: { yesterday: ['reply'] } }))).toBeNull()
  })

  it('turns on the lanes it uses, and back-fills their seeds', () => {
    const r = importHabits(newGarden(D), v2({ '2026-10-20': ['body', 'search'], '2026-10-21': ['study'] }), D + 3)
    expect(r.lanesOn).toEqual(['search', 'study'])
    expect(r.state.extraLanes).toEqual(['search', 'study'])
    expect(r.state.seeds.map((s) => s.kind)).toEqual(['oak', 'toyon', 'buckwheat'])
  })

  it('turns on only the lanes it holds, and none for a five-lane file', () => {
    const study = importHabits(newGarden(D), v2({ '2026-10-20': ['study'] }), D + 3)
    expect(study.state.extraLanes).toEqual(['study'])
    expect(activeLanes(study.state)).not.toContain('search')
    const plain = importHabits(newGarden(D), v2({ '2026-10-20': ['body'] }), D + 3)
    expect(plain.state.extraLanes).toBeUndefined()
  })

  it('suggests today’s search lane without checking in for the player', () => {
    const r = importHabits(newGarden(D), v2({ '2026-10-22': ['search'] }), D + 2)
    expect(r.today).toEqual(['search'])
    expect(r.state.seeds).toEqual([])
    expect(activeLanes(r.state)).toContain('search')
  })

  it('one seed per lane per day, however the day went: a file cannot buy volume', () => {
    const r = importHabits(newGarden(D), v2({ '2026-10-20': ['search', 'search', 'search'] }), D + 1)
    expect(r.state.seeds.map((s) => s.kind)).toEqual(['toyon'])
  })

  it('merges a search lane into a day already checked in', () => {
    const g = checkIn(newGarden(D), D, ['joy'])
    const r = importHabits(g, v2({ '2026-10-20': ['search'] }), D + 1)
    expect(r.merged).toBe(1)
    expect(r.state.checkins[String(D)]).toEqual(['joy', 'search'])
  })

  it('records results by day, celebrated and never scored', () => {
    let g = checkIn(newGarden(D), D, ['craft'])
    g = placeSeed(g, g.seeds[0].id, orientations('vine')[0], [0, 0], D)
    g = tend(g, D, 2)
    const r = importHabits(g, v2({}, { '2026-10-21': ['screen', 'reply'], '2026-10-22': ['offer'] }), D + 3)
    expect(r.results).toBe(3)
    expect(r.state.results).toEqual({ [String(D + 1)]: ['reply', 'screen'], [String(D + 2)]: ['offer'] })
    // Nothing else moves: no check-in, no seed, no growth.
    expect(r.state.checkins).toEqual(g.checkins)
    expect(r.state.seeds).toEqual(g.seeds)
    expect(stageOf(r.state, r.state.beds[0], D + 3)).toBe(stageOf(g, g.beds[0], D + 3))
    expect(resultLog(r.state)).toEqual([
      { day: D + 2, kind: 'offer' },
      { day: D + 1, kind: 'reply' },
      { day: D + 1, kind: 'screen' },
    ])
  })

  it('does not record a result from before the garden began or from the future', () => {
    const r = importHabits(newGarden(D), v2({}, { '2026-10-19': ['reply'], '2026-10-25': ['reply'] }), D + 2)
    expect(r.results).toBe(0)
    expect(r.state.results).toBeUndefined()
  })

  it('is idempotent, results and lanes included', () => {
    const file = v2({ '2026-10-20': ['search'], '2026-10-21': ['study', 'rest'] }, { '2026-10-21': ['reply'] })
    const once = importHabits(newGarden(D), file, D + 3)
    const twice = importHabits(once.state, file, D + 3)
    expect(twice.state).toEqual(once.state)
    expect(twice.added + twice.merged + twice.results + twice.lanesOn.length).toBe(0)
  })

  it('round-trips dates', () => {
    expect(dayToDate(D)).toBe('2026-10-20')
  })
})

describe('saves', () => {
  const memory = (value: unknown) => ({ getItem: () => JSON.stringify(value) })

  it('a save from before M1, without the new fields, still loads unchanged', () => {
    const old = { version: 1, startDay: D, size: 6, checkins: { [D]: ['body'] }, seeds: [], beds: [], dormancy: {}, seasons: [], nextId: 2, notes: ['oak'] }
    expect(loadGarden(memory(old))).toEqual(old)
  })

  it('a garden with opt-in lanes, their beds and results saves and loads', () => {
    let g: GardenState = { ...newGarden(D), extraLanes: ['search', 'study'] }
    g = checkIn(g, D, ['search', 'study'])
    g = root(g, 'toyon', [0, 0])
    g = { ...g, results: { [String(D)]: ['reply'] }, notes: ['toyon'] }
    expect(loadGarden(memory(g))).toEqual(g)
  })

  it('rejects a bad opt-in lane or result kind', () => {
    const g = newGarden(D)
    expect(isGardenState({ ...g, extraLanes: ['craft'] })).toBe(false)
    expect(isGardenState({ ...g, results: { [String(D)]: ['drill_pass'] } })).toBe(false)
    expect(isGardenState({ ...g, results: { yesterday: ['reply'] } })).toBe(false)
  })
})
