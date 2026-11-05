import { describe, expect, it } from 'vitest'
import { COLS, VISIBLE_ROWS } from '../engine'
import { CELL_MAX, CELL_MIN, NAV_H, PREVIEW, RESERVED_H, WELL_ASPECT, WELL_FRAME, fitCell, isWide, wellSize } from '../dimensions'

describe('fitCell', () => {
  it('caps the cell on a big desktop', () => {
    expect(fitCell(1920, 1200)).toBe(CELL_MAX)
  })

  it('fits a 1440×900 laptop by height', () => {
    // (900 - 64 - 110) / 20 = 36.3 → capped at 32
    expect(fitCell(1440, 900)).toBe(32)
    // (768 - 174) / 20 = 29.7 → 29
    expect(fitCell(1366, 768)).toBe(29)
  })

  it('fits a 390×844 phone and leaves room for the touch pad', () => {
    const cell = fitCell(390, 844)
    // (844 - 64 - 270) / 20 = 25.5 by height; (390 - 32) / 10 = 35.8 by width
    expect(cell).toBe(25)
    expect(wellSize(cell).h + NAV_H + RESERVED_H.narrow).toBeLessThanOrEqual(844)
  })

  it('is limited by width on a narrow, tall phone', () => {
    // (320 - 32) / 10 = 28.8 → 28, under the height limit
    expect(fitCell(320, 1000)).toBe(28)
  })

  it('never goes under the readable minimum', () => {
    expect(fitCell(200, 300)).toBe(CELL_MIN)
  })

  it('always returns a whole pixel, so cells stay crisp', () => {
    for (const [w, h] of [[375, 667], [412, 915], [1024, 700], [1280, 800]]) {
      expect(Number.isInteger(fitCell(w, h))).toBe(true)
    }
  })

  it('switches layout at 1024 px', () => {
    expect(isWide(1023)).toBe(false)
    expect(isWide(1024)).toBe(true)
  })
})

describe('wellSize', () => {
  it('is the grid times the cell, plus the frame', () => {
    expect(wellSize(25)).toEqual({ w: COLS * 25, h: VISIBLE_ROWS * 25, framedW: COLS * 25 + WELL_FRAME, framedH: VISIBLE_ROWS * 25 + WELL_FRAME })
  })

  it('matches the aspect ratio the backstage overlay uses', () => {
    const { w, h } = wellSize(30)
    expect(w / h).toBe(WELL_ASPECT)
  })
})

describe('PREVIEW', () => {
  it('keeps every preview wider than tall, so an I piece fits lying down', () => {
    for (const [w, h] of Object.values(PREVIEW)) expect(w).toBeGreaterThan(h)
  })
})
