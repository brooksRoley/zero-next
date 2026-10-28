/**
 * Ember "weather": the seeded randomness behind the house light
 * (docs/ART_DIRECTION.md, "Ember, the house light").
 *
 * One weather is drawn per visit, so the light behaves a little differently
 * each time but consistently within a visit. Legibility, the palette and the
 * timing tokens are never random; only how the light moves is.
 */

export type SweepDirection = 'ltr' | 'rtl' | 'center'

export type Weather = {
  direction: SweepDirection
  /** Half-width of the brass band, in px at a 100px font; scaled by font size. */
  band: number
  /** Delay before the first sweep after the name lands, ms. */
  firstSweepMs: number
  /** Idle gap between sweeps is drawn from this range each time, ms. */
  gapMs: [number, number]
  /** Duration of one sweep across the name, ms. */
  sweepMs: number
  /** Dots that lift off as sparks on each sweep. */
  sparks: number
  /** 0..1 depth of the per-dot shimmer. */
  flicker: number
  /** Which brass the light peaks at. */
  warmth: [number, number, number]
  /** The rare visit whose first sweep lights the whole name at once. */
  flare: boolean
}

// brass-300, brass-400, brass-500 (tailwind.config.js)
export const BRASS_STEPS: [number, number, number][] = [
  [216, 183, 131],
  [205, 163, 95],
  [193, 142, 61],
]
export const CREAM: [number, number, number] = [245, 242, 237]

/** mulberry32: small, fast, good enough for visuals; deterministic per seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a, for deterministic per-string variety (same on server and client). */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r()

export function pickWeather(seed: number): Weather {
  const r = rng(seed)
  const roll = r()
  const direction: SweepDirection = roll < 0.45 ? 'ltr' : roll < 0.75 ? 'rtl' : 'center'
  return {
    direction,
    band: Math.round(between(r, 38, 70)),
    firstSweepMs: Math.round(between(r, 250, 900)),
    gapMs: [7000, 15000],
    sweepMs: Math.round(between(r, 1900, 3000)),
    sparks: Math.floor(between(r, 0, 4)),
    flicker: +between(r, 0.08, 0.28).toFixed(3),
    warmth: BRASS_STEPS[Math.floor(r() * BRASS_STEPS.length)],
    flare: r() < 1 / 12,
  }
}

/**
 * Where the brass band's centre sits, as a fraction of the width, `p` of the
 * way through a sweep (0..1). Runs a little past both edges so the band enters
 * and leaves rather than popping. "center" returns the distance from the middle
 * that the light has spread, mirrored by the caller.
 */
export function sweepPosition(direction: SweepDirection, p: number): number {
  const q = Math.min(1, Math.max(0, p))
  if (direction === 'ltr') return -0.15 + 1.3 * q
  if (direction === 'rtl') return 1.15 - 1.3 * q
  return 0.65 * q
}

/** Heat (0..1) a dot at fraction `x` receives from a band centred at `sx`. */
export function heatAt(x: number, sx: number, band: number, direction: SweepDirection): number {
  const d = direction === 'center' ? Math.abs(Math.abs(x - 0.5) - sx) : Math.abs(x - sx)
  return Math.exp(-(d * d) / (2 * band * band))
}

/** Per-title glint variety for `.ember-glint`, from a hash of the title. */
export function glintStyle(key: string): Record<string, string> {
  const r = rng(hash(key))
  return {
    '--glint-angle': `${Math.round(between(r, 96, 116))}deg`,
    '--glint-dur': `${Math.round(between(r, 720, 1080))}ms`,
    '--glint-delay': `${Math.round(between(r, 0, 120))}ms`,
    '--glint-direction': r() < 0.7 ? 'normal' : 'reverse',
  }
}
