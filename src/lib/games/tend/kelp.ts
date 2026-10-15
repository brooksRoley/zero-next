/**
 * The kelp forest as a toy model you can push: one lever (otter protection),
 * three populations (otters, urchins, kelp), and a tipping point.
 *
 * A toy, and labelled as one on screen. Real forests are messier, and none of
 * these numbers are measurements: populations are scores from 0 to 9, every
 * rule below is deterministic, and the same start and lever always give the
 * same year, so tests can pin the behaviour exactly.
 *
 * DRAFT TUNING. The constants in KELP are a game-design and modelling surface
 * (Learning Mode): Brooks predicts the behaviour first, then tunes them. The
 * shape the tests hold is the one from the plan: protect otters and the forest
 * stands; cut protection and it collapses into an urchin barren; and bringing
 * it back takes more protection than it took to lose it (hysteresis).
 */

export type Kelp = {
  otters: number
  urchins: number
  kelp: number
  /** Urchins have left their crevices and are grazing standing kelp: the barren state. */
  barren: boolean
}

/** Otter protection, from none (0) to full (4): five notches on the dial. */
export type Protection = 0 | 1 | 2 | 3 | 4
export const NOTCHES: Protection[] = [0, 1, 2, 3, 4]
export const NOTCH_LABEL: Record<Protection, string> = {
  0: 'None',
  1: 'Weak',
  2: 'Some',
  3: 'Strong',
  4: 'Full',
}

export const KELP = {
  /** Steps in a year (one per month). */
  stepsPerYear: 12,
  /** How many otters the coast can hold at each notch: protection raises the ceiling. */
  otterCeiling: [0.5, 2.5, 4.5, 6.5, 8.5] as const,
  /** How fast otters move toward that ceiling each month. */
  otterRate: 0.3,
  /** Urchins eaten per otter per month, at full appetite. */
  predation: 0.12,
  /** Urchin breeding rate, and a trickle of larvae arriving from elsewhere. */
  urchinGrowth: 0.18,
  urchinArrivals: 0.08,
  /** Kelp grazed per urchin per month: little while urchins hide and eat drift, a lot once they roam. */
  grazeHiding: 0.02,
  grazeRoaming: 0.22,
  /** Kelp growth rate and spore arrivals. */
  kelpGrowth: 0.3,
  kelpArrivals: 0.15,
  /** Crowded urchins run short of drifting kelp and leave their crevices to graze: the forest tips into a barren. */
  tipAboveUrchins: 6.5,
  /** A barren only recovers once urchins fall below this: far lower than where the forest tipped. */
  recoverBelowUrchins: 1.5,
} as const

const MAX = 9
const clamp = (v: number) => Math.min(MAX, Math.max(0, v))

export const START: Kelp = { otters: 4.5, urchins: 3, kelp: 8, barren: false }

/** One month. */
export function stepKelp(s: Kelp, p: Protection): Kelp {
  const k = KELP
  const food = Math.min(1, s.urchins / 2)
  const otters = clamp(s.otters + k.otterRate * (k.otterCeiling[p] * food - s.otters))
  const eaten = k.predation * otters * (s.urchins / (s.urchins + 1))
  const bred = k.urchinGrowth * s.urchins * (1 - s.urchins / MAX) + k.urchinArrivals
  const urchins = clamp(s.urchins + bred - eaten)
  const graze = (s.barren ? k.grazeRoaming : k.grazeHiding) * urchins
  const kelp = clamp(s.kelp + k.kelpGrowth * s.kelp * (1 - s.kelp / MAX) + k.kelpArrivals - graze)
  const barren = s.barren ? urchins >= k.recoverBelowUrchins : urchins >= k.tipAboveUrchins
  return { otters, urchins, kelp, barren }
}

/** A year, month by month: `months[0]` is the start, `months[12]` the end. */
export function runYear(start: Kelp, p: Protection): Kelp[] {
  const months = [start]
  for (let i = 0; i < KELP.stepsPerYear; i++) months.push(stepKelp(months[i], p))
  return months
}

/** What a sprite row shows: a whole number from 0 to 9. */
export const shown = (v: number) => Math.round(clamp(v))

export type Species = 'otters' | 'urchins' | 'kelp'
export const SPECIES: Species[] = ['otters', 'urchins', 'kelp']
export const SPECIES_NAME: Record<Species, string> = { otters: 'Otters', urchins: 'Urchins', kelp: 'Kelp' }

export type Ripple = { species: Species; delta: number }[]

/**
 * How this year differed from the ghost year (the same start with the lever
 * left alone), in shown whole numbers, down the food chain: otters, urchins, kelp.
 */
export function ripple(actual: Kelp, ghost: Kelp): Ripple {
  return SPECIES.map((species) => ({ species, delta: shown(actual[species]) - shown(ghost[species]) }))
}

/** "Otters −2 → Urchins +5 → Kelp −6". A species that didn't move shows ±0. */
export function rippleCaption(r: Ripple): string {
  const sign = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0')
  return r.map(({ species, delta }) => `${SPECIES_NAME[species]} ${sign(delta)}`).join(' → ')
}

/** The leverage score: you moved the otters this much; the whole forest moved this much. */
export function leverage(r: Ripple): { moved: number; forest: number } {
  const moved = Math.abs(r.find((x) => x.species === 'otters')!.delta)
  const forest = r.reduce((sum, x) => sum + Math.abs(x.delta), 0)
  return { moved, forest }
}

// ── The player's forest ─────────────────────────────────────────────────────

export type KelpYear = { start: Kelp; end: Kelp; ghost: Kelp; protection: Protection; from: Protection }

export type KelpPlay = {
  version: 1
  /** The protection setting in force now. */
  protection: Protection
  /** Every year run, oldest first. Rewinding drops the last one. */
  years: KelpYear[]
  /** Nudges in hand (moving the lever costs one), and how many garden check-ins have been counted. */
  nudges: number
  credited: number
  /** Chain reactions the player has seen, which collect Journal entries. */
  seen: { barren: boolean; recovered: boolean; bigLeverage: boolean }
}

/** At most this many nudges can be held; extra check-ins don't stack. */
export const MAX_NUDGES = 3

export function newKelpPlay(): KelpPlay {
  return {
    version: 1,
    protection: 2,
    years: [],
    nudges: MAX_NUDGES,
    credited: 0,
    seen: { barren: false, recovered: false, bigLeverage: false },
  }
}

export const currentForest = (play: KelpPlay): Kelp => play.years.at(-1)?.end ?? START

/** Credit one nudge per garden check-in not yet counted, holding at most MAX_NUDGES. */
export function creditNudges(play: KelpPlay, checkins: number): KelpPlay {
  if (checkins <= play.credited) return play
  return { ...play, nudges: Math.min(MAX_NUDGES, play.nudges + (checkins - play.credited)), credited: checkins }
}

/** Run a year at `to`. Changing the lever spends a nudge; running it unchanged is free. Returns null if it can't. */
export function playYear(play: KelpPlay, to: Protection, unlimited = false): KelpPlay | null {
  const changed = to !== play.protection
  if (changed && !unlimited && play.nudges < 1) return null
  const start = currentForest(play)
  const end = runYear(start, to).at(-1)!
  const ghost = runYear(start, play.protection).at(-1)!
  const r = ripple(end, ghost)
  const { moved, forest } = leverage(r)
  const year: KelpYear = { start, end, ghost, protection: to, from: play.protection }
  return {
    ...play,
    protection: to,
    years: [...play.years, year],
    nudges: changed && !unlimited ? play.nudges - 1 : play.nudges,
    seen: {
      barren: play.seen.barren || end.barren,
      recovered: play.seen.recovered || (start.barren && !end.barren),
      bigLeverage: play.seen.bigLeverage || (moved > 0 && forest >= moved * 3),
    },
  }
}

/**
 * Undo the last year, free. The lever goes back to where it was, and a nudge
 * spent on it always comes back, even if check-ins have topped the player up
 * to the cap since (the cap limits what check-ins credit, not refunds).
 */
export function rewindYear(play: KelpPlay, unlimited = false): KelpPlay {
  const last = play.years.at(-1)
  if (!last) return play
  const refund = last.protection !== last.from && !unlimited ? 1 : 0
  return {
    ...play,
    protection: last.from,
    years: play.years.slice(0, -1),
    nudges: play.nudges + refund,
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

export const KELP_KEY = 'tend_kelp_v1'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isKelp = (v: unknown): v is Kelp =>
  typeof v === 'object' &&
  v !== null &&
  isNum((v as Kelp).otters) &&
  isNum((v as Kelp).urchins) &&
  isNum((v as Kelp).kelp) &&
  typeof (v as Kelp).barren === 'boolean'
const isNotch = (v: unknown): v is Protection => (NOTCHES as unknown[]).includes(v)

export function loadKelp(storage: Pick<Storage, 'getItem'> | null): KelpPlay | null {
  try {
    const raw = storage?.getItem(KELP_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    const ok =
      v?.version === 1 &&
      isNotch(v.protection) &&
      isNum(v.nudges) &&
      isNum(v.credited) &&
      Array.isArray(v.years) &&
      v.years.every(
        (y: KelpYear) => isKelp(y.start) && isKelp(y.end) && isKelp(y.ghost) && isNotch(y.protection) && isNotch(y.from),
      ) &&
      typeof v.seen === 'object' &&
      v.seen !== null
    return ok ? (v as KelpPlay) : null
  } catch {
    return null
  }
}

export function saveKelp(storage: Pick<Storage, 'setItem'> | null, play: KelpPlay): void {
  try {
    storage?.setItem(KELP_KEY, JSON.stringify(play))
  } catch {
    /* storage full or blocked: the forest still plays this visit */
  }
}

// ── Words on screen ─────────────────────────────────────────────────────────

/**
 * DRAFT, pending Brooks's review (Learning Mode). What the screen says about
 * each state. The facts come from the Watershed's kelp-forest source (Monterey
 * Bay Aquarium); the model's own behaviour is described as a model.
 */
export const KELP_COPY = {
  honest: 'A toy model: real forests are messier. Populations are scores from 0 to 9, and the same choices always give the same year.',
  forest: 'Otters eat urchins, and urchins hide in crevices eating drifting kelp. The forest stands.',
  barren:
    'Urchin barren. Crowded urchins have left their crevices and are grazing standing kelp down to bare rock. A barren is stable: it stays even after the otters return, until the urchins are few again.',
  recovered: 'The urchins are few enough to hide again, and the kelp is growing back from spores.',
  ghost: 'Dashed: the same year with the lever left where it was.',
  source: { label: 'Monterey Bay Aquarium: kelp forests', url: 'https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest' },
} as const
