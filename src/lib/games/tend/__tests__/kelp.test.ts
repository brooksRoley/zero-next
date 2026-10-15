import { describe, it, expect } from 'vitest'
import {
  creditNudges,
  currentForest,
  KELP_KEY,
  leverage,
  loadKelp,
  MAX_NUDGES,
  newKelpPlay,
  playYear,
  rewindYear,
  ripple,
  rippleCaption,
  runYear,
  saveKelp,
  START,
  type Kelp,
  type Protection,
} from 'src/lib/games/tend/kelp'

const years = (start: Kelp, p: Protection, n: number) => {
  let s = start
  for (let i = 0; i < n; i++) s = runYear(s, p).at(-1)!
  return s
}

describe('the kelp model', () => {
  it('is deterministic and keeps every population between 0 and 9', () => {
    expect(runYear(START, 1)).toEqual(runYear(START, 1))
    for (const p of [0, 1, 2, 3, 4] as Protection[]) {
      for (const m of runYear(years(START, p, 3), p)) {
        for (const v of [m.otters, m.urchins, m.kelp]) expect(v >= 0 && v <= 9).toBe(true)
      }
    }
  })

  it('stands with some protection, and collapses into an urchin barren without enough', () => {
    expect(years(START, 2, 10).barren).toBe(false)
    expect(years(START, 2, 10).kelp).toBeGreaterThan(8)
    const lost = years(START, 1, 3)
    expect(lost.barren).toBe(true)
    expect(lost.kelp).toBeLessThan(1)
  })

  it('takes more protection to bring a forest back than it took to lose it', () => {
    const barren = years(START, 1, 4)
    expect(years(barren, 2, 10).barren).toBe(true)
    expect(years(barren, 3, 5).barren).toBe(false)
    expect(years(barren, 4, 3).kelp).toBeGreaterThan(8)
  })
})

describe('reading a year', () => {
  it('captions the chain reaction against the year you did not change', () => {
    const r = [
      { species: 'otters' as const, delta: -2 },
      { species: 'urchins' as const, delta: 5 },
      { species: 'kelp' as const, delta: -6 },
    ]
    expect(rippleCaption(r)).toBe('Otters −2 → Urchins +5 → Kelp −6')
    expect(leverage(r)).toEqual({ moved: 2, forest: 13 })
  })

  it('shows no ripple when the lever was left alone', () => {
    const end = runYear(START, 2).at(-1)!
    expect(ripple(end, end).every((x) => x.delta === 0)).toBe(true)
  })
})

describe('playing the forest', () => {
  it('spends a nudge to move the lever; running it unchanged is free', () => {
    let play = newKelpPlay()
    play = playYear(play, 2)!
    expect(play.nudges).toBe(MAX_NUDGES)
    play = playYear(play, 0)!
    expect(play.nudges).toBe(MAX_NUDGES - 1)
    expect(play.years).toHaveLength(2)
  })

  it("won't move the lever without a nudge, unless nudges are unlimited (the sample)", () => {
    const empty = { ...newKelpPlay(), nudges: 0 }
    expect(playYear(empty, 4)).toBeNull()
    expect(playYear(empty, 2)).not.toBeNull()
    expect(playYear(empty, 4, true)?.nudges).toBe(0)
  })

  it('remembers the first collapse and the first recovery', () => {
    let play = newKelpPlay()
    play = playYear(play, 1)!
    play = playYear(play, 1)!
    expect(play.seen.barren).toBe(true)
    for (let i = 0; i < 4; i++) play = playYear(play, 4, true)!
    expect(play.seen.recovered).toBe(true)
  })

  it('rewinds a year for free, refunding its nudge', () => {
    let play = newKelpPlay()
    play = playYear(play, 0)!
    const back = rewindYear(play)
    expect(back.years).toHaveLength(0)
    expect(back.protection).toBe(2)
    expect(back.nudges).toBe(MAX_NUDGES)
    expect(currentForest(back)).toEqual(START)
  })

  it('earns one nudge per garden check-in, holding three at most', () => {
    let play = { ...newKelpPlay(), nudges: 0 }
    play = creditNudges(play, 1)
    expect(play.nudges).toBe(1)
    play = creditNudges(play, 1)
    expect(play.nudges).toBe(1)
    play = creditNudges(play, 9)
    expect(play.nudges).toBe(MAX_NUDGES)
    expect(play.credited).toBe(9)
  })
})

describe('storage', () => {
  it('round-trips, and starts fresh from a corrupted save', () => {
    const map = new Map<string, string>()
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    const play = playYear(newKelpPlay(), 3)!
    saveKelp(store, play)
    expect(loadKelp(store)).toEqual(play)
    map.set(KELP_KEY, '{"version":1,"years":"x"}')
    expect(loadKelp(store)).toBeNull()
  })
})

describe('review fixes', () => {
  it('a rewind refunds its nudge even when check-ins have topped the player up since', () => {
    let play = playYear(newKelpPlay(), 0)!
    play = creditNudges(play, play.credited + 5)
    expect(play.nudges).toBe(MAX_NUDGES)
    expect(rewindYear(play).nudges).toBe(MAX_NUDGES + 1)
  })
})
