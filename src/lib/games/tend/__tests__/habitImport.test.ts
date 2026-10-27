import { describe, it, expect } from 'vitest'
import { checkIn, newGarden, stageOf, placeSeed } from 'src/lib/games/tend/engine'
import { dateToDay, importHabits, parseHabitFile, type HabitFile } from 'src/lib/games/tend/habitImport'
import { orientations } from 'src/lib/games/tend/plants'
import { dayIndex } from 'src/lib/games/tend/time'

const file = (days: Record<string, string[]>) => JSON.stringify({ format: 'tend-habits', version: 1, days })

const D = dateToDay('2026-10-20') as number

describe('dateToDay', () => {
  it('matches the game clock for a mid-day moment', () => {
    expect(dateToDay('2026-10-27')).toBe(dayIndex(new Date(2026, 9, 27, 12)))
  })

  it('rejects dates that do not exist and other shapes', () => {
    expect(dateToDay('2026-02-30')).toBeNull()
    expect(dateToDay('2026-13-01')).toBeNull()
    expect(dateToDay('10/27/2026')).toBeNull()
  })
})

describe('parseHabitFile', () => {
  it('reads a well-formed file and orders lanes', () => {
    const parsed = parseHabitFile(file({ '2026-10-20': ['craft', 'body'] }))
    expect(parsed?.days['2026-10-20']).toEqual(['body', 'craft'])
  })

  it('refuses anything that is not a habit file', () => {
    expect(parseHabitFile('not json')).toBeNull()
    expect(parseHabitFile(JSON.stringify({ format: 'other', version: 1, days: {} }))).toBeNull()
    expect(parseHabitFile(JSON.stringify({ format: 'tend-habits', version: 2, days: {} }))).toBeNull()
    expect(parseHabitFile(file({ '2026-10-20': ['search'] }))).toBeNull()
    expect(parseHabitFile(file({ yesterday: ['body'] }))).toBeNull()
  })

  it('refuses a file longer than a year of days', () => {
    const days: Record<string, string[]> = {}
    for (let i = 0; i < 401; i++) days[new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)] = []
    expect(parseHabitFile(file(days))).toBeNull()
  })
})

describe('importHabits', () => {
  const habits = (days: Record<string, string[]>) => parseHabitFile(file(days)) as HabitFile

  it('checks in past days that had none, one seed per lane', () => {
    const g = newGarden(D)
    const r = importHabits(g, habits({ '2026-10-20': ['body', 'craft'], '2026-10-21': ['rest'] }), D + 3)
    expect(r.added).toBe(2)
    expect(r.state.checkins[String(D)]).toEqual(['body', 'craft'])
    expect(r.state.seeds.map((s) => s.kind)).toEqual(['oak', 'vine', 'moonflower'])
  })

  it('only suggests today, so the player still checks in', () => {
    const r = importHabits(newGarden(D), habits({ '2026-10-22': ['body', 'craft'] }), D + 2)
    expect(r.today).toEqual(['body', 'craft'])
    expect(r.state.checkins[String(D + 2)]).toBeUndefined()
    expect(r.state.seeds).toEqual([])
  })

  it('adds the missing lanes to a day already checked in, never removing one', () => {
    const g = checkIn(newGarden(D), D, ['joy'])
    const r = importHabits(g, habits({ '2026-10-20': ['body', 'joy'] }), D + 1)
    expect(r.merged).toBe(1)
    expect(r.state.checkins[String(D)]).toEqual(['body', 'joy'])
    expect(r.state.seeds.map((s) => s.kind)).toEqual(['sunflower', 'oak'])
    expect(new Set(r.state.seeds.map((s) => s.id)).size).toBe(2)
  })

  it('merges into today when today is already checked in', () => {
    const g = checkIn(newGarden(D), D, [])
    const r = importHabits(g, habits({ '2026-10-20': ['craft'] }), D)
    expect(r.merged).toBe(1)
    expect(r.today).toEqual([])
    expect(r.state.seeds.map((s) => s.kind)).toEqual(['vine'])
  })

  it('leaves days before the garden began or after today alone', () => {
    const r = importHabits(newGarden(D), habits({ '2026-10-19': ['body'], '2026-10-25': ['body'] }), D + 2)
    expect(r.outside).toBe(2)
    expect(r.state).toEqual(newGarden(D))
  })

  it('is idempotent: importing the same file twice changes nothing more', () => {
    const h = habits({ '2026-10-20': ['body'], '2026-10-21': ['craft', 'rest'] })
    const once = importHabits(newGarden(D), h, D + 2)
    const twice = importHabits(once.state, h, D + 2)
    expect(twice.state).toEqual(once.state)
    expect(twice.added + twice.merged).toBe(0)
  })

  it('a back-filled day counts as a tended day for beds planted before it', () => {
    let g = checkIn(newGarden(D), D, ['craft'])
    g = placeSeed(g, g.seeds[0].id, orientations('vine')[0], [0, 0], D)
    const before = stageOf(g, g.beds[0], D + 2)
    const r = importHabits(g, habits({ '2026-10-21': ['body'], '2026-10-22': ['rest'] }), D + 3)
    expect(stageOf(r.state, r.state.beds[0], D + 2)).toBeGreaterThan(before)
  })

  it('an empty day in the file is not a check-in: only showing up makes an empty day count', () => {
    const r = importHabits(newGarden(D), habits({ '2026-10-20': [], '2026-10-21': [] }), D + 3)
    expect(r.added).toBe(0)
    expect(r.state).toEqual(newGarden(D))
  })
})
