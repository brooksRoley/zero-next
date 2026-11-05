// One frame clock for every game and backdrop on the site.
//
// Two jobs that every requestAnimationFrame loop here was doing by hand:
//  1. Measure elapsed time and cap it, so a stalled tab or a debugger pause
//     never arrives as one huge step (a piece dropping ten rows at once).
//  2. Optionally cap the frame rate, for backdrops that don't need 60 fps.
//
// For physics, use createFixedStep: it turns variable frame times into whole
// steps of the same size, so a simulation behaves the same at 60 Hz and 120 Hz.

export type FrameClockOptions = {
  /** Largest elapsed time handed to one step, in ms. Default 100. */
  maxStepMs?: number
  /** Skip frames that come sooner than this after the last one, in ms. Default 0 (every frame). */
  minFrameMs?: number
}

/** Elapsed ms since `last`, capped at `maxStepMs`, and never negative. */
export function clampStep(last: number, now: number, maxStepMs: number): number {
  return Math.max(0, Math.min(maxStepMs, now - last))
}

/**
 * Call `step(dtMs, now)` once per animation frame until the returned stop
 * function runs. Browsers pause requestAnimationFrame in hidden tabs, and the
 * cap means coming back never replays the time away as one jump.
 */
export function startFrameClock(step: (dtMs: number, now: number) => void, options: FrameClockOptions = {}): () => void {
  const maxStepMs = options.maxStepMs ?? 100
  const minFrameMs = options.minFrameMs ?? 0
  let raf = 0
  let last = performance.now()
  let stopped = false
  const frame = (now: number) => {
    if (stopped) return
    raf = requestAnimationFrame(frame)
    if (minFrameMs > 0 && now - last < minFrameMs) return
    const dt = clampStep(last, now, maxStepMs)
    last = now
    step(dt, now)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    stopped = true
    cancelAnimationFrame(raf)
  }
}

export type FixedStep = {
  /** Add elapsed ms; returns how many whole steps to run now (at most maxSteps). */
  advance: (dtMs: number) => number
  /** How far into the next step we are, 0–1, for interpolating a draw between two states. */
  alpha: () => number
}

/**
 * The fixed-timestep accumulator ("fix your timestep"). Elapsed time piles up
 * and is spent in steps of exactly `stepMs`. Leftover time carries to the next
 * frame. Past `maxSteps` in one frame the backlog is dropped, so a slow device
 * slows the simulation down instead of spiralling.
 */
export function createFixedStep(stepMs: number, maxSteps = 5): FixedStep {
  let acc = 0
  return {
    advance(dtMs) {
      acc += Math.max(0, dtMs)
      let n = Math.floor(acc / stepMs)
      if (n > maxSteps) {
        n = maxSteps
        acc = 0
      } else {
        acc -= n * stepMs
      }
      return n
    },
    alpha: () => acc / stepMs,
  }
}
