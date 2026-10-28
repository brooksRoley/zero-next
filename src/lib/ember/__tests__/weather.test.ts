import { describe, it, expect } from 'vitest'
import { BRASS_STEPS, glintStyle, hash, heatAt, pickWeather, rng, sweepPosition } from 'src/lib/ember/weather'

// Ember's randomness has rules (docs/ART_DIRECTION.md): seeded, bounded, and
// never touching legibility or the palette.
const seeds = Array.from({ length: 2400 }, (_, i) => hash(`visit-${i}`))

describe('ember weather', () => {
  it('is the same weather for the same seed', () => {
    expect(pickWeather(42)).toEqual(pickWeather(42))
    expect(pickWeather(42)).not.toEqual(pickWeather(43))
  })

  it('stays inside its ranges and the brass palette', () => {
    for (const s of seeds) {
      const w = pickWeather(s)
      expect(w.band).toBeGreaterThanOrEqual(38)
      expect(w.band).toBeLessThanOrEqual(70)
      expect(w.sweepMs).toBeGreaterThanOrEqual(1900)
      expect(w.sweepMs).toBeLessThanOrEqual(3000)
      expect(w.sparks).toBeGreaterThanOrEqual(0)
      expect(w.sparks).toBeLessThanOrEqual(3)
      expect(w.flicker).toBeGreaterThanOrEqual(0.08)
      expect(w.flicker).toBeLessThanOrEqual(0.28)
      expect(w.gapMs).toEqual([7000, 15000])
      expect(BRASS_STEPS).toContain(w.warmth)
    }
  })

  it('varies the direction and flares about one visit in twelve', () => {
    const weathers = seeds.map(pickWeather)
    const dirs = new Set(weathers.map((w) => w.direction))
    expect(dirs).toEqual(new Set(['ltr', 'rtl', 'center']))
    const flareRate = weathers.filter((w) => w.flare).length / weathers.length
    expect(flareRate).toBeGreaterThan(0.05)
    expect(flareRate).toBeLessThan(0.12)
  })

  it('draws uniform numbers in [0, 1)', () => {
    const r = rng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('sweeps enter and leave past the edges', () => {
    expect(sweepPosition('ltr', 0)).toBeLessThan(0)
    expect(sweepPosition('ltr', 1)).toBeGreaterThan(1)
    expect(sweepPosition('rtl', 0)).toBeGreaterThan(1)
    expect(sweepPosition('rtl', 1)).toBeLessThan(0)
    expect(sweepPosition('center', 0)).toBe(0)
  })

  it('heats most at the band centre', () => {
    expect(heatAt(0.5, 0.5, 0.1, 'ltr')).toBeCloseTo(1)
    expect(heatAt(0.9, 0.5, 0.1, 'ltr')).toBeLessThan(0.01)
    // From the centre, the light reaches both sides at once.
    expect(heatAt(0.2, 0.3, 0.1, 'center')).toBeCloseTo(heatAt(0.8, 0.3, 0.1, 'center'))
  })

  it('gives each title its own glint, the same on server and client', () => {
    expect(glintStyle('Pente')).toEqual(glintStyle('Pente'))
    expect(glintStyle('Pente')).not.toEqual(glintStyle('Go'))
    expect(glintStyle('Resume')['--glint-dur']).toMatch(/^\d+ms$/)
  })
})
