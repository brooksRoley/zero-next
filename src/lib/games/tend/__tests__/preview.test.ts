import { describe, it, expect } from 'vitest'
import { checkIn, grewBetween, newGarden, placeSeed, placementEffect, type GardenState } from 'src/lib/games/tend/engine'
import { orientations, type Cell, type PlantKind } from 'src/lib/games/tend/plants'
import { effectText } from 'src/components/games/TendBoard'
import { nearestPet } from 'src/components/games/TendPets'

const DAY = 500
/** Root one bed of `kind` at `anchor` on `day`, without a check-in (so several can go in on one day). */
function root(g: GardenState, kind: PlantKind, anchor: Cell, day = DAY): GardenState {
  const id = `t${g.nextId}`
  const withSeed = { ...g, seeds: [...g.seeds, { id, kind, earnedDay: day }], nextId: g.nextId + 1 }
  const next = placeSeed(withSeed, id, orientations(kind)[0], anchor, day)
  expect(next.beds.length, `${kind} at ${anchor}`).toBe(g.beds.length + 1)
  return next
}

describe('seeing the effect before committing', () => {
  const g = root(root(newGarden(DAY), 'sunflower', [0, 2]), 'vine', [2, 0])

  it('a fern beside two beds keeps both safe from drought', () => {
    const effect = placementEffect(g, 'fern', [[1, 1], [2, 1], [0, 1]])
    expect(effect.helps.map((b) => b.kind).sort()).toEqual(['sunflower', 'vine'])
    expect(effectText('fern', effect)).toBe('keeps 2 neighbours safe from drought')
  })

  it('an oak over a poppy shades it, and speeds up the vine it touches', () => {
    const effect = placementEffect(g, 'oak', [[0, 0], [1, 0], [0, 1], [1, 1]])
    expect(effect.shades.map((b) => b.kind)).toEqual(['sunflower'])
    expect(effect.helps.map((b) => b.kind)).toEqual(['vine'])
  })

  it('tells the new bed what happens to it', () => {
    const withOak = root(g, 'oak', [3, 3])
    expect(placementEffect(withOak, 'sunflower', [[3, 5]]).self).toBe('shaded')
    expect(placementEffect(withOak, 'vine', [[3, 2], [4, 2], [5, 2]]).self).toBe('helped')
    expect(placementEffect(withOak, 'sunflower', [[0, 5]])).toEqual({ helps: [], shades: [], self: null })
  })
})

describe('growth after a check-in', () => {
  it('lists the beds that reached a new stage, and the ones that just bloomed', () => {
    let g = root(newGarden(DAY), 'sunflower', [0, 0])
    // Poppies bloom after 4 tended days: tend three, then the fourth check-in is the bloom.
    for (let d = DAY + 1; d <= DAY + 3; d++) g = checkIn(g, d, [])
    const after = checkIn(g, DAY + 4, [])
    const result = grewBetween(g, after, DAY + 4)
    expect(result.grew).toEqual([g.beds[0].id])
    expect(result.bloomed).toEqual([g.beds[0].id])
    expect(grewBetween(after, after, DAY + 4)).toEqual({ grew: [], bloomed: [] })
  })
})

describe('pets noticing a new bed', () => {
  it('picks the pet closest by grid steps', () => {
    const spots = { nalu: { cell: [5, 5] as Cell, flip: false }, pika: { cell: [1, 0] as Cell, flip: false } }
    expect(nearestPet(spots, [0, 0])).toBe('pika')
    expect(nearestPet(spots, [5, 4])).toBe('nalu')
    expect(nearestPet({}, [0, 0])).toBeNull()
  })
})

describe('review fixes: only neighbours the rules would change', () => {
  it('a fern does not claim beds a fern already protects, or other ferns', () => {
    const g = root(root(newGarden(DAY), 'fern', [0, 0]), 'sunflower', [0, 2])
    // The poppy at (0,2) touches the first fern's cell (0,1); a new fern beside both claims neither.
    const effect = placementEffect(g, 'fern', [[1, 2], [2, 2], [0, 3], [1, 3]])
    expect(effect.helps).toEqual([])
  })

  it('a datura does not claim beds another datura already calms', () => {
    const g = root(root(newGarden(DAY), 'moonflower', [0, 0]), 'sunflower', [1, 2])
    const effect = placementEffect(g, 'moonflower', [[0, 3], [1, 3], [2, 3], [1, 4]])
    expect(effect.helps).toEqual([])
  })
})
