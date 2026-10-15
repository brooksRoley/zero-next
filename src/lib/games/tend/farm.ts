import { mixSeed, rng } from './rng'

/**
 * The Central Valley farm: artificial selection, where you are the season.
 *
 * Eight tomato plants, each with a fruit size (1 to 9) and a variety. Each
 * season you choose which plants to save seed from; the next season grows
 * from those seeds. Offspring vary a little from their parent, and now and
 * then a mutation jumps the size up or down, in a direction that is pure
 * chance. Some seasons a blight strikes one variety: a farm of one variety
 * can lose everything at once.
 *
 * Seeded and deterministic. DRAFT TUNING (Learning Mode): Brooks predicts and
 * tunes the numbers in FARM.
 */

export const VARIETIES = ['Red', 'Gold', 'Plum', 'Pink', 'Striped'] as const
export type Variety = (typeof VARIETIES)[number]
export const VARIETY_COLOR: Record<Variety, string> = {
  Red: '#d9534f',
  Gold: '#ffd166',
  Plum: '#8e5a8a',
  Pink: '#f19bb0',
  Striped: '#c97a3a',
}

export type Plant = { id: number; size: number; variety: Variety; blighted: boolean }

export const FARM = {
  plants: 8,
  /** Each seedling's size differs from its parent by -1, 0 or +1, with these odds. */
  nudgeDown: 0.2,
  nudgeUp: 0.2,
  /** Chance a seedling carries a bigger jump (±2), up or down by chance. */
  mutationRate: 0.12,
  /** Chance a blight strikes in a season; it hits one variety that is growing. */
  blightChance: 0.3,
} as const

const clamp = (v: number) => Math.max(1, Math.min(9, v))

/** Wild seed from the seed bank: small fruit, mixed varieties. */
export function wildPlants(start = 1): Plant[] {
  const sizes = [1, 2, 1, 3, 2, 1, 2, 2]
  const kinds: Variety[] = ['Red', 'Gold', 'Plum', 'Red', 'Pink', 'Gold', 'Striped', 'Plum']
  return sizes.map((size, i) => ({ id: start + i, size, variety: kinds[i], blighted: false }))
}

export type Season = { saved: number[]; before: Plant[]; after: Plant[]; blight: Variety | null; restocked: boolean }

/** Grow a season from the saved plants' seed. With nothing to save from, the seed bank sends wild seed. */
export function growSeason(plants: Plant[], saved: number[], seed: number): Season {
  const random = rng(seed)
  const parents = plants.filter((p) => saved.includes(p.id) && !p.blighted)
  const nextId = Math.max(0, ...plants.map((p) => p.id)) + 1
  let after: Plant[]
  const restocked = parents.length === 0
  if (restocked) {
    after = wildPlants(nextId)
  } else {
    after = Array.from({ length: FARM.plants }, (_, i) => {
      const parent = parents[Math.floor(random() * parents.length)]
      const r = random()
      let size = parent.size + (r < FARM.nudgeDown ? -1 : r < FARM.nudgeDown + FARM.nudgeUp ? 1 : 0)
      if (random() < FARM.mutationRate) size += random() < 0.5 ? -2 : 2
      return { id: nextId + i, size: clamp(size), variety: parent.variety, blighted: false }
    })
  }
  let blight: Variety | null = null
  if (random() < FARM.blightChance) {
    const growing = [...new Set(after.map((p) => p.variety))]
    blight = growing[Math.floor(random() * growing.length)]
    after = after.map((p) => (p.variety === blight ? { ...p, blighted: true } : p))
  }
  return { saved: parents.map((p) => p.id), before: plants, after, blight, restocked }
}

export const averageSize = (plants: Plant[]) => {
  const alive = plants.filter((p) => !p.blighted)
  return alive.length ? alive.reduce((s, p) => s + p.size, 0) / alive.length : 0
}
export const varietiesOf = (plants: Plant[]) => new Set(plants.filter((p) => !p.blighted).map((p) => p.variety)).size

// ── The player's farm ───────────────────────────────────────────────────────

export type FarmPlay = {
  version: 1
  seed: number
  start: Plant[]
  seasons: Season[]
  seen: { saved: boolean; blight: boolean; diverse: boolean }
}

export function newFarmPlay(seed = 7): FarmPlay {
  return { version: 1, seed, start: wildPlants(), seasons: [], seen: { saved: false, blight: false, diverse: false } }
}

export const currentPlants = (play: FarmPlay): Plant[] => play.seasons.at(-1)?.after ?? play.start

export function plantSeason(play: FarmPlay, saved: number[]): FarmPlay {
  const season = growSeason(currentPlants(play), saved, mixSeed(play.seed, play.seasons.length))
  return {
    ...play,
    seasons: [...play.seasons, season],
    seen: {
      saved: play.seen.saved || season.saved.length > 0,
      blight: play.seen.blight || season.blight !== null,
      diverse: play.seen.diverse || (play.seasons.length + 1 >= 3 && varietiesOf(season.after) >= 3),
    },
  }
}

export const rewindSeason = (play: FarmPlay): FarmPlay => ({ ...play, seasons: play.seasons.slice(0, -1) })

/** "Average fruit: 1.8 → 4.6 over 5 seasons." */
export function farmCaption(play: FarmPlay): string | null {
  if (!play.seasons.length) return null
  const n = play.seasons.length
  return `Average fruit size: ${averageSize(play.start).toFixed(1)} → ${averageSize(currentPlants(play)).toFixed(1)} over ${n} ${n === 1 ? 'season' : 'seasons'}.`
}

export const FARM_KEY = 'tend_farm_v1'

export function loadFarm(storage: Pick<Storage, 'getItem'> | null): FarmPlay | null {
  try {
    const v = JSON.parse(storage?.getItem(FARM_KEY) ?? 'null')
    const okPlant = (p: Plant) => p && Number.isInteger(p.id) && Number.isInteger(p.size) && VARIETIES.includes(p.variety) && typeof p.blighted === 'boolean'
    const ok =
      v?.version === 1 &&
      Number.isInteger(v.seed) &&
      Array.isArray(v.start) &&
      v.start.every(okPlant) &&
      Array.isArray(v.seasons) &&
      v.seasons.every((s: Season) => Array.isArray(s.after) && s.after.every(okPlant) && Array.isArray(s.saved)) &&
      typeof v.seen === 'object'
    return ok ? (v as FarmPlay) : null
  } catch {
    return null
  }
}

export function saveFarm(storage: Pick<Storage, 'setItem'> | null, play: FarmPlay): void {
  try {
    storage?.setItem(FARM_KEY, JSON.stringify(play))
  } catch {
    /* storage blocked: the farm still plays this visit */
  }
}

/** DRAFT, pending Brooks's review (Learning Mode). */
export const FARM_COPY = {
  rule: 'Here, you are the season. Pick the plants to save seed from, and next season grows from them.',
  honest: 'A toy model: real breeding takes many more plants and years. The varieties here are made up.',
  monoculture: 'Every plant is one variety now. A single blight could take the whole field.',
  restocked: 'Nothing survived to save seed from, so the seed bank sent wild seed: small fruit, mixed varieties.',
  blightSource: {
    label: 'PLoS Pathogens (2015): bananas and Panama disease',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4652896/',
  },
} as const
