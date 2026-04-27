import { describe, it, expect } from 'vitest'
import { getAdaptiveBotConfig } from '../adaptiveBot.js'

// ── Return shape ────────────────────────────────────────────────────────────

describe('getAdaptiveBotConfig return shape', () => {
  it('returns searchDepth, timeBudgetMs, blunderRate, effectiveElo', () => {
    const config = getAdaptiveBotConfig(1000, 10)
    expect(config).toHaveProperty('searchDepth')
    expect(config).toHaveProperty('timeBudgetMs')
    expect(config).toHaveProperty('blunderRate')
    expect(config).toHaveProperty('effectiveElo')
  })

  it('returns integers for searchDepth and effectiveElo', () => {
    const config = getAdaptiveBotConfig(1100, 10)
    expect(Number.isInteger(config.searchDepth)).toBe(true)
    expect(Number.isInteger(config.effectiveElo)).toBe(true)
  })
})

// ── Anchor points ───────────────────────────────────────────────────────────

describe('anchor point reproduction', () => {
  it('matches beginner anchor at ELO 600', () => {
    const config = getAdaptiveBotConfig(600, 10)
    expect(config.searchDepth).toBe(1)
    expect(config.timeBudgetMs).toBe(200)
    expect(config.blunderRate).toBeCloseTo(0.15, 2)
    expect(config.effectiveElo).toBe(600)
  })

  it('matches intermediate anchor at ELO 1000', () => {
    const config = getAdaptiveBotConfig(1000, 10)
    expect(config.searchDepth).toBe(2)
    expect(config.timeBudgetMs).toBe(800)
    expect(config.blunderRate).toBeCloseTo(0.05, 2)
  })

  it('matches advanced anchor at ELO 1400', () => {
    const config = getAdaptiveBotConfig(1400, 10)
    expect(config.searchDepth).toBe(3)
    expect(config.timeBudgetMs).toBe(2000)
    expect(config.blunderRate).toBeCloseTo(0.01, 2)
  })

  it('matches expert anchor at ELO 1800', () => {
    const config = getAdaptiveBotConfig(1800, 10)
    expect(config.searchDepth).toBe(4)
    expect(config.timeBudgetMs).toBe(4000)
    expect(config.blunderRate).toBe(0)
  })
})

// ── Interpolation between anchors ───────────────────────────────────────────

describe('interpolation between anchors', () => {
  it('interpolates midpoint between beginner and intermediate (ELO 800)', () => {
    const config = getAdaptiveBotConfig(800, 10)
    // Midpoint: depth lerp(1,2,0.5)=1.5→round=2, time lerp(200,800,0.5)=500, blunder lerp(0.15,0.05,0.5)=0.10
    expect(config.searchDepth).toBe(2)
    expect(config.timeBudgetMs).toBe(500)
    expect(config.blunderRate).toBeCloseTo(0.10, 2)
  })

  it('interpolates between intermediate and advanced (ELO 1200)', () => {
    const config = getAdaptiveBotConfig(1200, 10)
    // t=0.5: depth lerp(2,3,0.5)=2.5→round=3, time lerp(800,2000,0.5)=1400, blunder lerp(0.05,0.01,0.5)=0.03
    expect(config.searchDepth).toBe(3)
    expect(config.timeBudgetMs).toBe(1400)
    expect(config.blunderRate).toBeCloseTo(0.03, 2)
  })

  it('interpolates between advanced and expert (ELO 1600)', () => {
    const config = getAdaptiveBotConfig(1600, 10)
    // t=0.5: depth lerp(3,4,0.5)=3.5→round=4, time lerp(2000,4000,0.5)=3000, blunder lerp(0.01,0,0.5)=0.005
    expect(config.searchDepth).toBe(4)
    expect(config.timeBudgetMs).toBe(3000)
    expect(config.blunderRate).toBeCloseTo(0.005, 3)
  })
})

// ── Clamping ────────────────────────────────────────────────────────────────

describe('clamping at extremes', () => {
  it('clamps below minimum anchor (ELO 400)', () => {
    const config = getAdaptiveBotConfig(400, 10)
    expect(config.searchDepth).toBe(1)
    expect(config.timeBudgetMs).toBe(200)
    expect(config.blunderRate).toBeCloseTo(0.15, 2)
  })

  it('clamps above maximum anchor (ELO 2400)', () => {
    const config = getAdaptiveBotConfig(2400, 10)
    expect(config.searchDepth).toBe(4)
    expect(config.timeBudgetMs).toBe(4000)
    expect(config.blunderRate).toBe(0)
  })

  it('blunderRate never goes negative', () => {
    for (let elo = 400; elo <= 2400; elo += 100) {
      const config = getAdaptiveBotConfig(elo, 10)
      expect(config.blunderRate).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── New player ramp-up ──────────────────────────────────────────────────────

describe('new player ramp-up', () => {
  it('subtracts 200 ELO on game 0', () => {
    const config = getAdaptiveBotConfig(800, 0)
    expect(config.effectiveElo).toBe(600)
  })

  it('subtracts 120 ELO on game 2', () => {
    const config = getAdaptiveBotConfig(800, 2)
    // rampFactor = 2/5 = 0.4, offset = 200 * 0.6 = 120, effective = 680
    expect(config.effectiveElo).toBe(680)
  })

  it('subtracts 40 ELO on game 4', () => {
    const config = getAdaptiveBotConfig(800, 4)
    // rampFactor = 4/5 = 0.8, offset = 200 * 0.2 = 40, effective = 760
    expect(config.effectiveElo).toBe(760)
  })

  it('no offset at game 5', () => {
    const config = getAdaptiveBotConfig(800, 5)
    expect(config.effectiveElo).toBe(800)
  })

  it('no offset at game 50', () => {
    const config = getAdaptiveBotConfig(800, 50)
    expect(config.effectiveElo).toBe(800)
  })

  it('effective ELO floors at 400', () => {
    // Player at ELO 500, game 0: 500 - 200 = 300, but should clamp to 400
    const config = getAdaptiveBotConfig(500, 0)
    expect(config.effectiveElo).toBe(400)
  })

  it('ramp-up produces easier config than full strength', () => {
    const ramped = getAdaptiveBotConfig(1000, 0)   // effective 800
    const full = getAdaptiveBotConfig(1000, 10)     // effective 1000
    expect(ramped.effectiveElo).toBeLessThan(full.effectiveElo)
    expect(ramped.blunderRate).toBeGreaterThanOrEqual(full.blunderRate)
    expect(ramped.timeBudgetMs).toBeLessThanOrEqual(full.timeBudgetMs)
  })
})

// ── Monotonicity ────────────────────────────────────────────────────────────

describe('monotonicity — higher ELO means harder bot', () => {
  it('searchDepth is non-decreasing with ELO', () => {
    let prev = 0
    for (let elo = 400; elo <= 2000; elo += 50) {
      const config = getAdaptiveBotConfig(elo, 10)
      expect(config.searchDepth).toBeGreaterThanOrEqual(prev)
      prev = config.searchDepth
    }
  })

  it('timeBudgetMs is non-decreasing with ELO', () => {
    let prev = 0
    for (let elo = 400; elo <= 2000; elo += 50) {
      const config = getAdaptiveBotConfig(elo, 10)
      expect(config.timeBudgetMs).toBeGreaterThanOrEqual(prev)
      prev = config.timeBudgetMs
    }
  })

  it('blunderRate is non-increasing with ELO', () => {
    let prev = 1
    for (let elo = 400; elo <= 2000; elo += 50) {
      const config = getAdaptiveBotConfig(elo, 10)
      expect(config.blunderRate).toBeLessThanOrEqual(prev)
      prev = config.blunderRate
    }
  })
})
