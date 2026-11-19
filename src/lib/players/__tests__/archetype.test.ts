import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { FIGURE_TONE, JERSEYS, ROLE_STYLE, SIGNATURE_GAP, hash, lookFor, specialMove, tier } from '../archetype'

const ROSTER = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/hardwood/engine_roster.json'), 'utf8')) as {
  id: number
  name: string
  team: string
  stats: { shooting: number; speed: number; defense: number }
}[]

describe('specialMove', () => {
  it('reads the top stat', () => {
    expect(specialMove({ shooting: 80, speed: 50, defense: 40 })).toMatchObject({ archetype: 'sharpshooter', move: 'Splash', stat: 'shooting', power: 80 })
    expect(specialMove({ shooting: 50, speed: 85, defense: 40 })).toMatchObject({ archetype: 'slasher', move: 'Blur', stat: 'speed', power: 85 })
    expect(specialMove({ shooting: 40, speed: 35, defense: 72 })).toMatchObject({ archetype: 'anchor', move: 'The Wall', stat: 'defense', power: 72 })
  })

  it('calls a close stat line a Two-Way, powered by the mean', () => {
    const m = specialMove({ shooting: 60, speed: 60 + SIGNATURE_GAP - 1, defense: 55 })
    expect(m).toMatchObject({ archetype: 'twoWay', move: 'Glue', stat: 'all' })
    expect(m.power).toBe(Math.round((60 + 65 + 55) / 3))
  })

  it('gives the real roster more than one kind of player', () => {
    const kinds = new Set(ROSTER.map((p) => specialMove(p.stats).archetype))
    expect(kinds.size).toBeGreaterThanOrEqual(3)
  })
})

describe('tier', () => {
  it('steps at 60 and 75', () => {
    expect([40, 59, 60, 74, 75, 99].map(tier)).toEqual([1, 1, 2, 2, 3, 3])
  })
})

describe('lookFor', () => {
  const p = { id: 7, team: 'GSW', stats: { shooting: 70, speed: 60, defense: 50 } }

  it('is stable for a player', () => {
    expect(lookFor(p)).toEqual(lookFor({ ...p }))
  })

  it('uses only the original palette', () => {
    for (const r of ROSTER) {
      const look = lookFor(r)
      expect(look.tone).toBe(FIGURE_TONE)
      expect(look.accent).toBe(ROLE_STYLE[look.archetype].accent)
      expect(JERSEYS).toContain(look.jersey)
      expect(look.number).toBeGreaterThanOrEqual(0)
      expect(look.number).toBeLessThan(100)
    }
  })

  it('never tells two players apart by anything but role, strength, team and number', () => {
    // Same team, same stats, different people: only the jersey number may differ.
    // A random per-person trait (a skin tone, a hairstyle) would fail here.
    const looks = ROSTER.slice(0, 40).map((r) => lookFor({ ...p, id: r.id }))
    for (const look of looks) {
      const { number: _n, ...rest } = look
      const { number: _m, ...first } = looks[0]
      expect(rest).toEqual(first)
    }
  })

  it('shows the role and its strength', () => {
    const shooter = lookFor({ ...p, stats: { shooting: 80, speed: 50, defense: 40 } })
    expect(shooter).toMatchObject({ archetype: 'sharpshooter', gear: 'sleeve', tier: 3 })
    const anchor = lookFor({ ...p, stats: { shooting: 40, speed: 35, defense: 62 } })
    expect(anchor).toMatchObject({ archetype: 'anchor', gear: 'bands', tier: 2 })
    expect(new Set(Object.values(ROLE_STYLE).map((r) => r.accent)).size).toBe(4)
  })

  it('dresses teammates alike', () => {
    expect(lookFor({ ...p, id: 1 }).jersey).toBe(lookFor({ ...p, id: 2 }).jersey)
  })

  it('makes defenders broader and fast players lean', () => {
    const big = lookFor({ ...p, stats: { shooting: 40, speed: 30, defense: 90 } })
    const small = lookFor({ ...p, stats: { shooting: 40, speed: 90, defense: 20 } })
    expect(big.build).toBeGreaterThan(small.build)
    expect(small.lean).toBeGreaterThan(big.lean)
    expect(big.build).toBeLessThanOrEqual(1.14 + 1e-9)
    expect(small.build).toBeGreaterThanOrEqual(0.88)
  })

  it('hashes deterministically', () => {
    expect(hash('abc')).toBe(hash('abc'))
    expect(hash('abc')).not.toBe(hash('abd'))
    expect(hash('abc')).toBe(440920331) // same value Hardwood's archetype.test.js pins
  })
})
