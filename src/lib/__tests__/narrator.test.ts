import { describe, it, expect } from 'vitest'
import { LINES, RECENT_LIMIT, loadRecent, pickLine, remember, saveRecent, type NarratorContext } from 'src/lib/narrator'
import { emptyJournal, recordGameEvent } from 'src/lib/playJournal'

const NOW = new Date(2026, 9, 25, 10)

function base(): NarratorContext {
  return {
    now: NOW,
    daysAway: 3,
    journal: recordGameEvent(emptyJournal(NOW), 'game_start', 'go', {}, NOW),
    td: { cleared: 0, total: 8, stars: 0, next: { number: 1, name: 'The Long Way Round' } },
    readReact: { completed: 0, total: 5, next: 'Take the Open Shot', read: null },
    passCut: { completed: 0, total: 6, next: 'Give & Go' },
    go: { rating: 1000, solved: 0, total: 11, due: 0 },
    pente: { gameRating: null, puzzlesSolved: 0, dailyDoneToday: false, streak: 0, due: 0 },
    tend: null,
  }
}

// A spread of player states, between them making every line eligible at least once.
function contexts(): NarratorContext[] {
  let journal = emptyJournal(NOW)
  for (const g of ['go', 'pente', 'moments', 'tend', 'pass-and-cut', 'read-and-react']) journal = recordGameEvent(journal, 'game_start', g, {}, NOW)
  for (let i = 0; i < 4; i++) journal = recordGameEvent(journal, 'puzzle_solved', 'moments', {}, NOW)
  journal = recordGameEvent(journal, 'game_end', 'nanu-pika-td', { result: 'loss' }, NOW)
  const rich: NarratorContext = {
    ...base(),
    journal,
    td: { cleared: 7, total: 8, stars: 15, next: { number: 8, name: 'Last Stand' } },
    readReact: { completed: 5, total: 5, next: null, read: { label: 'Attack the Paint', share: 0.85 } },
    passCut: { completed: 6, total: 6, next: null },
    go: { rating: 1200, solved: 11, total: 11, due: 4 },
    pente: { gameRating: 1100, puzzlesSolved: 9, dailyDoneToday: false, streak: 5, due: 3 },
    tend: { checkins: 40, inBloom: 6, checkedInToday: false, droughtsWhileAway: 1, droughtInDays: 1 },
  }
  return [
    base(),
    rich,
    { ...rich, daysAway: 0 },
    { ...rich, daysAway: 30 },
    { ...rich, td: { cleared: 8, total: 8, stars: 24, next: null } },
    { ...rich, td: { cleared: 3, total: 8, stars: 6, next: { number: 4, name: 'Switchback Pass' } } },
    { ...rich, readReact: { completed: 3, total: 5, next: 'The Trap', read: { label: 'Mid-Range Pull-Up', share: 0.5 } } },
  ]
}

describe('narrator lines', () => {
  it('every line is reachable from some player state', () => {
    const reachable = new Set(contexts().flatMap((c) => LINES.filter((l) => l.when(c)).map((l) => l.id)))
    expect(LINES.map((l) => l.id).filter((id) => !reachable.has(id))).toEqual([])
  })

  it('every line renders clean text wherever it fires', () => {
    for (const c of contexts()) {
      for (const line of LINES.filter((l) => l.when(c))) {
        const text = line.say(c)
        expect(text, line.id).not.toMatch(/undefined|NaN|null|\[object/)
        expect(text.length, line.id).toBeLessThanOrEqual(140)
      }
    }
  })

  it('never scolds: absence and losses are weather, not failure', () => {
    for (const c of contexts()) {
      for (const line of LINES.filter((l) => l.when(c))) {
        expect(line.say(c), line.id).not.toMatch(/\b(fail(ed|ure)?|lazy|forgot|broke your|shame|disappoint)/i)
      }
    }
  })

  it('ids are unique and there is always a fallback', () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length)
    expect(LINES.filter((l) => l.priority === 0 && l.when(base())).length).toBeGreaterThanOrEqual(2)
  })
})

describe('pickLine', () => {
  it('the most specific true line wins', () => {
    const c = { ...base(), readReact: { completed: 1, total: 5, next: 'Pick Your Poison', read: { label: 'Attack the Paint', share: 0.9 } } }
    expect(pickLine(c, []).id).toBe('rr-predictable')
    expect(pickLine(c, []).text).toBe('The defense has stopped guessing about you: Attack the Paint, 90% of the time. That is a compliment and a problem.')
  })

  it('a line spoken recently steps aside for the next one', () => {
    const c = { ...base(), readReact: { completed: 1, total: 5, next: 'Pick Your Poison', read: { label: 'Attack the Paint', share: 0.9 } } }
    expect(pickLine(c, ['rr-predictable']).id).not.toBe('rr-predictable')
  })

  it('when everything eligible was spoken recently, the oldest comes back', () => {
    const c = base() // eligible: one-seat (one game played) and the two generic lines
    expect(pickLine(c, ['house-one-seat', 'house-curtain', 'house-lights']).id).toBe('house-lights')
    expect(pickLine(c, ['house-lights', 'house-one-seat', 'house-curtain']).id).toBe('house-curtain')
  })

  it('a regular rotates through lines instead of hearing one forever', () => {
    let recent: string[] = []
    const heard: string[] = []
    for (let visit = 0; visit < 3; visit++) {
      const { id } = pickLine(contexts()[1], recent)
      heard.push(id)
      recent = remember(recent, id)
    }
    expect(new Set(heard).size).toBe(3)
  })
})

describe('memory of recent lines', () => {
  it('keeps newest first, without duplicates, capped', () => {
    let recent: string[] = []
    for (const id of ['a', 'b', 'c', 'a', 'd', 'e', 'f', 'g', 'h']) recent = remember(recent, id)
    expect(recent[0]).toBe('h')
    expect(recent.length).toBe(RECENT_LIMIT)
    expect(new Set(recent).size).toBe(recent.length)
  })

  it('round-trips through storage and survives junk', () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    saveRecent(storage, ['a', 'b'])
    expect(loadRecent(storage)).toEqual(['a', 'b'])
    map.set('zero_narrator_v1', '{bad')
    expect(loadRecent(storage)).toEqual([])
  })
})
