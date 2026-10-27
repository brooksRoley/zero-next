import { ALL_KINDS, ALL_LANES, EXTRA_LANES } from './plants'
import { RESULT_KINDS, type GardenState } from './engine'
import { isPerennials } from './perennials'

/** Habit data stays in this browser. It is never sent to the server. */
export const STORAGE_KEY = 'tend_garden_v1'

const isInt = (v: unknown): v is number => Number.isInteger(v)
const isCell = (v: unknown) => Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1])
const isKind = (v: unknown) => (ALL_KINDS as readonly unknown[]).includes(v)
const isIn = (list: readonly unknown[]) => (v: unknown) => list.includes(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Shape-checks parsed JSON, so a corrupted or hand-edited save starts fresh instead of crashing. */
export function isGardenState(v: unknown): v is GardenState {
  if (!isRecord(v) || v.version !== 1) return false
  if (!isInt(v.startDay) || !isInt(v.size) || !isInt(v.nextId)) return false
  if (!isRecord(v.checkins) || !isRecord(v.dormancy)) return false
  const lanesOk = Object.values(v.checkins).every(
    (lanes) => Array.isArray(lanes) && lanes.every(isIn(ALL_LANES)),
  )
  const seedsOk =
    Array.isArray(v.seeds) &&
    v.seeds.every((s) => isRecord(s) && typeof s.id === 'string' && isKind(s.kind) && isInt(s.earnedDay))
  const bedsOk =
    Array.isArray(v.beds) &&
    v.beds.every(
      (b) =>
        isRecord(b) &&
        typeof b.id === 'string' &&
        isKind(b.kind) &&
        isInt(b.plantedDay) &&
        Array.isArray(b.cells) &&
        b.cells.length > 0 &&
        b.cells.every(isCell),
    )
  const dormancyOk = Object.values(v.dormancy).every(
    (list) => Array.isArray(list) && list.every((d) => isRecord(d) && isInt(d.from) && isInt(d.to)),
  )
  const seasonsOk =
    Array.isArray(v.seasons) &&
    v.seasons.every(
      (s) => isRecord(s) && isInt(s.day) && s.kind === 'drought' && Array.isArray(s.hit) && Array.isArray(s.held),
    )
  const notesOk = v.notes === undefined || (Array.isArray(v.notes) && v.notes.every(isKind))
  // Added in M1. Both optional, so a save from before them loads as a five-lane garden with no results.
  const extraOk = v.extraLanes === undefined || (Array.isArray(v.extraLanes) && v.extraLanes.every(isIn(EXTRA_LANES)))
  const resultsOk =
    v.results === undefined ||
    (isRecord(v.results) &&
      Object.entries(v.results).every(
        ([day, kinds]) => /^-?\d+$/.test(day) && Array.isArray(kinds) && kinds.every(isIn(RESULT_KINDS)),
      ))
  // Added in M3, optional: a save from before it loads with no perennials.
  const perennialsOk = v.perennials === undefined || isPerennials(v.perennials)
  return lanesOk && seedsOk && bedsOk && dormancyOk && seasonsOk && notesOk && extraOk && resultsOk && perennialsOk
}

export function loadGarden(storage: Pick<Storage, 'getItem'> | null): GardenState | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isGardenState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveGarden(storage: Pick<Storage, 'setItem'> | null, state: GardenState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage can be full or blocked (private mode); the game still plays this session */
  }
}
