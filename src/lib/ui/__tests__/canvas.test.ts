import { afterEach, describe, expect, it, vi } from 'vitest'
import { backingSize, cappedDpr } from '../canvas'

describe('canvas sizing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('draws at device pixels', () => {
    expect(backingSize(300, 600, 2)).toEqual({ width: 600, height: 1200 })
    expect(backingSize(101, 51, 1.5)).toEqual({ width: 152, height: 77 })
  })

  it('caps a 3× screen', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3 })
    expect(cappedDpr()).toBe(2)
    expect(cappedDpr(1.5)).toBe(1.5)
  })

  it('falls back to 1 when the ratio is unknown', () => {
    vi.stubGlobal('window', { devicePixelRatio: 0 })
    expect(cappedDpr()).toBe(1)
  })
})
