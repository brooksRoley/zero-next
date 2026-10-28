import { describe, it, expect } from 'vitest'
import {
  bloomCount,
  canPlace,
  checkIn,
  compostSeed,
  forecast,
  hasCheckedIn,
  isDormant,
  newGarden,
  nextSeasonDay,
  placeSeed,
  resolveSeasons,
  skyBlocked,
  stageOf,
  tendedDays,
  touching,
  type GardenState,
} from 'src/lib/games/tend/engine'
import { orientations, PLANTS, type Cell, type Lane } from 'src/lib/games/tend/plants'
import { dayIndex } from 'src/lib/games/tend/time'
import { isGardenState, loadGarden, saveGarden, STORAGE_KEY } from 'src/lib/games/tend/storage'
import { TUNING } from 'src/lib/games/tend/tuning'

const START = 20_000

/** Check in on `day` keeping `lanes`, then root every seed earned at the given anchors, in order. */
function plant(state: GardenState, day: number, lanes: Lane[], anchors: Cell[]): GardenState {
  let next = checkIn(state, day, lanes)
  for (const anchor of anchors) {
    const seed = next.seeds[0]
    next = placeSeed(next, seed.id, orientations(seed.kind)[0], anchor, day)
  }
  return next
}

/** Check in with no habits on each day in [from, to]. */
function tendThrough(state: GardenState, from: number, to: number): GardenState {
  let next = state
  for (let d = from; d <= to; d++) next = checkIn(next, d, [])
  return next
}

const bed = (state: GardenState, kind: string) => state.beds.find((b) => b.kind === kind)!

describe('plants', () => {
  it('has the right number of distinct orientations per bed shape', () => {
    expect(orientations('oak')).toHaveLength(1) // square
    expect(orientations('vine')).toHaveLength(2) // line
    expect(orientations('moonflower')).toHaveLength(4) // T
    expect(orientations('sunflower')).toHaveLength(1) // single
    expect(orientations('fern')).toHaveLength(2) // S
  })

  it('keeps cell counts through rotation', () => {
    for (const kind of Object.keys(PLANTS) as (keyof typeof PLANTS)[]) {
      for (const o of orientations(kind)) expect(o).toHaveLength(PLANTS[kind].shape.length)
    }
  })
})

describe('dayIndex', () => {
  it('counts 1am as the previous day and 5am as the new one', () => {
    const at = (h: number) => new Date(2026, 9, 15, h, 0, 0)
    expect(dayIndex(at(1))).toBe(dayIndex(at(23)) - 1) // 1am Oct 15 still belongs to Oct 14
    expect(dayIndex(at(1))).toBe(dayIndex(new Date(2026, 9, 14, 12))) // same day as Oct 14 noon
    expect(dayIndex(at(5))).toBe(dayIndex(at(1)) + 1)
  })
})

describe('check-in', () => {
  it('earns one seed per habit kept, in lane order, once per day', () => {
    let g = newGarden(START)
    g = checkIn(g, START, ['joy', 'body', 'joy'])
    expect(g.seeds.map((s) => s.kind)).toEqual(['oak', 'sunflower'])
    expect(hasCheckedIn(g, START)).toBe(true)
    const again = checkIn(g, START, ['craft'])
    expect(again).toBe(g)
  })

  it('counts an honest empty check-in as a check-in with no seeds', () => {
    const g = checkIn(newGarden(START), START, [])
    expect(hasCheckedIn(g, START)).toBe(true)
    expect(g.seeds).toEqual([])
  })
})

describe('placement', () => {
  it('roots a seed inside the grid and refuses overlap or the edge', () => {
    let g = checkIn(newGarden(START), START, ['body', 'craft'])
    const oak = g.seeds.find((s) => s.kind === 'oak')!
    g = placeSeed(g, oak.id, orientations('oak')[0], [0, 0], START)
    expect(g.beds).toHaveLength(1)
    expect(g.seeds.some((s) => s.id === oak.id)).toBe(false)

    const vine = g.seeds.find((s) => s.kind === 'vine')!
    const overlapping = placeSeed(g, vine.id, orientations('vine')[0], [1, 1], START)
    expect(overlapping).toBe(g)
    expect(canPlace(g, [[4, 0], [5, 0], [6, 0]])).toBe(false) // runs off a 6-wide grid
    expect(canPlace(g, [[3, 0], [4, 0], [5, 0]])).toBe(true)
  })

  it('composts a seed that will not fit', () => {
    const g = checkIn(newGarden(START), START, ['joy'])
    expect(compostSeed(g, g.seeds[0].id).seeds).toEqual([])
  })

  it('finds beds that share an edge, not a corner', () => {
    let g = plant(newGarden(START), START, ['body', 'joy'], [[0, 0], [2, 2]])
    expect(touching(g.beds, bed(g, 'oak'))).toEqual([]) // (2,2) only meets the oak's corner
    g = plant(g, START + 1, ['joy'], [[2, 1]])
    expect(touching(g.beds, bed(g, 'oak')).map((b) => b.kind)).toEqual(['sunflower'])
  })
})

describe('growth', () => {
  it('grows only on check-in days after planting', () => {
    let g = plant(newGarden(START), START, ['joy'], [[0, 0]])
    const flower = bed(g, 'sunflower')
    expect(stageOf(g, flower, START)).toBe(0)
    // Skipping days pauses growth: nothing is tended on START+1..+3.
    expect(stageOf(g, flower, START + 3)).toBe(0)
    g = checkIn(g, START + 4, [])
    expect(tendedDays(g, flower, START + 4)).toBe(1)
    expect(stageOf(g, flower, START + 4)).toBe(1)
    g = tendThrough(g, START + 5, START + 7)
    expect(stageOf(g, flower, START + 7)).toBe(3)
  })

  it('a vine touching an oak grows faster than one alone', () => {
    // oak on (0,0)-(1,1); vine on (2,0)-(4,0) shares the oak's right edge
    let g = plant(newGarden(START), START, ['body', 'craft'], [[0, 0], [2, 0]])
    let lone = plant(newGarden(START), START, ['craft'], [[0, 5]])
    g = tendThrough(g, START + 1, START + 2)
    lone = tendThrough(lone, START + 1, START + 2)
    expect(stageOf(g, bed(g, 'vine'), START + 2)).toBe(2) // 2 tended days + 1 for the oak = 3
    expect(stageOf(lone, bed(lone, 'vine'), START + 2)).toBe(1)
  })

  it('a sunflower under an oak never blooms; beside one it does', () => {
    let g = plant(newGarden(START), START, ['body', 'joy'], [[0, 0], [0, 2]])
    g = plant(g, START, [], [])
    const under = bed(g, 'sunflower')
    expect(skyBlocked(g.beds, under)).toBe(true)
    g = tendThrough(g, START + 1, START + 6)
    expect(stageOf(g, under, START + 6)).toBe(2)

    let open = plant(newGarden(START), START, ['body', 'joy'], [[0, 0], [2, 0]])
    open = tendThrough(open, START + 1, START + 6)
    expect(stageOf(open, bed(open, 'sunflower'), START + 6)).toBe(3)
  })
})

describe('seasons', () => {
  it('arrives every seasonEveryDays and is forecast forecastDays ahead', () => {
    const g = newGarden(START)
    const first = START + TUNING.seasonEveryDays
    expect(nextSeasonDay(g, START)).toBe(first)
    expect(nextSeasonDay(g, first)).toBe(first + TUNING.seasonEveryDays)
    expect(forecast(g, first - TUNING.forecastDays - 1)).toBeNull()
    expect(forecast(g, first - TUNING.forecastDays)).toEqual({ day: first, kind: 'drought', inDays: TUNING.forecastDays })
  })

  it('drought spares ferns and their neighbours and puts the rest to sleep', () => {
    // fern at (0,0)-(2,1); sunflower touching it at (3,0); sunflower alone at (5,5)
    let g = plant(newGarden(START), START, ['joy', 'green'], [[5, 5], [0, 0]])
    g = plant(g, START + 1, ['joy'], [[3, 0]])
    const season = START + TUNING.seasonEveryDays
    g = resolveSeasons(g, season)
    const [result] = g.seasons
    const lone = g.beds.find((b) => b.cells[0][0] === 5)!
    expect(result.hit).toEqual([lone.id])
    expect(result.held).toHaveLength(2)
    expect(isDormant(g, lone.id, season)).toBe(true)
    expect(isDormant(g, lone.id, season + TUNING.dormantDays)).toBe(false)
  })

  it('a moonflower shortens a touching bed’s sleep by a day', () => {
    // sunflower at (0,0), moonflower T below it at (0,1)
    let g = plant(newGarden(START), START, ['rest', 'joy'], [[0, 1], [0, 0]])
    const season = START + TUNING.seasonEveryDays
    g = resolveSeasons(g, season)
    const flower = bed(g, 'sunflower')
    const sleep = g.dormancy[flower.id][0]
    expect(sleep.to - sleep.from).toBe(TUNING.dormantDays - TUNING.moonflowerRecoveryDays)
  })

  it('a sleeping bed does not grow', () => {
    let g = plant(newGarden(START), START, ['joy'], [[0, 0]])
    const season = START + TUNING.seasonEveryDays
    g = resolveSeasons(g, season)
    g = tendThrough(g, season, season + TUNING.dormantDays - 1)
    const flower = bed(g, 'sunflower')
    expect(tendedDays(g, flower, season + TUNING.dormantDays - 1)).toBe(0)
  })

  it('catches up on every missed season, in order, exactly once', () => {
    let g = plant(newGarden(START), START, ['joy'], [[0, 0]])
    const third = START + 3 * TUNING.seasonEveryDays
    g = resolveSeasons(g, third)
    expect(g.seasons.map((s) => s.day)).toEqual([1, 2, 3].map((k) => START + k * TUNING.seasonEveryDays))
    expect(resolveSeasons(g, third)).toBe(g)
  })

  it('ignores beds planted on the season day itself', () => {
    const season = START + TUNING.seasonEveryDays
    const g = resolveSeasons(plant(newGarden(START), season, ['joy'], [[0, 0]]), season)
    expect(g.seasons[0].hit).toEqual([])
  })

  it('counts blooms only on awake beds', () => {
    let g = plant(newGarden(START), START, ['joy'], [[0, 0]])
    g = tendThrough(g, START + 1, START + 6)
    expect(bloomCount(g, START + 6)).toBe(1)
    g = resolveSeasons(g, START + 7)
    expect(bloomCount(g, START + 7)).toBe(0)
  })
})

describe('storage', () => {
  it('round-trips a garden and rejects anything malformed', () => {
    const g = plant(newGarden(START), START, ['body', 'joy'], [[0, 0], [3, 3]])
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    saveGarden(storage, g)
    expect(loadGarden(storage)).toEqual(g)

    store.set(STORAGE_KEY, '{not json')
    expect(loadGarden(storage)).toBeNull()
    expect(isGardenState({ ...g, version: 2 })).toBe(false)
    expect(isGardenState({ ...g, beds: [{ ...g.beds[0], kind: 'cactus' }] })).toBe(false)
    expect(isGardenState({ ...g, checkins: { [START]: ['sleeping in'] } })).toBe(false)
    expect(loadGarden(null)).toBeNull()
  })
})
