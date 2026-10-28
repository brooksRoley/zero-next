/**
 * Ember dot field: sampling text into dots and moving them. Pure functions over
 * plain arrays so the physics is testable without a canvas; EmberText owns the
 * drawing and the clock.
 */

export type Dot = {
  /** Resting position (on the letterform). */
  tx: number
  ty: number
  x: number
  y: number
  vx: number
  vy: number
  /** Before this many ms the dot holds its starting position. */
  delay: number
  /** 0 = cream, 1 = accent part (e.g. "Theater" on the marquee). */
  tone: 0 | 1
  /** Shimmer phase, radians. */
  phase: number
  /** Spark: rise this many px until `liftUntil` ms, then fall back. */
  lift: number
  liftUntil: number
}

export type Pointer = { x: number; y: number } | null

/** Grid step for a font size: strokes stay three to four dots wide at any size. */
export function stepFor(fontSize: number): number {
  return Math.max(2, Math.round(fontSize / 19))
}

/**
 * Turn rendered text (RGBA pixels, `w`×`h`) into dots on a `step` grid. Text
 * drawn in pure red marks the accent part; anything else opaque is cream.
 * Dots start scattered around the centre and arrive left to right.
 */
export function sampleDots(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  step: number,
  rand: () => number,
): Dot[] {
  const dots: Dot[] = []
  const spread = Math.max(w, h) * 0.7
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      if (rgba[i + 3] <= 120) continue
      const accent = rgba[i] > 200 && rgba[i + 1] < 80
      const a = rand() * Math.PI * 2
      const r = 60 + rand() * spread
      dots.push({
        tx: x,
        ty: y,
        x: w / 2 + Math.cos(a) * r,
        y: h / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        delay: (x / w) * 320,
        tone: accent ? 1 : 0,
        phase: rand() * Math.PI * 2,
        lift: 0,
        liftUntil: 0,
      })
    }
  }
  return dots
}

const K = 170 // spring stiffness
const C = 19 // damping

/**
 * Advance every dot by `dt` seconds at time `t` ms. Dots spring toward their
 * letterform, part around the pointer, and rise while a spark lasts.
 * Returns the fastest dot's speed so the caller can tell when the field rests.
 */
export function stepDots(
  dots: Dot[],
  dt: number,
  t: number,
  pointer: Pointer,
  radius: number,
  push: number,
): number {
  let fastest = 0
  for (const d of dots) {
    if (t < d.delay) continue
    let gx = d.tx
    let gy = t < d.liftUntil ? d.ty - d.lift : d.ty
    if (pointer) {
      const dx = d.tx - pointer.x
      const dy = d.ty - pointer.y
      const dist = Math.hypot(dx, dy)
      if (dist < radius && dist > 0.01) {
        const f = ((radius - dist) / radius) * push
        gx += (dx / dist) * f
        gy += (dy / dist) * f
      }
    }
    d.vx += (K * (gx - d.x) - C * d.vx) * dt
    d.vy += (K * (gy - d.y) - C * d.vy) * dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    fastest = Math.max(fastest, Math.abs(d.vx) + Math.abs(d.vy))
  }
  return fastest
}

/** Put every dot at rest on its letterform (reduced motion, first paint). */
export function settleNow(dots: Dot[]): void {
  for (const d of dots) {
    d.x = d.tx
    d.y = d.ty
    d.vx = 0
    d.vy = 0
  }
}

/** Lift `count` random dots as sparks until `until` ms. */
export function throwSparks(dots: Dot[], count: number, until: number, height: number, rand: () => number): void {
  for (let n = 0; n < count && dots.length; n++) {
    const d = dots[Math.floor(rand() * dots.length)]
    d.lift = height * (0.5 + rand() * 0.5)
    d.liftUntil = until
  }
}
