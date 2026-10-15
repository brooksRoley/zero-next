import { describe, it, expect } from 'vitest'
import { bloomCount, hasCheckedIn } from 'src/lib/games/tend/engine'
import { PLANT_KINDS } from 'src/lib/games/tend/plants'
import { SAMPLE_DAYS, sampleGarden } from 'src/lib/games/tend/sample'
import { isGardenState } from 'src/lib/games/tend/storage'
import { TIERS, unlockedTiers } from 'src/lib/games/tend/watershed'

const TODAY = 20_000

describe('the sample garden', () => {
  const garden = sampleGarden(TODAY)

  it('is a valid save on its last day', () => {
    expect(isGardenState(JSON.parse(JSON.stringify(garden)))).toBe(true)
    expect(TODAY - garden.startDay + 1).toBe(SAMPLE_DAYS)
    expect(hasCheckedIn(garden, TODAY)).toBe(true)
  })

  it('placed every planned bed and shows every kind of plant', () => {
    expect(garden.beds).toHaveLength(10)
    expect(new Set(garden.beds.map((b) => b.kind))).toEqual(new Set(PLANT_KINDS))
    expect(bloomCount(garden, TODAY)).toBeGreaterThanOrEqual(8)
  })

  it('has collected every field note and weathered a drought each week', () => {
    expect(new Set(garden.notes)).toEqual(new Set(PLANT_KINDS))
    expect(garden.seasons).toHaveLength(Math.floor((SAMPLE_DAYS - 1) / 7))
  })

  it('reaches every watershed tier, so a visitor sees all of them collected', () => {
    const progress = { notes: garden.notes?.length ?? 0, seasons: garden.seasons.length }
    expect(unlockedTiers(progress).size).toBe(TIERS.length)
  })

  it('is the same garden whatever day it is built on', () => {
    const later = sampleGarden(TODAY + 123)
    expect(later.beds.map((b) => [b.kind, b.cells])).toEqual(garden.beds.map((b) => [b.kind, b.cells]))
  })
})
