import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampStep, createFixedStep, startFrameClock } from '../frameClock'

describe('clampStep', () => {
  it('passes a normal frame through', () => {
    expect(clampStep(1000, 1016.7, 100)).toBeCloseTo(16.7)
  })
  it('caps a stall, so returning to a tab is not one giant step', () => {
    expect(clampStep(0, 5000, 100)).toBe(100)
  })
  it('never goes backwards', () => {
    expect(clampStep(1000, 990, 100)).toBe(0)
  })
})

describe('createFixedStep', () => {
  const STEP = 1000 / 60

  it('runs the same number of steps at 60 Hz and 120 Hz over one second', () => {
    const at60 = createFixedStep(STEP)
    const at120 = createFixedStep(STEP)
    let n60 = 0
    let n120 = 0
    for (let i = 0; i < 60; i++) n60 += at60.advance(1000 / 60)
    for (let i = 0; i < 120; i++) n120 += at120.advance(1000 / 120)
    expect(Math.abs(n60 - 60)).toBeLessThanOrEqual(1)
    expect(Math.abs(n120 - 60)).toBeLessThanOrEqual(1)
  })

  it('carries leftover time and reports it as alpha', () => {
    const fx = createFixedStep(10)
    expect(fx.advance(25)).toBe(2)
    expect(fx.alpha()).toBeCloseTo(0.5)
    expect(fx.advance(5)).toBe(1)
    expect(fx.alpha()).toBeCloseTo(0)
  })

  it('drops the backlog past maxSteps instead of spiralling', () => {
    const fx = createFixedStep(10, 5)
    expect(fx.advance(1000)).toBe(5)
    expect(fx.alpha()).toBe(0)
  })
})

describe('startFrameClock', () => {
  afterEach(() => vi.unstubAllGlobals())

  function fakeFrames() {
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
    return (now: number) => queue.shift()?.(now)
  }

  it('hands each step the capped elapsed time', () => {
    const run = fakeFrames()
    const steps: number[] = []
    const stop = startFrameClock((dt) => steps.push(dt), { maxStepMs: 50 })
    run(16)
    run(32)
    run(2000)
    stop()
    expect(steps).toEqual([16, 16, 50])
  })

  it('skips frames under minFrameMs', () => {
    const run = fakeFrames()
    const steps: number[] = []
    const stop = startFrameClock((dt) => steps.push(dt), { minFrameMs: 33 })
    run(16)
    run(34)
    run(50)
    run(70)
    stop()
    expect(steps).toEqual([34, 36])
  })

  it('stops calling back after stop()', () => {
    const run = fakeFrames()
    const step = vi.fn()
    const stop = startFrameClock(step)
    stop()
    run(16)
    expect(step).not.toHaveBeenCalled()
  })
})
