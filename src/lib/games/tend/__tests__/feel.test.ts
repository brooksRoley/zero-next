import { describe, it, expect } from 'vitest'
import { misfit, newGarden, placeSeed, checkIn } from 'src/lib/games/tend/engine'
import { orientations, PLANT_KINDS, type Cell } from 'src/lib/games/tend/plants'
import { BLOOM_NOTES, checkInPhrase, noteFor, PENTATONIC, PET_NOTES, REFUSE_NOTES, tendSounds } from 'src/lib/games/tend/sounds'

describe('why a spot does not fit', () => {
  const day = 100
  let g = checkIn(newGarden(day), day, ['body'])
  g = placeSeed(g, g.seeds[0].id, orientations('oak')[0], [2, 2], day)

  it('fits on open soil', () => {
    expect(misfit(g, [[0, 0]])).toBeNull()
  })

  it('names the bed it would overlap', () => {
    const why = misfit(g, [[3, 3]])
    expect(why?.reason).toBe('overlap')
    expect(why?.reason === 'overlap' && why.bed.kind).toBe('oak')
  })

  it('reports the edge before any overlap', () => {
    const cells: Cell[] = [[3, 3], [6, 3]]
    expect(misfit(g, cells)).toEqual({ reason: 'edge' })
    expect(misfit(g, [[-1, 0]])).toEqual({ reason: 'edge' })
  })
})

describe('Tend sounds', () => {
  // C, D, E, G, A in any octave: no two notes a semitone apart, so nothing clashes.
  const PITCH_CLASSES = new Set([0, 2, 4, 7, 9])
  const pitchClass = (hz: number) => (((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12)

  it('draws every note from C major pentatonic', () => {
    const all = [
      ...PENTATONIC,
      ...PLANT_KINDS.map(noteFor),
      ...REFUSE_NOTES,
      ...BLOOM_NOTES,
      ...PET_NOTES.boof,
      ...PET_NOTES.mrrp,
      ...[0, 1, 2, 3, 4, 5].flatMap(checkInPhrase),
    ]
    for (const hz of all) expect(PITCH_CLASSES.has(pitchClass(hz)), String(hz)).toBe(true)
  })

  it('gives each plant its own note', () => {
    expect(new Set(PLANT_KINDS.map(noteFor)).size).toBe(PLANT_KINDS.length)
  })

  it('plays a longer phrase for a bigger day, and two notes for an empty one', () => {
    expect(checkInPhrase(0)).toHaveLength(2)
    expect(checkInPhrase(5)).toHaveLength(6)
    expect(checkInPhrase(5).every((f, i, a) => i === 0 || f > a[i - 1])).toBe(true)
  })

  it('stays silent, without throwing, where there is no Web Audio', () => {
    expect(() => {
      tendSounds.place('oak')
      tendSounds.rotate()
      tendSounds.refuse()
      tendSounds.compost()
      tendSounds.checkIn(3)
      tendSounds.bloom()
      tendSounds.pet('dog', 'nalu')
      tendSounds.pet('cat', 'nanu')
    }).not.toThrow()
  })
})
