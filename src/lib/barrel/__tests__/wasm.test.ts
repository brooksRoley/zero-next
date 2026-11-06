// BARREL: the committed WebAssembly build, driven headless in node through the
// same EMSCRIPTEN_BINDINGS the page uses. Rendering is not exercised here (no
// WebGL in node); the game loop's physics and rules are.
import { createRequire } from 'node:module'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { KEY, type BarrelModule, type HeadlessSim } from 'src/lib/barrel/module'

const require = createRequire(import.meta.url)
const dir = path.join(process.cwd(), 'public/barrel')
let M: BarrelModule

beforeAll(async () => {
  const create = require(path.join(dir, 'barrel.js')) as (o: object) => Promise<BarrelModule>
  M = await create({ locateFile: (p: string) => path.join(dir, p) })
})

const RIDING = 1
const WIPEOUT = 2
const DONE = 3
const MISSED = 4

/** Step until pred holds or the time runs out; returns steps taken. */
function runUntil(sim: HeadlessSim, keys: number, seconds: number, pred: () => boolean): number {
  for (let i = 0; i < seconds * 60; ++i) {
    if (pred()) return i
    sim.step(keys, 1)
  }
  return -1
}

describe('BARREL wasm module', () => {
  it('exposes SetGlobalSurfConditions and sanitises what JavaScript sends', () => {
    M.SetGlobalSurfConditions(4.2, 16, -6, 1)
    expect(M.getConditions()).toMatchObject({ breakType: 1, period: 16, wind: -6 })
    expect(M.getConditions().height).toBeCloseTo(4.2, 4)
    M.SetGlobalSurfConditions(Number.NaN, 400, -400, 9)
    const c = M.getConditions()
    expect(c.period).toBe(22)
    expect(c.wind).toBe(-15)
    expect(c.breakType).toBe(0)
    expect(Number.isFinite(c.height)).toBe(true)
  })

  it('global conditions reach a following sim and change the wave', () => {
    M.SetGlobalSurfConditions(1.5, 9, 0, 0)
    const sim = new M.HeadlessSim(true)
    sim.newWave()
    const small = sim.snapshot()
    M.SetGlobalSurfConditions(5.5, 18, 6, 1)
    sim.newWave()
    const big = sim.snapshot()
    expect(small.condHeight).toBeCloseTo(1.5, 4)
    expect(big.condHeight).toBeCloseTo(5.5, 4)
    expect(big.breakType).toBe(1)
    expect(big.waveSpeed).toBeGreaterThan(small.waveSpeed)
    expect(big.energy).toBeGreaterThan(small.energy * 5)
    sim.delete()
  })

  it('the wave breaks, folds a tube, and its chain never crosses itself', () => {
    for (const type of [0, 1, 2]) {
      const sim = new M.HeadlessSim(false)
      sim.setConditions(3.5, 14, 4, type)
      sim.newWave()
      let maxCurl = 0
      let tube = 0
      for (let i = 0; i < 60 * 14; i += 6) {
        sim.step(0, 6)
        const s = sim.snapshot()
        maxCurl = Math.max(maxCurl, s.curl)
        if (s.curl > 0.9) tube = Math.max(tube, s.tubeFront - s.tubeBack)
        expect(sim.chainSelfIntersects()).toBe(false)
      }
      expect(maxCurl).toBeGreaterThan(0.99)
      expect(tube).toBeGreaterThan(1) // the lip lands over a metre ahead of the throat
      expect(sim.rebuilds()).toBeGreaterThanOrEqual(60 * 14) // one fixture rebuild per step
      sim.delete()
    }
  })

  it('an idle paddler does not ride: the wave passes or takes them over the falls', () => {
    const sim = new M.HeadlessSim(false)
    sim.setConditions(3, 14, 3, 0)
    sim.newWave()
    const end = runUntil(sim, 0, 20, () => [DONE, MISSED, WIPEOUT].includes(sim.snapshot().state))
    expect(end).toBeGreaterThan(0)
    expect(sim.snapshot().state).not.toBe(RIDING)
    sim.delete()
  })

  it('popping up before the wave lifts you is a wipeout (too early)', () => {
    const sim = new M.HeadlessSim(false)
    sim.setConditions(3, 14, 3, 0)
    sim.newWave()
    // Far out, a pop-up does nothing: there is no wave to stand on yet.
    sim.step(KEY.down, 2)
    sim.step(0, 2)
    sim.step(KEY.up, 2)
    expect(sim.snapshot().state).toBe(0)
    sim.step(0, 2)
    // The face has reached the board but has not lifted it into the window.
    const near = runUntil(sim, 0, 12, () => {
      const s = sim.snapshot()
      return s.popMeter > 0.02 && !s.inWindow
    })
    expect(near).toBeGreaterThan(0)
    sim.step(KEY.down, 2)
    sim.step(0, 2)
    sim.step(KEY.up, 2)
    const s = sim.snapshot()
    expect(s.state).toBe(WIPEOUT)
    expect(s.cause).toBe(1) // TooEarly
    sim.delete()
  })

  it('S then W inside the window pops up to riding', () => {
    const sim = new M.HeadlessSim(false)
    sim.setConditions(3, 14, 3, 0)
    sim.newWave()
    const found = runUntil(sim, 0, 12, () => sim.snapshot().inWindow)
    expect(found).toBeGreaterThan(0)
    sim.step(KEY.down, 3)
    sim.step(0, 2)
    sim.step(KEY.up, 3)
    const s = sim.snapshot()
    expect(s.state).toBe(RIDING)
    expect(s.popQuality).toBeGreaterThan(0)
    sim.delete()
  })

  it('rebuilding the chain every step does not touch the system heap', () => {
    const sim = new M.HeadlessSim(false)
    sim.setConditions(4, 15, 5, 0)
    sim.newWave()
    sim.step(0, 120) // warm up
    const before = M.poolStats()
    sim.step(0, 600)
    const after = M.poolStats()
    expect(after.systemMallocs).toBe(before.systemMallocs)
    expect(after.arenaBytesUsed).toBe(before.arenaBytesUsed)
    expect(after.reuses).toBeGreaterThan(before.reuses + 600)
    sim.delete()
  })
})
