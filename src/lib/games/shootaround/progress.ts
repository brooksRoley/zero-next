/**
 * Shootaround progress: which stations this browser finished on which day, the
 * streak of complete days, and how the Hardwood station knows a round was played.
 *
 * Local only, like the play journal. A malformed save starts fresh.
 */
import { STATIONS, type StationId } from './puzzles'

export const QUEST_KEY = 'zero_shootaround_v1'
/** Hardwood (public/hardwood) counts each scheme it sends into a fight under this key. */
export const HARDWOOD_MASTERY_KEY = 'tactics_mastery'
/** Days kept in the save; the streak never needs more than an unbroken run back from today. */
export const KEEP_DAYS = 120

/** 'solved' on your own, 'shown' after asking for the answer. Both finish the station. */
export type Outcome = 'solved' | 'shown'

export type DayRecord = {
  done: Partial<Record<StationId, Outcome>>
  /** Hardwood's fight count when this day's Hardwood station opened; null until then. */
  hardwoodBaseline: number | null
}

export type QuestSave = { version: 1; days: Record<string, DayRecord> }

export const emptySave = (): QuestSave => ({ version: 1, days: {} })
const emptyDay = (): DayRecord => ({ done: {}, hardwoodBaseline: null })

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const IDS = new Set<string>(STATIONS.map((s) => s.id))

/** The local calendar day, as YYYY-MM-DD. A day turns over at the player's midnight. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The calendar day before `day`. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

export function dayRecord(save: QuestSave, day: string): DayRecord {
  return save.days[day] ?? emptyDay()
}

export function isComplete(rec: DayRecord): boolean {
  return STATIONS.every((s) => rec.done[s.id])
}

/** The first station not yet done today, or null when the day is complete. */
export function nextStation(rec: DayRecord): StationId | null {
  return STATIONS.find((s) => !rec.done[s.id])?.id ?? null
}

function prune(days: Record<string, DayRecord>, today: string): Record<string, DayRecord> {
  const keep = Object.keys(days).sort().slice(-KEEP_DAYS)
  if (!keep.includes(today) && days[today]) keep.push(today)
  return Object.fromEntries(keep.map((k) => [k, days[k]]))
}

/** Records a finished station. Solving never downgrades to 'shown'. */
export function markDone(save: QuestSave, day: string, station: StationId, outcome: Outcome): QuestSave {
  const rec = dayRecord(save, day)
  const prev = rec.done[station]
  const next: Outcome = prev === 'solved' ? 'solved' : outcome
  const days = { ...save.days, [day]: { ...rec, done: { ...rec.done, [station]: next } } }
  return { version: 1, days: prune(days, day) }
}

/** Remembers Hardwood's fight count the first time today's Hardwood station opens. */
export function setHardwoodBaseline(save: QuestSave, day: string, used: number): QuestSave {
  const rec = dayRecord(save, day)
  if (rec.hardwoodBaseline !== null) return save
  return { version: 1, days: prune({ ...save.days, [day]: { ...rec, hardwoodBaseline: used } }, day) }
}

/**
 * Complete days in a row, counting back from today. An unfinished today doesn't
 * break the streak yet: it counts back from yesterday until midnight.
 */
export function streak(save: QuestSave, today: string): number {
  let day = isComplete(dayRecord(save, today)) ? today : previousDay(today)
  let n = 0
  while (isComplete(dayRecord(save, day))) {
    n += 1
    day = previousDay(day)
  }
  return n
}

/** Total complete days on record. */
export function daysComplete(save: QuestSave): number {
  return Object.values(save.days).filter(isComplete).length
}

/**
 * How many times Hardwood has sent schemes into a fight, from its own save.
 * Hardwood adds one `used` to the chosen offense and coverage each time a fight starts.
 */
export function hardwoodFights(raw: string | null): number {
  if (!raw) return 0
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return 0
    let total = 0
    for (const v of Object.values(data as Record<string, unknown>)) {
      const used = v && typeof v === 'object' ? (v as Record<string, unknown>).used : undefined
      if (typeof used === 'number' && Number.isFinite(used) && used > 0) total += used
    }
    return total
  } catch {
    return 0
  }
}

/** True once Hardwood has started a fight since the station opened. */
export function playedHardwood(rec: DayRecord, fightsNow: number): boolean {
  return rec.hardwoodBaseline !== null && fightsNow > rec.hardwoodBaseline
}

export function parseSave(v: unknown): QuestSave {
  if (!v || typeof v !== 'object') return emptySave()
  const { version, days } = v as Record<string, unknown>
  if (version !== 1 || !days || typeof days !== 'object') return emptySave()
  const out: Record<string, DayRecord> = {}
  for (const [day, rec] of Object.entries(days as Record<string, unknown>)) {
    if (!DAY_RE.test(day) || !rec || typeof rec !== 'object') continue
    const r = rec as Record<string, unknown>
    const done: Partial<Record<StationId, Outcome>> = {}
    if (r.done && typeof r.done === 'object') {
      for (const [id, o] of Object.entries(r.done as Record<string, unknown>)) {
        if (IDS.has(id) && (o === 'solved' || o === 'shown')) done[id as StationId] = o
      }
    }
    const base = r.hardwoodBaseline
    out[day] = { done, hardwoodBaseline: typeof base === 'number' && Number.isFinite(base) && base >= 0 ? base : null }
  }
  return { version: 1, days: out }
}

export function loadSave(storage: Pick<Storage, 'getItem'> | null): QuestSave {
  try {
    const raw = storage?.getItem(QUEST_KEY)
    return raw ? parseSave(JSON.parse(raw)) : emptySave()
  } catch {
    return emptySave()
  }
}

export function writeSave(storage: Pick<Storage, 'setItem'> | null, save: QuestSave): void {
  try {
    storage?.setItem(QUEST_KEY, JSON.stringify(save))
  } catch {
    /* storage may be blocked; progress just won't survive the visit */
  }
}
