import { activeLanes, checkIn, hasCheckedIn, RESULT_KINDS, type GardenState, type ResultKind } from './engine'
import { ALL_LANES, EXTRA_LANES, KIND_FOR_LANE, LANES, type ExtraLane, type Lane } from './plants'

/**
 * Habits from a file, for players who already log them somewhere else (Brooks's
 * job-search tool writes one with `agent.py tend-export`). The file is read in
 * the browser and never sent anywhere. It holds dates, lane names and result
 * kinds only:
 *
 *   { "format": "tend-habits", "version": 1, "days": { "2026-10-27": ["body", "craft"] } }
 *
 * Version 2 may also use the opt-in lanes `search` and `study`, and may add
 * `results`, the days something came back from the work:
 *
 *   { "format": "tend-habits", "version": 2,
 *     "days": { "2026-10-27": ["body", "search"] },
 *     "results": { "2026-10-27": ["reply"] } }
 *
 * Importing never invents a day and never takes one away. A past day with no
 * check-in gets one if the file shows a habit kept on it; a day the file lists
 * as empty is left alone, since only showing up makes an empty day count. A
 * past day already checked in gains the lanes it was missing. Today is only
 * suggested, so the player still chooses what they kept.
 *
 * A file that uses an opt-in lane turns that lane on for the garden, for good.
 * Results are recorded to be celebrated and are never scored: they earn no
 * seed and grow no bed.
 */

export const HABIT_FORMAT = 'tend-habits'

export type HabitFile = {
  format: typeof HABIT_FORMAT
  version: 1 | 2
  days: Record<string, Lane[]>
  /** Always present after parsing; empty for a version 1 file. */
  results: Record<string, ResultKind[]>
}

export type ImportResult = {
  state: GardenState
  /** Past days that had no check-in and now do. */
  added: number
  /** Past days already checked in that gained a lane. */
  merged: number
  /** Lanes the file lists for today, to pre-select in the check-in. */
  today: Lane[]
  /** Days before the garden began or after today, left alone. */
  outside: number
  /** Opt-in lanes this import turned on. */
  lanesOn: ExtraLane[]
  /** Results newly recorded, one per kind per day. */
  results: number
}

const DAY_MS = 86_400_000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** More than a year of days is not a habit log this game wrote. */
const MAX_DAYS = 400

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A calendar date as a game day, on the same scale as `dayIndex`. Null for a date that doesn't exist. */
export function dateToDay(date: string): number | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const ms = Date.UTC(y, mo, d)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== d) return null
  return ms / DAY_MS
}

/** A game day as its calendar date, the inverse of `dateToDay`. */
export function dayToDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Check a map of date → list, keeping each list's items in `order`. Null when a
 * date or an item is bad, or there are too many dates.
 */
function datedLists<T extends string>(raw: unknown, order: readonly T[]): Record<string, T[]> | null {
  if (!isRecord(raw)) return null
  const entries = Object.entries(raw)
  if (entries.length > MAX_DAYS) return null
  const out: Record<string, T[]> = {}
  for (const [date, list] of entries) {
    if (dateToDay(date) === null || !Array.isArray(list)) return null
    if (!list.every((item) => (order as readonly unknown[]).includes(item))) return null
    out[date] = order.filter((item) => list.includes(item))
  }
  return out
}

/** Parse and shape-check a habit file, version 1 or 2. Returns null for anything that isn't one. */
export function parseHabitFile(text: string): HabitFile | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(raw) || raw.format !== HABIT_FORMAT) return null
  if (raw.version !== 1 && raw.version !== 2) return null
  const version = raw.version
  // Version 1 predates the opt-in lanes and results, so it may hold neither.
  const days = datedLists<Lane>(raw.days, version === 1 ? LANES : ALL_LANES)
  if (!days) return null
  let results: Record<string, ResultKind[]> = {}
  if (version === 2 && raw.results !== undefined) {
    const parsed = datedLists(raw.results, RESULT_KINDS)
    if (!parsed) return null
    results = parsed
  }
  return { format: HABIT_FORMAT, version, days, results }
}

/** Fold a habit file into the garden. Pure: the same garden and file always give the same result. */
export function importHabits(state: GardenState, file: HabitFile, today: number): ImportResult {
  let next = state
  let added = 0
  let merged = 0
  let outside = 0
  let todayLanes: Lane[] = []

  // A file that holds an opt-in lane turns it on before any day is read, so those days can earn its seeds.
  const had = state.extraLanes ?? []
  const used = new Set(Object.values(file.days).flat())
  const lanesOn = EXTRA_LANES.filter((lane) => used.has(lane) && !had.includes(lane))
  if (lanesOn.length) next = { ...next, extraLanes: EXTRA_LANES.filter((l) => had.includes(l) || lanesOn.includes(l)) }

  const dated = Object.entries(file.days)
    .map(([date, lanes]) => [dateToDay(date) as number, lanes] as const)
    .sort((a, b) => a[0] - b[0])
  for (const [day, lanes] of dated) {
    if (day < state.startDay || day > today) {
      outside++
      continue
    }
    if (day === today && !hasCheckedIn(next, day)) {
      todayLanes = lanes
      continue
    }
    if (!lanes.length) continue
    if (!hasCheckedIn(next, day)) {
      next = checkIn(next, day, lanes)
      added++
      continue
    }
    const kept = next.checkins[String(day)]
    const missing = lanes.filter((lane) => !kept.includes(lane))
    if (!missing.length) continue
    let nextId = next.nextId
    const seeds = missing.map((lane) => ({ id: `s${nextId++}`, kind: KIND_FOR_LANE[lane], earnedDay: day }))
    next = {
      ...next,
      checkins: { ...next.checkins, [String(day)]: activeLanes(next).filter((l) => kept.includes(l) || missing.includes(l)) },
      seeds: [...next.seeds, ...seeds],
      nextId,
    }
    merged++
  }

  // Results: recorded for the days the garden has lived through, merged so the same file never counts twice.
  let results = 0
  for (const [date, kinds] of Object.entries(file.results)) {
    const day = dateToDay(date) as number
    if (day < state.startDay || day > today || !kinds.length) continue
    const was = next.results?.[String(day)] ?? []
    const fresh = kinds.filter((k) => !was.includes(k))
    if (!fresh.length) continue
    results += fresh.length
    next = {
      ...next,
      results: { ...next.results, [String(day)]: RESULT_KINDS.filter((k) => was.includes(k) || fresh.includes(k)) },
    }
  }

  return { state: next, added, merged, today: todayLanes, outside, lanesOn, results }
}
