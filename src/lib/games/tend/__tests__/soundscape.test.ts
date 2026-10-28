import { describe, it, expect } from 'vitest'
import { cutoffFor, LAYERS, MIX, startSoundscape, stopSoundscape } from 'src/lib/games/tend/soundscape'
import { SEA_LEVEL_INDEX, TIERS } from 'src/lib/games/tend/watershed'

describe('the soundscape', () => {
  it('has a mix for every tier', () => {
    for (const t of TIERS) {
      expect(MIX[t.id], t.id).toBeTruthy()
      expect(LAYERS.some((l) => MIX[t.id][l] > 0), t.id).toBe(true)
    }
  })

  it('gets more muffled with every tier below the surface, and never on land', () => {
    const cutoffs = TIERS.map((t) => cutoffFor(t.id))
    for (let i = 0; i < SEA_LEVEL_INDEX; i++) expect(cutoffs[i]).toBe(9000)
    for (let i = SEA_LEVEL_INDEX + 1; i < TIERS.length; i++) expect(cutoffs[i]).toBeLessThan(cutoffs[i - 1])
  })

  it('wind is up on the peaks, the hum down in the deep', () => {
    expect(MIX.alpine.wind).toBe(1)
    expect(MIX.deep.hum).toBe(1)
    expect(MIX.deep.wind + MIX.deep.birds).toBe(0)
  })

  it('does nothing where there is no Web Audio', () => {
    expect(startSoundscape('kelp')).toBe(false)
    expect(() => stopSoundscape()).not.toThrow()
  })
})
