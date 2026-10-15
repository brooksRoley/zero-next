import { checkIn, newGarden, placeSeed, resolveSeasons, unlockNotes, type GardenState } from './engine'
import { LANES, orientations, PLANTS, type Cell, type Lane, type PlantKind } from './plants'

/**
 * A finished-looking garden for visitors who have none: forty days of play,
 * built by running the real rules, so everything on screen (stages, droughts,
 * field notes, watershed tiers) is exactly what a player would have earned.
 * It is shown read-only and never saved.
 */

export const SAMPLE_DAYS = 40

type Planting = { day: number; kind: PlantKind; anchor: Cell; turn?: number }

/** Day (from the start), plant and spot. Ferns sit beside the others so most beds hold through a drought. */
const PLANTINGS: Planting[] = [
  { day: 1, kind: 'oak', anchor: [0, 0] },
  { day: 2, kind: 'vine', anchor: [2, 0] },
  { day: 3, kind: 'fern', anchor: [2, 1] },
  { day: 5, kind: 'sunflower', anchor: [5, 0] },
  { day: 6, kind: 'moonflower', anchor: [0, 3] },
  { day: 11, kind: 'fern', anchor: [2, 3] },
  { day: 16, kind: 'oak', anchor: [4, 4] },
  { day: 19, kind: 'sunflower', anchor: [5, 2] },
  { day: 23, kind: 'vine', anchor: [1, 5] },
  { day: 36, kind: 'sunflower', anchor: [5, 1] },
]

/** Days off, like a real player has. Nothing dies; those days just don't grow anything. */
const SKIPPED = new Set([9, 17, 26, 31])

/** Today's seeds, waiting to be planted. */
const TODAY_LANES: Lane[] = ['joy', 'green']

const laneFor = (kind: PlantKind): Lane => PLANTS[kind].lane

export function sampleGarden(today: number): GardenState {
  const start = today - (SAMPLE_DAYS - 1)
  let g = newGarden(start)
  for (let d = 0; d < SAMPLE_DAYS; d++) {
    const day = start + d
    g = resolveSeasons(g, day)
    const plantings = PLANTINGS.filter((p) => p.day === d)
    if (d === SAMPLE_DAYS - 1) {
      g = checkIn(g, day, TODAY_LANES)
    } else if (!SKIPPED.has(d)) {
      // A rotating habit or two, plus whatever is planted today; unplanted extras go to compost.
      const lanes = new Set<Lane>([LANES[d % LANES.length], ...plantings.map((p) => laneFor(p.kind))])
      g = checkIn(g, day, [...lanes])
      for (const p of plantings) {
        const seed = g.seeds.find((s) => s.kind === p.kind)
        if (!seed) continue
        const shapes = orientations(p.kind)
        g = placeSeed(g, seed.id, shapes[(p.turn ?? 0) % shapes.length], p.anchor, day)
      }
      g = { ...g, seeds: [] }
    }
    g = unlockNotes(g, day)
  }
  return g
}
