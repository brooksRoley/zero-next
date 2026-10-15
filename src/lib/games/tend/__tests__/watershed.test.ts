import { describe, it, expect } from 'vitest'
import { ROLE_LEVEL, SEA_LEVEL_INDEX, stepsToUnlock, TIERS, unlockedTiers } from 'src/lib/games/tend/watershed'

describe('watershed data', () => {
  it('runs from the peaks to the sea floor, with the sea surface in the middle', () => {
    expect(TIERS.at(0)?.id).toBe('alpine')
    expect(TIERS.at(-1)?.id).toBe('deep')
    expect(SEA_LEVEL_INDEX).toBeGreaterThan(0)
    expect(SEA_LEVEL_INDEX).toBeLessThan(TIERS.length - 1)
  })

  it('gets darker going down: no sunlight below the twilight zone', () => {
    const order = { full: 0, dim: 1, none: 2 }
    const lights = TIERS.map((t) => order[t.light])
    expect([...lights].sort()).toEqual(lights)
    const deep = TIERS.find((t) => t.id === 'deep')!
    expect(deep.residents.some((r) => r.sprite === 'sun')).toBe(false)
  })

  it.each(TIERS.map((t) => [t.id, t]))('%s: every food-web link names real residents and flows upward', (_id, tier) => {
    const byId = new Map(tier.residents.map((r) => [r.id, r]))
    for (const [eater, eaten] of tier.eats) {
      expect(byId.has(eater), eater).toBe(true)
      expect(byId.has(eaten), eaten).toBe(true)
      expect(ROLE_LEVEL[byId.get(eater)!.role]).toBeGreaterThan(ROLE_LEVEL[byId.get(eaten)!.role])
    }
    // Every living resident eats something; only energy sources don't.
    for (const r of tier.residents) {
      if (r.role !== 'energy') expect(tier.eats.some(([eater]) => eater === r.id), r.id).toBe(true)
    }
  })

  it.each(TIERS.map((t) => [t.id, t]))('%s: every line the player reads links an https source', (_id, tier) => {
    for (const r of tier.residents) expect(r.source).toMatch(/^https:\/\//)
    expect(tier.lesson.source).toMatch(/^https:\/\//)
    if (tier.kitchen) expect(tier.kitchen.source).toMatch(/^https:\/\//)
  })

  it('has one unlock step per tier, with the garden open from the start', () => {
    expect(TIERS.map((t) => t.unlock).sort((a, b) => a - b)).toEqual(TIERS.map((_, i) => i))
    expect(TIERS.find((t) => t.unlock === 0)?.id).toBe('woodland')
  })
})

describe('unlocking', () => {
  it('opens tiers outward as the garden earns notes and weathers seasons', () => {
    expect([...unlockedTiers({ notes: 0, seasons: 0 })]).toEqual(['woodland'])
    expect(unlockedTiers({ notes: 1, seasons: 1 })).toEqual(new Set(['subalpine', 'woodland', 'valley']))
    expect(unlockedTiers({ notes: 5, seasons: 9 }).size).toBe(TIERS.length)
  })

  it('counts the milestones left', () => {
    const deep = TIERS.find((t) => t.id === 'deep')!
    expect(stepsToUnlock(deep, { notes: 2, seasons: 1 })).toBe(5)
    expect(stepsToUnlock(deep, { notes: 5, seasons: 9 })).toBe(0)
  })
})
