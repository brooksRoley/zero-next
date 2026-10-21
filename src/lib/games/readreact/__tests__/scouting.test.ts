import { describe, it, expect } from 'vitest'
import { LEVELS, evMatrix } from '../levels'
import { chooseScheme } from '../defense'
import { solveZeroSum } from '../matrixGame'
import {
  DECAY, MIN_EVIDENCE, PRIOR_WEIGHT, SCOUTING_KEY, emptyScouting, headlineRead, loadScouting, parseScouting,
  priorCounts, recordSeries, saveScouting,
} from '../scouting'

const poison = LEVELS.find((l) => l.id === 'pick-your-poison')!

describe('the scouting report', () => {
  it('folds a series in, fading older series', () => {
    let file = recordSeries(emptyScouting(), poison, [10, 2])
    expect(file).toEqual({ version: 1, series: 1, counts: { paint: 10, corner3: 2 } })
    file = recordSeries(file, poison, [0, 12])
    expect(file.series).toBe(2)
    expect(file.counts.paint).toBeCloseTo(10 * DECAY)
    expect(file.counts.corner3).toBeCloseTo(2 * DECAY + 12)
  })

  it('keeps plays from other levels on file', () => {
    const three = LEVELS.find((l) => l.id === 'three-bad-options')!
    const file = recordSeries(recordSeries(emptyScouting(), three, [2, 2, 10]), poison, [6, 6])
    expect(file.counts.mid).toBeCloseTo(10 * DECAY)
  })

  it('says nothing and seeds nothing until there is enough on file', () => {
    const thin = recordSeries(emptyScouting(), poison, [MIN_EVIDENCE - 1, 0])
    expect(priorCounts(thin, poison)).toEqual([0, 0])
    expect(headlineRead(thin, poison)).toBeNull()
  })

  it('seeds the defense with your shares, worth PRIOR_WEIGHT possessions', () => {
    const file = recordSeries(emptyScouting(), poison, [9, 3])
    const prior = priorCounts(file, poison)
    expect(prior[0]).toBeCloseTo(PRIOR_WEIGHT * 0.75)
    expect(prior[1]).toBeCloseTo(PRIOR_WEIGHT * 0.25)
    expect(headlineRead(file, poison)).toMatchObject({ playId: 'paint', share: 0.75, series: 1 })
  })

  it('a defense with your file sits on your habit from the first possession', () => {
    const A = evMatrix(poison)
    const pack = poison.schemes.findIndex((s) => s.id === 'pack')
    // A first-time visitor gets the defense's read on a 50/50 offense: Chase Shooters.
    expect(chooseScheme(A, [0, 0])).not.toBe(pack)
    // A visitor on file as paint-heavy walks into Pack the Paint.
    const prior = priorCounts(recordSeries(emptyScouting(), poison, [10, 2]), poison)
    expect(chooseScheme(A, prior)).toBe(pack)
  })

  it('round-trips through storage and shrugs off a corrupted save', () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    const file = recordSeries(emptyScouting(), poison, [7, 5])
    saveScouting(storage, file)
    expect(loadScouting(storage)).toEqual(file)
    map.set(SCOUTING_KEY, '{broken')
    expect(loadScouting(storage)).toEqual(emptyScouting())
    expect(parseScouting({ version: 1, series: 2, counts: { paint: -1, mid: 'x', corner3: 4 } }).counts).toEqual({ corner3: 4 })
  })
})

// Memory must punish habits, never a sound mix. Par is the game value, and the
// equilibrium mix earns at least that against every scheme — whatever the
// defense believes about you, it can only pick among schemes.
describe('a remembered defense keeps par fair', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s: the unbeatable mix earns par against every scheme', (_id, level) => {
    const A = evMatrix(level)
    const { value, rowMix } = solveZeroSum(A)
    for (let j = 0; j < level.schemes.length; j++) {
      const earned = rowMix.reduce((sum, p, i) => sum + p * A[i][j], 0)
      expect(earned, `${level.id} vs ${level.schemes[j].id}`).toBeGreaterThanOrEqual(value - 0.01)
    }
  })
})
