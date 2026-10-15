import { describe, it, expect } from 'vitest'
import { checkIn, newGarden, placeSeed, unlockNotes, type GardenState } from 'src/lib/games/tend/engine'
import { COMPOST_NOTES, SOURCES, almanac } from 'src/lib/games/tend/knowledge'
import { PETS, petSpots } from 'src/lib/games/tend/pets'
import { orientations, PLANTS, type Cell, type Lane } from 'src/lib/games/tend/plants'

const START = 20_000
const pet = (id: string) => PETS.find((p) => p.id === id)!

function plant(state: GardenState, day: number, lanes: Lane[], anchors: Cell[]): GardenState {
  let next = checkIn(state, day, lanes)
  for (const anchor of anchors) {
    const seed = next.seeds[0]
    next = placeSeed(next, seed.id, orientations(seed.kind)[0], anchor, day)
  }
  return next
}

const touches = (cell: Cell, cells: Cell[]) =>
  cells.some(([x, y]) => Math.abs(x - cell[0]) + Math.abs(y - cell[1]) === 1)

describe('pets', () => {
  // oak (0,0)-(1,1); grape (2,0)-(4,0); datura T at (3,4)-(5,4) + (4,5)
  const g = plant(newGarden(START), START, ['body', 'craft', 'rest'], [[0, 0], [2, 0], [3, 4]])
  const grape = g.beds.find((b) => b.kind === 'vine')!.cells
  const datura = g.beds.find((b) => b.kind === 'moonflower')!.cells

  it('never seats Nalu beside the grapes or the datura (both toxic to dogs)', () => {
    for (const cell of petSpots(g, pet('nalu'))) {
      expect(touches(cell, grape)).toBe(false)
      expect(touches(cell, datura)).toBe(false)
    }
  })

  it('keeps both cats away from the datura', () => {
    for (const id of ['pika', 'nanu']) {
      for (const cell of petSpots(g, pet(id))) expect(touches(cell, datura)).toBe(false)
    }
  })

  it('sends Nanu to the shade under the oak and Pika to the sun', () => {
    // (0,2) and (1,2) sit directly below the oak.
    expect(petSpots(g, pet('nanu'))).toEqual([[0, 2], [1, 2]])
    const pika = petSpots(g, pet('pika'))
    expect(pika.some(([x, y]) => y === 2 && x < 2)).toBe(false)
  })

  it('never puts a pet on a bed or on another pet', () => {
    const spots = petSpots(g, pet('pika'), [[5, 5]])
    expect(spots.some(([x, y]) => x === 5 && y === 5)).toBe(false)
    const planted = new Set(g.beds.flatMap((b) => b.cells.map(([x, y]) => `${x},${y}`)))
    for (const [x, y] of spots) expect(planted.has(`${x},${y}`)).toBe(false)
  })
})

describe('field notes', () => {
  it('unlock on first bloom, once', () => {
    let g = plant(newGarden(START), START, ['joy'], [[0, 0]])
    for (let d = START + 1; d <= START + 4; d++) g = checkIn(g, d, [])
    const unlocked = unlockNotes(g, START + 4)
    expect(unlocked.notes).toEqual(['sunflower'])
    expect(unlockNotes(unlocked, START + 4)).toBe(unlocked)
    expect(unlockNotes(g, START + 1)).toBe(g) // not in bloom yet
  })

  it('every note and teaching line carries a source', () => {
    for (const plant of Object.values(PLANTS)) {
      expect(plant.note.source).toMatch(/^https:\/\/calscape\.org\//)
      expect(plant.note.body.length).toBeGreaterThan(40)
    }
    for (const note of COMPOST_NOTES) expect(Object.values(SOURCES)).toContain(note.source)
    for (let m = 0; m < 12; m++) expect(almanac(m).source.url).toMatch(/^https:\/\//)
  })

  it('warns about the plants that are dangerous to pets', () => {
    expect(PLANTS.vine.note.caution).toMatch(/dogs/)
    expect(PLANTS.moonflower.note.caution).toMatch(/pets/)
  })
})
