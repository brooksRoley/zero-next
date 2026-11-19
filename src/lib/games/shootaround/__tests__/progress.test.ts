import { describe, expect, it } from 'vitest'
import { STATIONS } from '../puzzles'
import {
  KEEP_DAYS,
  QUEST_KEY,
  dayKey,
  dayRecord,
  daysComplete,
  emptySave,
  hardwoodFights,
  isComplete,
  loadSave,
  markDone,
  nextStation,
  parseSave,
  playedHardwood,
  previousDay,
  setHardwoodBaseline,
  streak,
  writeSave,
  type QuestSave,
} from '../progress'

const finish = (save: QuestSave, day: string) =>
  STATIONS.reduce((s, st) => markDone(s, day, st.id, 'solved'), save)

describe('days', () => {
  it('formats the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('steps back across months and years', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
})

describe('stations', () => {
  it('opens one at a time, in order', () => {
    let save = emptySave()
    expect(nextStation(dayRecord(save, '2026-11-05'))).toBe('starUp')
    save = markDone(save, '2026-11-05', 'starUp', 'solved')
    expect(nextStation(dayRecord(save, '2026-11-05'))).toBe('capSpace')
    save = finish(save, '2026-11-05')
    expect(nextStation(dayRecord(save, '2026-11-05'))).toBeNull()
    expect(isComplete(dayRecord(save, '2026-11-05'))).toBe(true)
  })

  it('keeps a solve as a solve when the answer is shown later', () => {
    let save = markDone(emptySave(), '2026-11-05', 'starUp', 'solved')
    save = markDone(save, '2026-11-05', 'starUp', 'shown')
    expect(dayRecord(save, '2026-11-05').done.starUp).toBe('solved')
  })

  it('does not mutate the save it was given', () => {
    const save = emptySave()
    markDone(save, '2026-11-05', 'starUp', 'solved')
    expect(save).toEqual(emptySave())
  })
})

describe('streak', () => {
  it('counts complete days back from today', () => {
    let save = emptySave()
    for (const d of ['2026-11-03', '2026-11-04', '2026-11-05']) save = finish(save, d)
    expect(streak(save, '2026-11-05')).toBe(3)
    expect(daysComplete(save)).toBe(3)
  })

  it('does not break before today is over', () => {
    let save = finish(emptySave(), '2026-11-04')
    save = markDone(save, '2026-11-05', 'starUp', 'solved')
    expect(streak(save, '2026-11-05')).toBe(1)
  })

  it('breaks after a missed day', () => {
    const save = finish(emptySave(), '2026-11-03')
    expect(streak(save, '2026-11-05')).toBe(0)
  })
})

describe('the Hardwood station', () => {
  it('sums the fights Hardwood recorded', () => {
    const raw = JSON.stringify({ pnr: { seen: 4, used: 3, understood: 1 }, drop: { seen: 2, used: 3, understood: 0 } })
    expect(hardwoodFights(raw)).toBe(6)
  })

  it('reads a missing or broken save as no fights', () => {
    expect(hardwoodFights(null)).toBe(0)
    expect(hardwoodFights('{oops')).toBe(0)
    expect(hardwoodFights('[1,2]')).toBe(0)
    expect(hardwoodFights(JSON.stringify({ x: { used: 'lots' } }))).toBe(0)
  })

  it('counts only fights started after the station opened', () => {
    let save = setHardwoodBaseline(emptySave(), '2026-11-05', 6)
    save = setHardwoodBaseline(save, '2026-11-05', 9) // the first baseline stands
    const rec = dayRecord(save, '2026-11-05')
    expect(rec.hardwoodBaseline).toBe(6)
    expect(playedHardwood(rec, 6)).toBe(false)
    expect(playedHardwood(rec, 8)).toBe(true)
    expect(playedHardwood(dayRecord(emptySave(), '2026-11-05'), 50)).toBe(false)
  })
})

describe('the save', () => {
  it('round-trips through storage', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const save = setHardwoodBaseline(markDone(emptySave(), '2026-11-05', 'readD', 'shown'), '2026-11-05', 2)
    writeSave(storage, save)
    expect(store.has(QUEST_KEY)).toBe(true)
    expect(loadSave(storage)).toEqual(save)
  })

  it('starts fresh from junk, and drops unknown stations and bad days', () => {
    expect(parseSave(null)).toEqual(emptySave())
    expect(parseSave({ version: 2, days: {} })).toEqual(emptySave())
    const parsed = parseSave({
      version: 1,
      days: {
        '2026-11-05': { done: { starUp: 'solved', nope: 'solved', capSpace: 'maybe' }, hardwoodBaseline: -1 },
        yesterday: { done: {} },
      },
    })
    expect(parsed).toEqual({ version: 1, days: { '2026-11-05': { done: { starUp: 'solved' }, hardwoodBaseline: null } } })
    expect(loadSave({ getItem: () => '{not json' })).toEqual(emptySave())
    expect(loadSave(null)).toEqual(emptySave())
  })

  it('keeps a bounded number of days', () => {
    let save = emptySave()
    for (let i = 0; i < KEEP_DAYS + 10; i++) save = markDone(save, dayKey(new Date(2026, 0, 1 + i)), 'starUp', 'solved')
    expect(Object.keys(save.days)).toHaveLength(KEEP_DAYS)
  })
})
