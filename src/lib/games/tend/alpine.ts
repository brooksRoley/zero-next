import { mixSeed, rng } from './rng'

/**
 * The alpine tier's pikas: natural selection you can watch but not steer.
 *
 * Coat variants appear at random, drawn without regard to what would help.
 * The one lever is the summer's heat, which decides which coats leave more
 * young. The population is small, so luck (genetic drift) matters too: a
 * helpful variant can vanish by chance. If no helpful variant is there, the
 * population can simply decline. The player never picks a variant.
 *
 * A toy model with whole-animal counts and a seeded random generator, so a
 * run replays exactly. DRAFT TUNING (Learning Mode): Brooks predicts and tunes
 * the numbers in ALPINE.
 */

export type Coat = 'standard' | 'thick' | 'thin' | 'pale' | 'patchy'
export const COATS: Coat[] = ['standard', 'thick', 'thin', 'pale', 'patchy']
export const COAT_NAME: Record<Coat, string> = {
  standard: 'Standard coat',
  thick: 'Thick coat',
  thin: 'Thin coat',
  pale: 'Pale coat',
  patchy: 'Patchy coat',
}
export const COAT_COLOR: Record<Coat, string> = {
  standard: '#b9a68d',
  thick: '#8a7356',
  thin: '#e2cfae',
  pale: '#d8d4cc',
  patchy: '#7f8a7a',
}

export type Heat = 0 | 1 | 2 | 3 | 4
export const HEATS: Heat[] = [0, 1, 2, 3, 4]
export const HEAT_LABEL: Record<Heat, string> = { 0: 'Cool', 1: 'Mild', 2: 'Usual', 3: 'Hot', 4: 'Heatwave' }

export const ALPINE = {
  generations: 20,
  startSize: 20,
  maxSize: 24,
  /** Chance per generation that one newborn carries a new random coat variant. */
  mutationRate: 0.15,
  /** How much each degree of heat above "Usual" cuts every pika's breeding success. */
  heatStress: 0.08,
  /** How much a thick or thin coat helps or hurts per degree of heat away from "Usual". */
  coatEffect: 0.12,
  /** A patchy coat is slightly worse everywhere; most new variants do nothing or a little harm. */
  patchyCost: 0.04,
  /** Growth rate of a small population in a good year; it slows as the slope fills up (logistic growth). */
  growth: 0.3,
} as const

/** Relative breeding success of a coat in a summer of `heat`. */
export function fitness(coat: Coat, heat: Heat): number {
  const away = heat - 2
  const stress = 1 - ALPINE.heatStress * Math.max(0, away)
  const bonus =
    coat === 'thin' ? ALPINE.coatEffect * away : coat === 'thick' ? -ALPINE.coatEffect * away : coat === 'patchy' ? -ALPINE.patchyCost : 0
  return stress * (1 + bonus)
}

/** A coat that would do better than the standard one this summer. */
export const helpful = (coat: Coat, heat: Heat) => fitness(coat, heat) > fitness('standard', heat) + 1e-9

export type Pikas = Record<Coat, number>
export const total = (p: Pikas) => COATS.reduce((sum, c) => sum + p[c], 0)
export const share = (p: Pikas, c: Coat) => (total(p) ? p[c] / total(p) : 0)

export const START_PIKAS: Pikas = { standard: ALPINE.startSize, thick: 0, thin: 0, pale: 0, patchy: 0 }

/** One generation: breed by fitness with chance in who gets lucky, then maybe one new variant. */
export function generation(p: Pikas, heat: Heat, random: () => number): Pikas {
  const n = total(p)
  if (n === 0) return p
  const weights = COATS.map((c) => p[c] * fitness(c, heat))
  const mean = weights.reduce((a, b) => a + b, 0) / n
  const room = 1 + ALPINE.growth * (1 - n / ALPINE.maxSize)
  const size = Math.max(0, Math.min(ALPINE.maxSize, Math.round(n * mean * room)))
  const sum = weights.reduce((a, b) => a + b, 0)
  const next: Pikas = { standard: 0, thick: 0, thin: 0, pale: 0, patchy: 0 }
  for (let i = 0; i < size; i++) {
    let r = random() * sum
    let j = 0
    while (j < COATS.length - 1 && r >= weights[j]) r -= weights[j++]
    next[COATS[j]]++
  }
  // A new variant arises by chance, and which one is also chance: nothing here looks at the heat.
  if (size > 0 && random() < ALPINE.mutationRate) {
    const from = COATS.filter((c) => next[c] > 0)
    const was = from[Math.floor(random() * from.length)]
    const to = COATS.filter((c) => c !== was)[Math.floor(random() * (COATS.length - 1))]
    next[was]--
    next[to]++
  }
  return next
}

export type AlpineRun = { heat: Heat; seed: number; history: Pikas[] }

export function runGenerations(start: Pikas, heat: Heat, seed: number): AlpineRun {
  const random = rng(seed)
  const history = [start]
  for (let g = 0; g < ALPINE.generations; g++) history.push(generation(history[g], heat, random))
  return { heat, seed, history }
}

/** What happened in a run, in the terms the Journal collects. */
export function readRun(run: AlpineRun): { spread: Coat | null; lost: Coat | null; declined: boolean } {
  const first = run.history[0]
  const last = run.history.at(-1)!
  // Only a coat that suits the summer counts as spreading by selection; anything else that rose got lucky.
  const spread = COATS.find((c) => helpful(c, run.heat) && share(first, c) < 0.1 && share(last, c) >= 0.4) ?? null
  const lost =
    COATS.find((c) => helpful(c, run.heat) && run.history.some((p) => p[c] > 0) && last[c] === 0) ?? null
  const declined = total(last) < total(first) * 0.75 && !COATS.some((c) => helpful(c, run.heat) && share(last, c) >= 0.1)
  return { spread, lost, declined }
}

/** The headline: the coat whose share moved most, as "Thin coat: 4% → 38% over 20 generations". */
export function runCaption(run: AlpineRun): string {
  const first = run.history[0]
  const last = run.history.at(-1)!
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const moved = COATS.filter((c) => c !== 'standard').sort(
    (a, b) => Math.abs(share(last, b) - share(first, b)) - Math.abs(share(last, a) - share(first, a)),
  )[0]
  const pop = `Pikas: ${total(first)} → ${total(last)}.`
  if (Math.abs(share(last, moved) - share(first, moved)) < 0.05) return `No coat changed much. ${pop}`
  return `${COAT_NAME[moved]}: ${pct(share(first, moved))} → ${pct(share(last, moved))} over ${ALPINE.generations} generations. ${pop}`
}

// ── The player's slope ──────────────────────────────────────────────────────

export type AlpinePlay = {
  version: 1
  heat: Heat
  seed: number
  runs: AlpineRun[]
  seen: { spread: boolean; lost: boolean; declined: boolean }
}

export function newAlpinePlay(seed = 1): AlpinePlay {
  return { version: 1, heat: 2, seed, runs: [], seen: { spread: false, lost: false, declined: false } }
}

export const currentPikas = (play: AlpinePlay): Pikas => play.runs.at(-1)?.history.at(-1) ?? START_PIKAS

export function playGenerations(play: AlpinePlay, heat: Heat): AlpinePlay {
  const run = runGenerations(currentPikas(play), heat, mixSeed(play.seed, play.runs.length))
  const r = readRun(run)
  return {
    ...play,
    heat,
    runs: [...play.runs, run],
    seen: { spread: play.seen.spread || !!r.spread, lost: play.seen.lost || !!r.lost, declined: play.seen.declined || r.declined },
  }
}

export function rewindGenerations(play: AlpinePlay): AlpinePlay {
  const runs = play.runs.slice(0, -1)
  return { ...play, runs, heat: runs.at(-1)?.heat ?? 2 }
}

/** A fresh slope: start again from twenty standard-coated pikas, with a new seed so luck plays differently. */
export const restartAlpine = (play: AlpinePlay): AlpinePlay => ({ ...newAlpinePlay(mixSeed(play.seed, 999)), seen: play.seen })

export const ALPINE_KEY = 'tend_alpine_v1'

export function loadAlpine(storage: Pick<Storage, 'getItem'> | null): AlpinePlay | null {
  try {
    const v = JSON.parse(storage?.getItem(ALPINE_KEY) ?? 'null')
    const okPikas = (p: Pikas) => p && COATS.every((c) => Number.isInteger(p[c]) && p[c] >= 0)
    const ok =
      v?.version === 1 &&
      HEATS.includes(v.heat) &&
      Number.isInteger(v.seed) &&
      Array.isArray(v.runs) &&
      v.runs.every((r: AlpineRun) => HEATS.includes(r.heat) && Array.isArray(r.history) && r.history.every(okPikas)) &&
      typeof v.seen === 'object'
    return ok ? (v as AlpinePlay) : null
  } catch {
    return null
  }
}

export function saveAlpine(storage: Pick<Storage, 'setItem'> | null, play: AlpinePlay): void {
  try {
    storage?.setItem(ALPINE_KEY, JSON.stringify(play))
  } catch {
    /* storage blocked: the slope still plays this visit */
  }
}

/** DRAFT, pending Brooks's review (Learning Mode). Wording from the UC Museum of Paleontology misconceptions guide. */
export const ALPINE_COPY = {
  rule: 'You can’t make a mutation; you can change what gets selected. New coats appear by chance, and the summer decides which ones leave more young.',
  honest: 'A toy model: real pikas are messier. Coat variants here are made up to show the process; pika heat stress is real.',
  spread: 'A variant that suits this summer is spreading: pikas carrying it left more young, generation after generation.',
  lost: 'A helpful variant was lost by chance. In a small population, luck in who leaves young (genetic drift) can erase even a good variant.',
  declined: 'No helpful variant was there, so the population declined. Selection can’t give a population what it needs; it can only work with the variation that happens to be there.',
  source: { label: 'UC Museum of Paleontology: misconceptions about evolution', url: 'https://evolution.berkeley.edu/wp-content/uploads/2021/10/misconceptions_about_evolution_2020.pdf' },
} as const
