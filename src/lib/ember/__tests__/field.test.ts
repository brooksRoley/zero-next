import { describe, it, expect } from 'vitest'
import { sampleDots, settleNow, stepDots, stepFor, throwSparks } from 'src/lib/ember/field'
import { rng } from 'src/lib/ember/weather'

// A 20×10 image: a cream bar on the left half, a red (accent) bar on the right.
function bars(): Uint8ClampedArray {
  const w = 20, h = 10, px = new Uint8ClampedArray(w * h * 4)
  for (let y = 2; y < 8; y++) {
    for (let x = 2; x < 18; x++) {
      const i = (y * w + x) * 4
      const accent = x >= 10
      px[i] = 255
      px[i + 1] = accent ? 0 : 255
      px[i + 2] = accent ? 0 : 255
      px[i + 3] = 255
    }
  }
  return px
}

describe('ember field', () => {
  it('keeps strokes a few dots wide at any size', () => {
    expect(stepFor(16)).toBe(2)
    expect(stepFor(108)).toBe(6)
  })

  it('samples only inked pixels and marks the accent part', () => {
    const dots = sampleDots(bars(), 20, 10, 2, rng(1))
    expect(dots.length).toBe(8 * 3)
    for (const d of dots) {
      expect(d.ty).toBeGreaterThanOrEqual(2)
      expect(d.ty).toBeLessThan(8)
      expect(d.tone).toBe(d.tx >= 10 ? 1 : 0)
    }
  })

  it('springs every dot onto its letterform', () => {
    const dots = sampleDots(bars(), 20, 10, 2, rng(2))
    let t = 0, speed = Infinity
    for (let i = 0; i < 240; i++) {
      t += 1000 / 60
      speed = stepDots(dots, 1 / 60, t, null, 8, 3)
    }
    expect(speed).toBeLessThan(0.5)
    for (const d of dots) {
      expect(Math.abs(d.x - d.tx)).toBeLessThan(0.1)
      expect(Math.abs(d.y - d.ty)).toBeLessThan(0.1)
    }
  })

  it('parts around the pointer and returns when it leaves', () => {
    const dots = sampleDots(bars(), 20, 10, 2, rng(3))
    settleNow(dots)
    const near = dots.find((d) => d.tx === 6 && d.ty === 4)!
    let t = 1000
    for (let i = 0; i < 120; i++) stepDots(dots, 1 / 60, (t += 16), { x: 4, y: 4 }, 8, 3)
    expect(near.x).toBeGreaterThan(near.tx + 0.5)
    for (let i = 0; i < 240; i++) stepDots(dots, 1 / 60, (t += 16), null, 8, 3)
    expect(Math.abs(near.x - near.tx)).toBeLessThan(0.1)
  })

  it('lifts sparks and lets them fall back', () => {
    const dots = sampleDots(bars(), 20, 10, 2, rng(4))
    settleNow(dots)
    throwSparks(dots, 3, 2000, 6, rng(5))
    const lifted = dots.filter((d) => d.liftUntil === 2000)
    expect(lifted.length).toBeGreaterThan(0)
    let t = 1000
    for (let i = 0; i < 50; i++) stepDots(dots, 1 / 60, (t += 16), null, 8, 3)
    for (const d of lifted) expect(d.y).toBeLessThan(d.ty - 1)
    for (let i = 0; i < 240; i++) stepDots(dots, 1 / 60, (t += 16), null, 8, 3)
    for (const d of lifted) expect(Math.abs(d.y - d.ty)).toBeLessThan(0.1)
  })
})
