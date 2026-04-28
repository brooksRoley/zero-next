import { describe, it, expect } from 'vitest'
import { getAdaptiveBotConfig } from 'src/lib/go/adaptiveBot'

describe('getAdaptiveBotConfig', () => {
  describe('ELO-to-engine mapping', () => {
    it('returns level 1, 75% random for ELO < 600', () => {
      const cfg = getAdaptiveBotConfig(400, 10, null)
      expect(cfg.level).toBe(1)
      expect(cfg.randomRate).toBeCloseTo(0.75, 2)
    })

    it('interpolates level 1→2, random 75→30% for ELO 600-900', () => {
      const cfg = getAdaptiveBotConfig(750, 10, null)
      expect(cfg.level).toBeGreaterThanOrEqual(1)
      expect(cfg.level).toBeLessThanOrEqual(2)
      expect(cfg.randomRate).toBeGreaterThan(0.30)
      expect(cfg.randomRate).toBeLessThan(0.75)
    })

    it('returns level 1 at ELO 600 boundary', () => {
      const cfg = getAdaptiveBotConfig(600, 10, null)
      expect(cfg.level).toBe(1)
      expect(cfg.randomRate).toBeCloseTo(0.75, 2)
    })

    it('interpolates level 2→3, random 30→5% for ELO 900-1200', () => {
      const cfg = getAdaptiveBotConfig(1050, 10, null)
      expect(cfg.level).toBeGreaterThanOrEqual(2)
      expect(cfg.level).toBeLessThanOrEqual(3)
      expect(cfg.randomRate).toBeGreaterThan(0.05)
      expect(cfg.randomRate).toBeLessThan(0.30)
    })

    it('interpolates level 3→4, random 5→0% for ELO 1200-1500', () => {
      const cfg = getAdaptiveBotConfig(1350, 10, null)
      expect(cfg.level).toBeGreaterThanOrEqual(3)
      expect(cfg.level).toBeLessThanOrEqual(4)
      expect(cfg.randomRate).toBeGreaterThanOrEqual(0)
      expect(cfg.randomRate).toBeLessThanOrEqual(0.05)
    })

    it('returns level 5, 0% random for ELO 1500+', () => {
      const cfg = getAdaptiveBotConfig(1800, 10, null)
      expect(cfg.level).toBe(5)
      expect(cfg.randomRate).toBe(0)
    })

    it('returns level 5 for ELO 2000+', () => {
      const cfg = getAdaptiveBotConfig(2000, 10, null)
      expect(cfg.level).toBe(5)
      expect(cfg.randomRate).toBe(0)
    })
  })

  describe('bot ELO output', () => {
    it('reports ~400 for very low player ELO', () => {
      const cfg = getAdaptiveBotConfig(300, 10, null)
      expect(cfg.botElo).toBeGreaterThanOrEqual(350)
      expect(cfg.botElo).toBeLessThanOrEqual(450)
    })

    it('reports ~1600 for high player ELO', () => {
      const cfg = getAdaptiveBotConfig(1800, 10, null)
      expect(cfg.botElo).toBeGreaterThanOrEqual(1500)
      expect(cfg.botElo).toBeLessThanOrEqual(1700)
    })
  })

  describe('new-player ramp', () => {
    it('applies -200 ELO handicap for gamesPlayed 0', () => {
      const newPlayer = getAdaptiveBotConfig(1000, 0, null)
      const veteran = getAdaptiveBotConfig(1000, 10, null)
      expect(newPlayer.botElo).toBeLessThan(veteran.botElo)
      expect(veteran.botElo - newPlayer.botElo).toBeCloseTo(200, -1)
    })

    it('ramps linearly: game 2 has less handicap than game 0', () => {
      const g0 = getAdaptiveBotConfig(1000, 0, null)
      const g2 = getAdaptiveBotConfig(1000, 2, null)
      const g5 = getAdaptiveBotConfig(1000, 5, null)
      expect(g0.botElo).toBeLessThan(g2.botElo)
      expect(g2.botElo).toBeLessThan(g5.botElo)
    })

    it('no handicap at gamesPlayed >= 5', () => {
      const g5 = getAdaptiveBotConfig(1000, 5, null)
      const g10 = getAdaptiveBotConfig(1000, 10, null)
      expect(g5.botElo).toBe(g10.botElo)
    })
  })

  describe('teaching focus', () => {
    it('passes through capture focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'capture')
      expect(cfg.teachingFocus).toBe('capture')
    })

    it('passes through eyes focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'eyes')
      expect(cfg.teachingFocus).toBe('eyes')
    })

    it('passes through territory focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'territory')
      expect(cfg.teachingFocus).toBe('territory')
    })

    it('returns null for no teaching focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, null)
      expect(cfg.teachingFocus).toBeNull()
    })
  })

  describe('interpolation continuity', () => {
    it('no jumps at ELO boundaries', () => {
      let prevBotElo = null
      for (let elo = 0; elo <= 2000; elo += 50) {
        const cfg = getAdaptiveBotConfig(elo, 10, null)
        if (prevBotElo !== null) {
          expect(Math.abs(cfg.botElo - prevBotElo)).toBeLessThanOrEqual(100)
        }
        prevBotElo = cfg.botElo
      }
    })
  })

  describe('time budget', () => {
    it('includes timeBudget in output', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, null)
      expect(cfg.timeBudget).toBeGreaterThan(0)
    })
  })
})
