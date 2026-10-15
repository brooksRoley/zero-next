import { describe, it, expect } from 'vitest'
import {
  ALPINE,
  COATS,
  fitness,
  generation,
  helpful,
  loadAlpine,
  newAlpinePlay,
  playGenerations,
  readRun,
  rewindGenerations,
  runCaption,
  runGenerations,
  saveAlpine,
  START_PIKAS,
  total,
  type Heat,
  type Pikas,
} from 'src/lib/games/tend/alpine'
import {
  averageSize,
  currentPlants,
  growSeason,
  loadFarm,
  newFarmPlay,
  plantSeason,
  rewindSeason,
  saveFarm,
  varietiesOf,
  wildPlants,
} from 'src/lib/games/tend/farm'
import { rng } from 'src/lib/games/tend/rng'

const memory = () => {
  const map = new Map<string, string>()
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
}

describe('the seeded generator', () => {
  it('replays exactly from a seed', () => {
    const a = rng(42)
    const b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(rng(43)()).not.toBe(rng(42)())
  })
})

describe('pikas: selection you can watch but not steer', () => {
  it('has no coat that is best everywhere: thick helps in the cold and hurts in the heat', () => {
    expect(helpful('thick', 0)).toBe(true)
    expect(helpful('thick', 4)).toBe(false)
    expect(helpful('thin', 4)).toBe(true)
    expect(helpful('thin', 0)).toBe(false)
    // Most variants do nothing or a little harm.
    for (const h of [0, 2, 4] as Heat[]) {
      expect(helpful('pale', h)).toBe(false)
      expect(fitness('patchy', h)).toBeLessThan(fitness('standard', h))
    }
  })

  it('draws new variants without looking at the summer', () => {
    // The same random draws give the same mutation, whatever the heat.
    const p: Pikas = { ...START_PIKAS }
    const at = (h: Heat) => generation(p, h, rng(9))
    const added = (q: Pikas) => COATS.filter((c) => c !== 'standard' && q[c] > 0)
    expect(added(at(0))).toEqual(added(at(4)))
  })

  it('replays a run exactly from its seed', () => {
    expect(runGenerations(START_PIKAS, 4, 11)).toEqual(runGenerations(START_PIKAS, 4, 11))
  })

  it('selection: a helpful coat spreads in a heatwave far more often than a harmful one', () => {
    let thinWins = 0
    let thickWins = 0
    const start: Pikas = { standard: 18, thick: 1, thin: 1, pale: 0, patchy: 0 }
    for (let seed = 1; seed <= 200; seed++) {
      const end = runGenerations(start, 4, seed).history.at(-1)!
      if (end.thin > end.thick) thinWins++
      if (end.thick > end.thin) thickWins++
    }
    expect(thinWins).toBeGreaterThan(thickWins * 3)
  })

  it('drift: a helpful variant is sometimes lost by chance alone', () => {
    const start: Pikas = { standard: 19, thick: 0, thin: 1, pale: 0, patchy: 0 }
    const lost = Array.from({ length: 100 }, (_, i) => readRun(runGenerations(start, 3, i + 1)).lost).filter(Boolean).length
    expect(lost).toBeGreaterThan(5)
    expect(lost).toBeLessThan(95)
  })

  it('decline: a heatwave with no helpful variant shrinks the population', () => {
    const shrunk = Array.from({ length: 50 }, (_, i) => runGenerations(START_PIKAS, 4, i + 1)).filter(
      (r) => total(r.history.at(-1)!) < ALPINE.startSize,
    ).length
    expect(shrunk).toBeGreaterThan(40)
  })

  it('captions the biggest change and stores the slope', () => {
    let play = playGenerations(newAlpinePlay(5), 4)
    expect(runCaption(play.runs[0])).toMatch(/Pikas: 20 → \d+\./)
    const store = memory()
    saveAlpine(store, play)
    expect(loadAlpine(store)).toEqual(play)
    play = rewindGenerations(play)
    expect(play.runs).toHaveLength(0)
  })
})

describe('the farm: you are the season', () => {
  it('saving seed from the biggest fruit grows bigger fruit over seasons', () => {
    // A blight can still wipe a narrowed field (that is the next lesson), so judge the best season reached,
    // as a median over many farms rather than one lucky seed.
    const peaks: number[] = []
    let play = newFarmPlay(1)
    for (let seed = 1; seed <= 30; seed++) {
      play = newFarmPlay(seed)
      let peak = 0
      for (let i = 0; i < 8; i++) {
        const plants = currentPlants(play).filter((p) => !p.blighted)
        const best = [...plants].sort((a, b) => b.size - a.size).slice(0, 2).map((p) => p.id)
        play = plantSeason(play, best)
        peak = Math.max(peak, averageSize(currentPlants(play)))
      }
      peaks.push(peak)
    }
    const median = [...peaks].sort((a, b) => a - b)[15]
    expect(median).toBeGreaterThan(averageSize(wildPlants()) + 2)
    expect(play.seen.saved).toBe(true)
  })

  it('a blight takes every plant of one variety, so a one-variety field can lose everything', () => {
    const field = wildPlants().map((p) => ({ ...p, variety: 'Red' as const }))
    const seed = Array.from({ length: 200 }, (_, i) => i).find((s) => growSeason(field, field.map((p) => p.id), s).blight)!
    const season = growSeason(field, field.map((p) => p.id), seed)
    expect(season.after.every((p) => p.blighted)).toBe(true)
    expect(varietiesOf(season.after)).toBe(0)
  })

  it('sends wild seed when nothing is left to save from', () => {
    const field = wildPlants().map((p) => ({ ...p, blighted: true }))
    const season = growSeason(field, [], 1)
    expect(season.restocked).toBe(true)
    expect(season.after).toHaveLength(8)
  })

  it('is deterministic, rewinds, and stores', () => {
    const a = plantSeason(newFarmPlay(4), [1, 2])
    expect(a).toEqual(plantSeason(newFarmPlay(4), [1, 2]))
    expect(rewindSeason(a).seasons).toHaveLength(0)
    const store = memory()
    saveFarm(store, a)
    expect(loadFarm(store)).toEqual(a)
  })
})
