// Size a canvas for the screen's pixel density: the backing store is drawn at
// device pixels, and the context is scaled so drawing code works in CSS pixels.
// The ratio is capped because a 3× phone screen costs 9× the fill of 1× for a
// difference nobody sees in a soft backdrop.

/** Device-pixel ratio, capped. 1 where there's no window (SSR, tests without one). */
export function cappedDpr(maxDpr = 2): number {
  const raw = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return Math.min(raw, maxDpr)
}

/** The canvas backing-store size in device pixels for a CSS size. */
export function backingSize(cssW: number, cssH: number, dpr: number): { width: number; height: number } {
  return { width: Math.round(cssW * dpr), height: Math.round(cssH * dpr) }
}

/** Resize `canvas` to `cssW` × `cssH` CSS pixels at the capped ratio and scale `ctx` to match. Returns the ratio used. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  maxDpr = 2,
): number {
  const dpr = cappedDpr(maxDpr)
  const { width, height } = backingSize(cssW, cssH, dpr)
  canvas.width = width
  canvas.height = height
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return dpr
}
