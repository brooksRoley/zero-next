/**
 * BARREL — turning the WASM snapshot into the site's shared game events.
 *
 * One wave is one game. A wave the visitor never tries for (they idle and it
 * passes) is not a game; a wave starts counting at the pop-up, whether it
 * becomes a ride or a wipeout, and ends when the result card shows.
 */
import { CAUSE, OUTCOME, type BarrelSnapshot } from 'src/lib/barrel/module'

const RIDING = 1
const WIPEOUT = 2
const DONE = 3
const MISSED = 4

export type WaveTrackerState = { moveCount: number; finished: boolean }

export function waveTrackerState(s: Pick<BarrelSnapshot, 'state' | 'outcome'>): WaveTrackerState {
  const tried =
    s.state === RIDING || s.state === WIPEOUT || (s.state === DONE && s.outcome !== OUTCOME.indexOf('missed'))
  const finished = s.state === DONE || s.state === MISSED
  return { moveCount: tried ? 1 : 0, finished }
}

export function waveEndMetadata(s: BarrelSnapshot, spot: string, source: string): Record<string, unknown> {
  return {
    outcome: OUTCOME[s.outcome] ?? 'none',
    cause: CAUSE[s.cause] ?? 'none',
    score: Math.round(s.lastScore),
    tube_s: Math.round(s.tubeTime * 10) / 10,
    ride_s: Math.round(s.rideTime * 10) / 10,
    spot,
    source,
    height_m: Math.round(s.condHeight * 10) / 10,
  }
}

const BEST_KEY = 'barrel_best'

export function readBest(): number {
  try {
    const n = Number(window.localStorage.getItem(BEST_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function writeBest(n: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(n)))
  } catch {
    /* storage blocked: the best score lasts this visit only */
  }
}
