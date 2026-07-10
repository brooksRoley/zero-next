/**
 * Playoff Moments — geometry unit tests + repertory self-consistency.
 * The pact with the player: the math that grades their click is the same math
 * that must respect (or honestly dispute) what history actually did.
 */
import { describe, it, expect } from 'vitest'
import {
  HOOP,
  dist,
  inBounds,
  isThree,
  zoneOf,
  contestSlack,
  openness,
  reachable,
  spotQuality,
  solveBest,
  gradeSpot,
  type Actor,
  type Grade,
} from 'src/lib/moments/geometry'
import { MOMENTS } from 'src/lib/moments/moments'

const GRADE_RANK: Record<Grade, number> = { A: 3, B: 2, C: 1, D: 0 }

describe('court geometry', () => {
  it('classifies the three-point line correctly', () => {
    expect(isThree({ x: 47.5, y: 3 })).toBe(true) // right corner
    expect(isThree({ x: 2.5, y: 10 })).toBe(true) // left corner
    expect(isThree({ x: 44, y: 10 })).toBe(false) // short corner two
    expect(isThree({ x: 25, y: 30 })).toBe(true) // straight-on, 24.75ft
    expect(isThree({ x: 25, y: 20 })).toBe(false) // free-throw-line-ish
  })

  it('zones: rim, corner3, arc3, paint, mid', () => {
    expect(zoneOf({ x: 25, y: 6 })).toBe('rim')
    expect(zoneOf({ x: 47.5, y: 3 })).toBe('corner3')
    expect(zoneOf({ x: 25, y: 30 })).toBe('arc3')
    expect(zoneOf({ x: 25, y: 15 })).toBe('paint')
    expect(zoneOf({ x: 38, y: 18 })).toBe('mid')
  })

  it('contest slack: closer/faster defenders mean less slack', () => {
    const spot = { x: 40, y: 10 }
    const near: Actor[] = [{ name: 'n', pos: { x: 42, y: 10 }, speed: 15 }]
    const far: Actor[] = [{ name: 'f', pos: { x: 10, y: 40 }, speed: 15 }]
    expect(contestSlack(spot, near, 0.8)).toBeLessThan(0)
    expect(contestSlack(spot, far, 0.8)).toBeGreaterThan(1)
    expect(openness(contestSlack(spot, near, 0.8))).toBeLessThan(0.2)
    expect(openness(contestSlack(spot, far, 0.8))).toBe(1)
  })

  it('reachability is speed × time from the start', () => {
    const p: Actor = { name: 'p', pos: { x: 25, y: 25 }, speed: 10 }
    expect(reachable({ x: 25, y: 35 }, p, 1)).toBe(true) // 10ft in 1s
    expect(reachable({ x: 25, y: 40 }, p, 1)).toBe(false) // 15ft in 1s
  })

  it('out-of-bounds spots are worthless', () => {
    const m = MOMENTS[0]
    expect(inBounds({ x: 49.9, y: 3 })).toBe(false)
    expect(spotQuality({ x: 49.9, y: 3 }, m)).toBe(0)
    expect(gradeSpot({ x: 49.9, y: 3 }, m).grade).toBe('D')
  })
})

describe('repertory self-consistency', () => {
  for (const m of MOMENTS) {
    describe(m.title, () => {
      it('historical spot is reachable and in bounds', () => {
        expect(inBounds(m.historicalSpot)).toBe(true)
        expect(reachable(m.historicalSpot, m.protagonist, m.timeLeft)).toBe(true)
      })

      it(`historical spot grades at least ${m.expectedHistoricalGrade}`, () => {
        const result = gradeSpot(m.historicalSpot, m)
        // Diagnostic line for tuning — kept: it documents the geometry.
        const best = m.kind === 'shape' ? solveBest(m) : null
        console.log(
          `[${m.id}] historical → ${result.grade} (ratio ${result.ratio.toFixed(2)})` +
            (best ? ` | best (${best.spot.x},${best.spot.y}) q=${best.quality.toFixed(2)}` : '')
        )
        expect(GRADE_RANK[result.grade]).toBeGreaterThanOrEqual(
          GRADE_RANK[m.expectedHistoricalGrade]
        )
        expect(result.historicalMatch).toBe(true)
      })

      it('a lazy spot (standing still at the start) never out-grades history', () => {
        const lazy = gradeSpot(m.protagonist.pos, m)
        const hist = gradeSpot(m.historicalSpot, m)
        expect(GRADE_RANK[lazy.grade]).toBeLessThanOrEqual(GRADE_RANK[hist.grade])
      })

      if (m.kind === 'shape') {
        it('the solver finds a positive-quality spot and grades itself A', () => {
          const { spot, quality } = solveBest(m)
          expect(quality).toBeGreaterThan(0.2)
          expect(gradeSpot(spot, m).grade).toBe('A')
        })

        it('a spot beyond the legs grades D with the clock lesson', () => {
          const far = { x: m.protagonist.pos.x > 25 ? 2 : 48, y: 45 }
          const result = gradeSpot(far, m)
          expect(result.grade).toBe('D')
          expect(result.lesson).toContain('clock')
        })
      } else {
        it('deny: running to the deny point is an A; chasing the ball-handler is a C or worse', () => {
          expect(gradeSpot(m.denyPoint!, m).grade).toBe('A')
          const chase = gradeSpot(m.defenders[0].pos, m)
          expect(GRADE_RANK[chase.grade]).toBeLessThanOrEqual(GRADE_RANK.C)
        })
      }
    })
  }

  it('every moment carries its full frame (story, question, epilogue, series)', () => {
    for (const m of MOMENTS) {
      for (const field of [m.story, m.question, m.epilogue, m.series, m.clock] as string[]) {
        expect(field.length).toBeGreaterThan(10)
      }
      expect(m.defenders.length).toBeGreaterThan(0)
      expect(m.timeLeft).toBeGreaterThan(0)
      expect(m.defenderTime).toBeLessThanOrEqual(m.timeLeft)
    }
  })

  it('moment ids are unique', () => {
    const ids = MOMENTS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('deny moments always define their deny point', () => {
    for (const m of MOMENTS.filter((x) => x.kind === 'deny')) {
      expect(m.denyPoint).toBeDefined()
      expect(dist(m.denyPoint!, HOOP)).toBeLessThan(10)
    }
  })
})
