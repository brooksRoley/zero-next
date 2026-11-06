/**
 * BARREL — the typed face of the WASM module (native/barrel/src/main.cpp) and
 * its loader. The module is built with MODULARIZE, so /barrel/barrel.js
 * defines window.createBarrelModule; the promise is cached on window so a
 * second visit to the page (client-side navigation) reuses the instance.
 */
import { BARREL_BUILD } from 'src/lib/barrel/buildInfo'

export const KEY = { left: 1, right: 2, up: 4, down: 8, space: 16 } as const

export const GAME_STATE = ['paddling', 'riding', 'wipeout', 'done', 'missed'] as const
export const OUTCOME = ['none', 'kick_out', 'rode_out', 'wipeout', 'missed'] as const
export const CAUSE = ['none', 'too_early', 'over_the_falls', 'pearled', 'lip', 'rail', 'landing'] as const

export type BarrelSnapshot = {
  state: number
  outcome: number
  cause: number
  phase: number
  score: number
  lastScore: number
  rideTime: number
  tubeTime: number
  speed: number
  popMeter: number
  popQuality: number
  popStage: number
  inWindow: boolean
  inBarrel: boolean
  crouching: boolean
  curl: number
  waveHeight: number
  waveSpeed: number
  energy: number
  swellDistance: number
  tubeBack: number
  tubeFront: number
  boardX: number
  boardY: number
  boardAngle: number
  crestX: number
  rides: number
  chainCount: number
  breakType: number
  condHeight: number
  condPeriod: number
  condWind: number
}

export type PoolStats = {
  arenaBytesUsed: number
  arenaCarves: number
  reuses: number
  systemMallocs: number
  liveBlocks: number
}

export interface HeadlessSim {
  step(keys: number, n: number): void
  snapshot(): BarrelSnapshot
  setConditions(height: number, period: number, wind: number, breakType: number): void
  newWave(): void
  chainSelfIntersects(): boolean
  rebuilds(): number
  chainCount(): number
  tipX(): number
  delete(): void
}

export interface BarrelModule {
  SetGlobalSurfConditions(height: number, period: number, wind: number, breakType: number): void
  start(canvasSelector: string, best: number): boolean
  stop(): void
  running(): boolean
  setTouchKeys(keys: number): void
  setBest(best: number): void
  getBest(): number
  getSteps(): number
  /** Frames drawn: one per frame that advanced the simulation, so 60 a second. */
  getFrames(): number
  getSnapshot(): BarrelSnapshot
  getConditions(): { height: number; period: number; wind: number; breakType: number }
  poolStats(): PoolStats
  HeadlessSim: new (followGlobal: boolean) => HeadlessSim
}

type Factory = (opts: { locateFile?: (path: string) => string }) => Promise<BarrelModule>

declare global {
  interface Window {
    createBarrelModule?: Factory
    __barrelModule?: Promise<BarrelModule>
    /** Assigned by the WASM module while the game runs (main.cpp start()). */
    SetGlobalSurfConditions?: (height: number, period: number, wind: number, breakType: number) => void
  }
}

const version = BARREL_BUILD.sourceHash.slice(0, 12)

export function loadBarrel(): Promise<BarrelModule> {
  if (window.__barrelModule) return window.__barrelModule
  const promise = new Promise<BarrelModule>((resolve, reject) => {
    const ready = () => {
      if (!window.createBarrelModule) return reject(new Error('barrel.js loaded without createBarrelModule'))
      window
        .createBarrelModule({ locateFile: (p) => `/barrel/${p}?v=${version}` })
        .then(resolve, reject)
    }
    if (window.createBarrelModule) return ready()
    const script = document.createElement('script')
    script.src = `/barrel/barrel.js?v=${version}`
    script.async = true
    script.onload = ready
    script.onerror = () => reject(new Error('could not load /barrel/barrel.js'))
    document.head.appendChild(script)
  })
  // A failed load can be retried on the next mount.
  window.__barrelModule = promise.catch((err) => {
    window.__barrelModule = undefined
    throw err
  })
  return window.__barrelModule
}
