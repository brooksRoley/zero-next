import { checkIn, hasCheckedIn, type GardenState } from './engine'
import { KIND_FOR_LANE, LANES, type Lane } from './plants'

/**
 * Habits from a file, for players who already log them somewhere else (Brooks's
 * job-search tool writes one with `agent.py tend-export`). The file is read in
 * the browser and never sent anywhere. It holds dates and lane names only:
 *
 *   { "format": "tend-habits", "version": 1, "days": { "2026-10-27": ["body", "craft"] } }
 *
 * Importing never invents a day and never takes one away. A past day with no
 * check-in gets one if the file shows a habit kept on it; a day the file lists
 * as empty is left alone, since only showing up makes an empty day count. A
 * past day already checked in gains the lanes it was missing. Today is only
 * suggested, so the player still chooses what they kept.
 */

export const HABIT_FORMAT = 'tend-habits'

export type HabitFile = { format: typeof HABIT_FORMAT; version: 1; days: Record<string, Lane[]> }

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

/** Parse and shape-check a habit file. Returns null for anything that isn't one. */
export function parseHabitFile(text: string): HabitFile | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(raw) || raw.format !== HABIT_FORMAT || raw.version !== 1 || !isRecord(raw.days)) return null
  const entries = Object.entries(raw.days)
  if (entries.length > MAX_DAYS) return null
  const days: Record<string, Lane[]> = {}
  for (const [date, lanes] of entries) {
    if (dateToDay(date) === null || !Array.isArray(lanes)) return null
    if (!lanes.every((l) => (LANES as readonly unknown[]).includes(l))) return null
    days[date] = LANES.filter((lane) => lanes.includes(lane))
  }
  return { format: HABIT_FORMAT, version: 1, days }
}

/** Fold a habit file into the garden. Pure: the same garden and file always give the same result. */
export function importHabits(state: GardenState, file: HabitFile, today: number): ImportResult {
  let next = state
  let added = 0
  let merged = 0
  let outside = 0
  let todayLanes: Lane[] = []
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
    const had = next.checkins[String(day)]
    const missing = lanes.filter((lane) => !had.includes(lane))
    if (!missing.length) continue
    let nextId = next.nextId
    const seeds = missing.map((lane) => ({ id: `s${nextId++}`, kind: KIND_FOR_LANE[lane], earnedDay: day }))
    next = {
      ...next,
      checkins: { ...next.checkins, [String(day)]: LANES.filter((l) => had.includes(l) || missing.includes(l)) },
      seeds: [...next.seeds, ...seeds],
      nextId,
    }
    merged++
  }
  return { state: next, added, merged, today: todayLanes, outside }
}
