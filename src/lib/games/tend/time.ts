import { TUNING } from './tuning'

const DAY_MS = 86_400_000

/**
 * The game day for a moment in local time: whole days since 1970-01-01, where a
 * day starts at `rolloverHour` rather than midnight. Checking in at 1am counts
 * toward the previous day.
 */
export function dayIndex(date: Date, rolloverHour: number = TUNING.rolloverHour): number {
  const shifted = new Date(date.getTime() - rolloverHour * 3_600_000)
  return Math.floor(Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) / DAY_MS)
}
