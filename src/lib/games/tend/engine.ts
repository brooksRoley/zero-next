import { ALL_LANES, KIND_FOR_LANE, LANES, type Cell, type ExtraLane, type Lane, type PlantKind } from './plants'
import type { Perennial } from './perennials'
import { TUNING } from './tuning'

/**
 * Tend's rules as pure functions over a plain, JSON-safe state. Nothing here
 * reads the clock: every function takes the game day it should act on, so the
 * whole game replays identically in tests.
 */

export type Seed = { id: string; kind: PlantKind; earnedDay: number }

export type Bed = { id: string; kind: PlantKind; cells: Cell[]; plantedDay: number }

/** A bed sleeps on days `from` through `to - 1`. */
export type Dormancy = { from: number; to: number }

export type SeasonKind = 'drought'

export type SeasonResult = { day: number; kind: SeasonKind; hit: string[]; held: string[] }

export type GardenState = {
  version: 1
  startDay: number
  size: number
  /** Day → the habit lanes kept that day. An empty list is still a check-in. */
  checkins: Record<string, Lane[]>
  seeds: Seed[]
  beds: Bed[]
  dormancy: Record<string, Dormancy[]>
  seasons: SeasonResult[]
  nextId: number
  /** Plants whose field note is unlocked (first bloom). Optional so older saves still load. */
  notes?: PlantKind[]
  /** Opt-in lanes this garden has turned on by importing a file that holds them. Optional so older saves still load. */
  extraLanes?: ExtraLane[]
  /**
   * Day → results that came in that day (a reply, a screen, an onsite, an offer), from an imported file.
   * Celebrated, never scored: nothing here grows a bed or earns a seed. Optional so older saves still load.
   */
  results?: Record<string, ResultKind[]>
  /**
   * The skill tree from an imported file (version 3), drawn as perennials beside the garden.
   * Only ever added to, never reset by a season, and never a bed. Optional so older saves still load.
   */
  perennials?: Perennial[]
}

/** Results are what other people do in answer to the work. The work is scored; these never are. */
export const RESULT_KINDS = ['reply', 'screen', 'onsite', 'offer'] as const
export type ResultKind = (typeof RESULT_KINDS)[number]

/** The lanes this garden checks in on: the five every garden has, plus any it has opted into, in check-in order. */
export function activeLanes(state: GardenState): Lane[] {
  const extra = state.extraLanes ?? []
  return ALL_LANES.filter((lane) => (LANES as readonly Lane[]).includes(lane) || (extra as Lane[]).includes(lane))
}

export type Stage = 0 | 1 | 2 | 3
export const STAGE_NAMES = ['seed', 'sprout', 'grown', 'in bloom'] as const

export function newGarden(today: number): GardenState {
  return {
    version: 1,
    startDay: today,
    size: TUNING.gridSize,
    checkins: {},
    seeds: [],
    beds: [],
    dormancy: {},
    seasons: [],
    nextId: 1,
  }
}

// ── Check-in ────────────────────────────────────────────────────────────────

export function hasCheckedIn(state: GardenState, day: number): boolean {
  return Object.prototype.hasOwnProperty.call(state.checkins, String(day))
}

/** One check-in per day. Each habit lane kept earns one seed of its plant. */
export function checkIn(state: GardenState, day: number, lanes: readonly Lane[]): GardenState {
  if (hasCheckedIn(state, day)) return state
  const kept = activeLanes(state).filter((lane) => lanes.includes(lane))
  let nextId = state.nextId
  const seeds = kept.map((lane) => ({ id: `s${nextId++}`, kind: KIND_FOR_LANE[lane], earnedDay: day }))
  return {
    ...state,
    checkins: { ...state.checkins, [String(day)]: kept },
    seeds: [...state.seeds, ...seeds],
    nextId,
  }
}

// ── Placement ───────────────────────────────────────────────────────────────

const cellKey = ([x, y]: Cell) => `${x},${y}`

/** A shape moved so its top-left corner sits at `anchor`. */
export function translate(shape: readonly Cell[], anchor: Cell): Cell[] {
  return shape.map(([x, y]) => [x + anchor[0], y + anchor[1]] as Cell)
}

export function occupied(state: GardenState): Set<string> {
  return new Set(state.beds.flatMap((bed) => bed.cells.map(cellKey)))
}

export function canPlace(state: GardenState, cells: readonly Cell[]): boolean {
  return misfit(state, cells) === null
}

export type Misfit = { reason: 'edge' } | { reason: 'overlap'; bed: Bed }

/** Why a set of cells can't be planted, or null when it fits. The edge is reported first. */
export function misfit(state: GardenState, cells: readonly Cell[]): Misfit | null {
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= state.size || y >= state.size)) return { reason: 'edge' }
  const wanted = new Set(cells.map(cellKey))
  const bed = state.beds.find((b) => b.cells.some((c) => wanted.has(cellKey(c))))
  return bed ? { reason: 'overlap', bed } : null
}

/**
 * Root a seed. `shape` must be one of the seed's orientations; once rooted a
 * bed never moves. Returns the state unchanged if the seed or the spot is bad.
 */
export function placeSeed(
  state: GardenState,
  seedId: string,
  shape: readonly Cell[],
  anchor: Cell,
  day: number,
): GardenState {
  const seed = state.seeds.find((s) => s.id === seedId)
  const cells = translate(shape, anchor)
  if (!seed || !canPlace(state, cells)) return state
  const bed: Bed = { id: `b${state.nextId}`, kind: seed.kind, cells, plantedDay: day }
  return {
    ...state,
    seeds: state.seeds.filter((s) => s.id !== seedId),
    beds: [...state.beds, bed],
    nextId: state.nextId + 1,
  }
}

/** Give up a seed that will not fit. */
export function compostSeed(state: GardenState, seedId: string): GardenState {
  return { ...state, seeds: state.seeds.filter((s) => s.id !== seedId) }
}

// ── Neighbours ──────────────────────────────────────────────────────────────

/** Beds that share an edge with `bed`. */
export function touching(beds: readonly Bed[], bed: Bed): Bed[] {
  const around = new Set(
    bed.cells.flatMap(([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Cell[]).map(cellKey),
  )
  return beds.filter((other) => other.id !== bed.id && other.cells.some((c) => around.has(cellKey(c))))
}

/** An oak occupies a cell directly above one of this bed's cells. */
export function skyBlocked(beds: readonly Bed[], bed: Bed): boolean {
  const above = new Set(bed.cells.map(([x, y]) => cellKey([x, y - 1])))
  return beds.some((other) => other.kind === 'oak' && other.cells.some((c) => above.has(cellKey(c))))
}

// ── Growth ──────────────────────────────────────────────────────────────────

export function isDormant(state: GardenState, bedId: string, day: number): boolean {
  return (state.dormancy[bedId] ?? []).some((d) => day >= d.from && day < d.to)
}

/** Check-in days after planting, up to `today`, on which the bed was awake. */
export function tendedDays(state: GardenState, bed: Bed, today: number): number {
  return Object.keys(state.checkins)
    .map(Number)
    .filter((day) => day > bed.plantedDay && day <= today && !isDormant(state, bed.id, day)).length
}

export function stageOf(state: GardenState, bed: Bed, today: number): Stage {
  let days = tendedDays(state, bed, today)
  if (bed.kind === 'vine' || bed.kind === 'toyon') {
    const oaks = touching(state.beds, bed).filter((b) => b.kind === 'oak').length
    const perOak = bed.kind === 'vine' ? TUNING.vineDaysPerOak : TUNING.toyonDaysPerOak
    if (days > 0) days += oaks * perOak
  }
  const thresholds = TUNING.stageDays[bed.kind]
  let stage = 0
  for (let s = 1; s <= 3; s++) {
    if (days >= thresholds[s]) stage = s
  }
  if (bed.kind === 'sunflower' && stage === 3 && skyBlocked(state.beds, bed)) stage = 2
  return stage as Stage
}

export function bloomCount(state: GardenState, today: number): number {
  return state.beds.filter((bed) => !isDormant(state, bed.id, today) && stageOf(state, bed, today) === 3).length
}

// ── Seasons ─────────────────────────────────────────────────────────────────

/** The first season day strictly after `day`. */
export function nextSeasonDay(state: GardenState, day: number): number {
  const every = TUNING.seasonEveryDays
  const passed = Math.max(0, Math.floor((day - state.startDay) / every))
  return state.startDay + (passed + 1) * every
}

/** Days until the next season, when it falls inside the forecast window. */
export function forecast(state: GardenState, today: number): { day: number; kind: SeasonKind; inDays: number } | null {
  const day = nextSeasonDay(state, today)
  const inDays = day - today
  return inDays <= TUNING.forecastDays ? { day, kind: 'drought', inDays } : null
}

/**
 * Drought: every bed planted before the season day is hit unless it is a fern,
 * touches a fern, is a buckwheat (drought hardy, though it shelters nobody), or
 * is already sleeping. A hit bed sleeps for `dormantDays`, one fewer if it
 * touches a moonflower.
 */
export function resolveDrought(state: GardenState, day: number): GardenState {
  const eligible = state.beds.filter((bed) => bed.plantedDay < day && !isDormant(state, bed.id, day))
  const hit: string[] = []
  const held: string[] = []
  const dormancy = { ...state.dormancy }
  for (const bed of eligible) {
    const near = touching(eligible, bed)
    if (bed.kind === 'fern' || bed.kind === 'buckwheat' || near.some((b) => b.kind === 'fern')) {
      held.push(bed.id)
      continue
    }
    hit.push(bed.id)
    const calm = near.some((b) => b.kind === 'moonflower') ? TUNING.moonflowerRecoveryDays : 0
    dormancy[bed.id] = [...(dormancy[bed.id] ?? []), { from: day, to: day + TUNING.dormantDays - calm }]
  }
  return { ...state, dormancy, seasons: [...state.seasons, { day, kind: 'drought', hit, held }] }
}

/** Resolve, in order, every season that has arrived by `today` and not yet run. */
export function resolveSeasons(state: GardenState, today: number): GardenState {
  let next = state
  const last = state.seasons.at(-1)?.day ?? state.startDay
  for (let day = nextSeasonDay(state, last); day <= today; day += TUNING.seasonEveryDays) {
    next = resolveDrought(next, day)
  }
  return next
}

// ── Field notes ─────────────────────────────────────────────────────────────

/** Unlock the field note of every plant kind that is in bloom today. */
export function unlockNotes(state: GardenState, today: number): GardenState {
  const have = state.notes ?? []
  const fresh = state.beds
    .filter((bed) => !have.includes(bed.kind) && !isDormant(state, bed.id, today) && stageOf(state, bed, today) === 3)
    .map((bed) => bed.kind)
  if (!fresh.length) return state
  return { ...state, notes: [...have, ...new Set(fresh)] }
}

// ── Previews ────────────────────────────────────────────────────────────────

export type PlacementEffect = {
  /** Neighbours this bed would help: ferns and datura protect, oaks speed up vines and toyons. */
  helps: Bed[]
  /** Poppies an oak here would shade out of bloom. */
  shades: Bed[]
  /** What happens to the new bed itself: a vine or toyon beside an oak grows faster, a poppy under one won't bloom. */
  self: 'helped' | 'shaded' | null
}

/** Kinds that grow faster beside an oak. */
const OAK_HELPED: readonly PlantKind[] = ['vine', 'toyon']

/** What rooting `kind` on `cells` would do, so the player sees the effect before committing. */
export function placementEffect(state: GardenState, kind: PlantKind, cells: readonly Cell[]): PlacementEffect {
  const bed: Bed = { id: '__preview', kind, cells: [...cells], plantedDay: 0 }
  const beds = [...state.beds, bed]
  const near = touching(beds, bed)
  // Only beds the drought rules would treat differently: a fern saves beds no fern already holds; a datura's
  // shorter sleep doesn't stack, and doesn't matter to a bed a fern keeps awake. A buckwheat never sleeps anyway.
  const fernSafe = (b: Bed) =>
    b.kind === 'fern' || b.kind === 'buckwheat' || touching(state.beds, b).some((n) => n.kind === 'fern')
  const calmed = (b: Bed) => touching(state.beds, b).some((n) => n.kind === 'moonflower')
  const helps =
    kind === 'fern'
      ? near.filter((b) => !fernSafe(b))
      : kind === 'moonflower'
        ? near.filter((b) => !fernSafe(b) && !calmed(b))
        : kind === 'oak'
          ? near.filter((b) => OAK_HELPED.includes(b.kind))
          : []
  const shades =
    kind === 'oak'
      ? state.beds.filter((b) => b.kind === 'sunflower' && !skyBlocked(state.beds, b) && skyBlocked(beds, b))
      : []
  const self =
    OAK_HELPED.includes(kind) && near.some((b) => b.kind === 'oak')
      ? 'helped'
      : kind === 'sunflower' && skyBlocked(beds, bed)
        ? 'shaded'
        : null
  return { helps, shades, self }
}

/** Beds that reached a new stage between two states (for example across a check-in), in planting order. */
export function grewBetween(before: GardenState, after: GardenState, today: number): { grew: string[]; bloomed: string[] } {
  const grew: string[] = []
  const bloomed: string[] = []
  for (const bed of after.beds) {
    const old = before.beds.find((b) => b.id === bed.id)
    if (!old || isDormant(after, bed.id, today)) continue
    const was = stageOf(before, old, today)
    const now = stageOf(after, bed, today)
    if (now > was) grew.push(bed.id)
    if (now === 3 && was < 3) bloomed.push(bed.id)
  }
  return { grew, bloomed }
}

// ── Results ─────────────────────────────────────────────────────────────────

/** Every result on record, newest first, one entry per kind per day. For display only: results never score. */
export function resultLog(state: GardenState): { day: number; kind: ResultKind }[] {
  return Object.entries(state.results ?? {})
    .map(([day, kinds]) => [Number(day), kinds] as const)
    .sort((a, b) => b[0] - a[0])
    .flatMap(([day, kinds]) => RESULT_KINDS.filter((k) => kinds.includes(k)).map((kind) => ({ day, kind })))
}

/** One plain, true line per result kind. DRAFT COPY for Brooks's review: it says what happened and adds no praise. */
export const RESULT_LINES: Record<ResultKind, string> = {
  reply: 'Someone wrote back.',
  screen: 'Moved on to a screen.',
  onsite: 'Moved on to an onsite.',
  offer: 'An offer came in.',
}
