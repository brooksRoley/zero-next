import { occupied, type GardenState } from './engine'
import type { Cell, PlantKind } from './plants'

export type PetId = 'nalu' | 'pika' | 'nanu'

export type PetDef = {
  id: PetId
  name: string
  species: 'dog' | 'cat'
  /** One line on where this pet likes to be, shown on hover. */
  habit: string
  /** Plants this pet will not sit next to. */
  avoids: PlantKind[]
  /** Higher is a better spot. Only called for open, safe cells. */
  likes: (garden: GardenState, cell: Cell) => number
}

const key = ([x, y]: Cell) => `${x},${y}`
const around = ([x, y]: Cell): Cell[] => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]

function kindAt(garden: GardenState, cell: Cell): PlantKind | null {
  const k = key(cell)
  return garden.beds.find((bed) => bed.cells.some((c) => key(c) === k))?.kind ?? null
}

/** An oak directly above means the cell is in its shade. */
const shaded = (garden: GardenState, [x, y]: Cell) => kindAt(garden, [x, y - 1]) === 'oak'
const nextTo = (garden: GardenState, cell: Cell, kind: PlantKind) => around(cell).some((c) => kindAt(garden, c) === kind)

export const PETS: PetDef[] = [
  {
    id: 'nalu',
    name: 'Nalu',
    species: 'dog',
    habit: 'Nalu sniffs along the beds but never near the grapes or datura: both are toxic to dogs.',
    avoids: ['vine', 'moonflower'],
    likes: (g, cell) => around(cell).filter((c) => kindAt(g, c) !== null).length,
  },
  {
    id: 'pika',
    name: 'Pika',
    species: 'cat',
    habit: 'Pika finds the sunniest open soil, well away from the datura.',
    avoids: ['moonflower'],
    likes: (g, cell) => (shaded(g, cell) ? 0 : 2) + (nextTo(g, cell, 'sunflower') ? 1 : 0),
  },
  {
    id: 'nanu',
    name: 'Nanu',
    species: 'cat',
    habit: 'Nanu naps in the shade under the oak or by the ferns, well away from the datura.',
    avoids: ['moonflower'],
    likes: (g, cell) => (shaded(g, cell) ? 3 : 0) + (nextTo(g, cell, 'fern') ? 1 : 0),
  },
]

/**
 * Open cells this pet would choose, best first: not planted, not taken by
 * another pet, and not touching a plant it avoids. Empty when nowhere is safe.
 */
export function petSpots(garden: GardenState, pet: PetDef, taken: readonly Cell[] = []): Cell[] {
  const planted = occupied(garden)
  const busy = new Set(taken.map(key))
  const open: Cell[] = []
  for (let y = 0; y < garden.size; y++) {
    for (let x = 0; x < garden.size; x++) {
      const cell: Cell = [x, y]
      if (planted.has(key(cell)) || busy.has(key(cell))) continue
      if (around(cell).some((c) => pet.avoids.includes(kindAt(garden, c) as PlantKind))) continue
      open.push(cell)
    }
  }
  const best = Math.max(...open.map((c) => pet.likes(garden, c)))
  return open.filter((c) => pet.likes(garden, c) === best)
}
