/**
 * Read & React — the defense's scouting report on you, kept between visits.
 *
 * Within a series the defense already keys on your play-call history
 * (defense.ts). This file makes that memory outlast the series: every finished
 * series is folded into a report of how often you call each play, with older
 * series fading (×DECAY each time), and the next series starts with the defense
 * already leaning on those habits.
 *
 * The design idea is a lite Nemesis system: an opponent that remembers you is
 * the game's lesson — don't be predictable — carried across sessions.
 *
 * It stays fair. Par is the game's minimax value; the equilibrium mix earns at
 * least that against every scheme, so a prior about you can only punish
 * habits, never a sound mix (levels.test / scouting.test check this).
 */
import type { RRLevel } from './levels'

export const SCOUTING_KEY = 'readreact_scouting_v1'

/** How much each older series still counts when a new one is folded in. */
export const DECAY = 0.7

/** The report is worth this many possessions of evidence at the start of a series. */
export const PRIOR_WEIGHT = 3

/** Below this many (decayed) possessions on file the defense has nothing to say. */
export const MIN_EVIDENCE = 6

export type Scouting = {
  version: 1
  series: number
  /** Decayed play-call counts by play id ("paint", "mid", "corner3"). */
  counts: Record<string, number>
}

export const emptyScouting = (): Scouting => ({ version: 1, series: 0, counts: {} })

/** Folds one finished series into the report: older evidence fades, this series counts in full. */
export function recordSeries(report: Scouting, level: RRLevel, playCounts: number[]): Scouting {
  const counts: Record<string, number> = {}
  for (const [id, n] of Object.entries(report.counts)) counts[id] = n * DECAY
  level.plays.forEach((play, i) => {
    counts[play.id] = (counts[play.id] ?? 0) + (playCounts[i] ?? 0)
  })
  return { version: 1, series: report.series + 1, counts }
}

const evidence = (report: Scouting, level: RRLevel) =>
  level.plays.reduce((sum, p) => sum + (report.counts[p.id] ?? 0), 0)

/**
 * Pseudo-counts that seed the defense's model for a new series of `level`:
 * your historical share of each of this level's plays, worth PRIOR_WEIGHT
 * possessions in total. All zeros when there is too little on file, which
 * leaves the defense exactly as it plays for a first-time visitor.
 */
export function priorCounts(report: Scouting, level: RRLevel): number[] {
  const total = evidence(report, level)
  if (total < MIN_EVIDENCE) return level.plays.map(() => 0)
  return level.plays.map((p) => ((report.counts[p.id] ?? 0) / total) * PRIOR_WEIGHT)
}

export type Read = {
  /** The play you lean on most among this level's plays. */
  playId: string
  label: string
  /** Its share of your calls, 0–1. */
  share: number
  series: number
}

/** The defense's headline read on you for this level, or null if it has none worth saying. */
export function headlineRead(report: Scouting, level: RRLevel): Read | null {
  const total = evidence(report, level)
  if (total < MIN_EVIDENCE) return null
  let best = level.plays[0]
  for (const p of level.plays) if ((report.counts[p.id] ?? 0) > (report.counts[best.id] ?? 0)) best = p
  return { playId: best.id, label: best.label, share: (report.counts[best.id] ?? 0) / total, series: report.series }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseScouting(v: unknown): Scouting {
  if (!isRecord(v) || v.version !== 1 || !Number.isInteger(v.series) || !isRecord(v.counts)) return emptyScouting()
  const counts: Record<string, number> = {}
  for (const [id, n] of Object.entries(v.counts)) {
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && id.length <= 32) counts[id] = n
  }
  return { version: 1, series: Math.max(0, v.series as number), counts }
}

export function loadScouting(storage: Pick<Storage, 'getItem'> | null): Scouting {
  try {
    const raw = storage?.getItem(SCOUTING_KEY)
    return raw ? parseScouting(JSON.parse(raw)) : emptyScouting()
  } catch {
    return emptyScouting()
  }
}

export function saveScouting(storage: Pick<Storage, 'setItem'> | null, report: Scouting): void {
  try {
    storage?.setItem(SCOUTING_KEY, JSON.stringify(report))
  } catch {
    /* storage blocked — the defense forgets you, which is also fine */
  }
}

export function clearScouting(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(SCOUTING_KEY)
  } catch {
    /* nothing to clear */
  }
}
