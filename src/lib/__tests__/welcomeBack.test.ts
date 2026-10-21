import { describe, it, expect } from 'vitest'
import { daysBetween, hasHistory, progressLines, welcomeBack, type Billing, type Snapshot } from 'src/lib/welcomeBack'
import { emptyJournal, recordGameEvent } from 'src/lib/playJournal'

const NOW = new Date(2026, 9, 25, 10, 0)

const BILLINGS: Billing[] = [
  { id: 'pente', title: 'Pente', logline: 'Five in a row.', href: '/posts/pente' },
  { id: 'go', title: 'Go', logline: 'Territory.', href: '/posts/go' },
  { id: 'pente_puzzles', title: 'Pente Puzzles', logline: 'Trials.', href: '/posts/pente-puzzles' },
  { id: 'go_puzzles', title: 'Go Puzzles', logline: 'Tsumego.', href: '/posts/go/puzzles' },
  { id: 'pass_and_cut', title: 'Pass & Cut', logline: 'Lanes.', href: '/games/pass-and-cut' },
  { id: 'read_and_react', title: 'Read & React', logline: 'Mix it up.', href: '/games/read-and-react' },
  { id: 'nanu_pika', title: 'Nanu & Pika', logline: 'Hold the road.', href: '/posts/nanu-pika-td' },
  { id: 'tend', title: 'Tend', logline: 'A daily garden.', href: '/games/tend' },
  { id: 'luminous_flow', title: 'Luminous Flow', logline: 'Light.', href: '/posts/luminous-flow' },
]

function fresh(): Snapshot {
  return {
    now: NOW,
    journal: null,
    td: { cleared: 0, total: 8, stars: 0, next: { number: 1, name: 'The Long Way Round' } },
    readReact: { completed: 0, total: 5, next: 'Take the Open Shot', read: null },
    passCut: { completed: 0, total: 6, next: 'Give & Go' },
    go: { rating: null, solved: 0, total: 11, due: 0 },
    pente: { gameRating: null, puzzlesSolved: 0, dailyDoneToday: false, streak: 0, due: 0 },
    tend: null,
  }
}

const journalAt = (when: Date, ...events: [string, string, Record<string, unknown>, Date][]) =>
  events.reduce((j, [e, g, m, at]) => recordGameEvent(j, e, g, m, at), { ...emptyJournal(when) })

describe('the first visit is sacred', () => {
  it('no history means no welcome — the Theater renders as it does cold', () => {
    expect(hasHistory(fresh())).toBe(false)
    expect(welcomeBack(fresh(), BILLINGS)).toBeNull()
  })

  it('a journal with no games (only a Theater visit) is still not history', () => {
    expect(welcomeBack({ ...fresh(), journal: emptyJournal(NOW) }, BILLINGS)).toBeNull()
  })
})

describe('greeting', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysBetween(new Date(2026, 9, 24, 23, 0), new Date(2026, 9, 25, 1, 0))).toBe(1)
    expect(daysBetween(new Date(2026, 9, 25, 1, 0), new Date(2026, 9, 25, 23, 0))).toBe(0)
  })

  it.each([
    [new Date(2026, 9, 25, 8, 0), 'Back again today.'],
    [new Date(2026, 9, 24, 8, 0), 'Welcome back — it’s been a day.'],
    [new Date(2026, 9, 16, 8, 0), 'Welcome back — it’s been 9 days.'],
  ])('last active %s → "%s"', (last, greeting) => {
    const journal = journalAt(last, ['game_start', 'go', {}, last])
    expect(welcomeBack({ ...fresh(), journal }, BILLINGS)?.greeting).toBe(greeting)
  })

  it('history from before the journal existed gets a plain welcome', () => {
    const s = { ...fresh(), td: { cleared: 1, total: 8, stars: 2, next: { number: 2, name: 'The Den' } } }
    expect(welcomeBack(s, BILLINGS)).toMatchObject({ greeting: 'Welcome back.', daysAway: null })
  })
})

describe('notes', () => {
  it('leads with the most recently played game’s unfinished business', () => {
    const journal = journalAt(
      new Date(2026, 9, 20),
      ['game_end', 'pass-and-cut', { result: 'win' }, new Date(2026, 9, 18)],
      ['game_end', 'nanu-pika-td', { result: 'win' }, new Date(2026, 9, 20)],
    )
    const s = { ...fresh(), journal, td: { cleared: 1, total: 8, stars: 1, next: { number: 2, name: 'The Den' } } }
    const w = welcomeBack(s, BILLINGS)!
    expect(w.notes[0]).toMatchObject({ kind: 'continue', href: '/posts/nanu-pika-td' })
    expect(w.notes[0].text).toBe('The Den is waiting — Level 2 of 8.')
  })

  it('Read & React leads with the defense’s file on you', () => {
    const journal = journalAt(NOW, ['game_end', 'read-and-react', { result: 'loss' }, NOW])
    const s = { ...fresh(), journal, readReact: { completed: 1, total: 5, next: 'Pick Your Poison', read: { label: 'Attack the Paint', share: 0.72 } } }
    expect(welcomeBack(s, BILLINGS)!.notes[0].text).toBe('The defense kept a file on you: Attack the Paint, 72% of your calls.')
  })

  it('absence moves the garden — and never scolds', () => {
    const journal = journalAt(new Date(2026, 9, 15), ['game_start', 'tend', {}, new Date(2026, 9, 15)])
    const s = { ...fresh(), journal, tend: { checkins: 12, inBloom: 3, checkedInToday: false, droughtsWhileAway: 1, droughtInDays: null } }
    const away = welcomeBack(s, BILLINGS)!.notes.find((n) => n.kind === 'away')!
    expect(away.text).toBe('A drought passed through your garden while you were away. See what held.')
    for (const note of welcomeBack(s, BILLINGS)!.notes) expect(note.text).not.toMatch(/streak (broke|lost)|missed|you forgot/i)
  })

  it('offers today’s check-in, with a forecast when a drought is close', () => {
    const journal = journalAt(NOW, ['game_start', 'tend', {}, NOW])
    const s = { ...fresh(), journal, tend: { checkins: 3, inBloom: 0, checkedInToday: false, droughtsWhileAway: 0, droughtInDays: 2 } }
    expect(welcomeBack(s, BILLINGS)!.notes.some((n) => n.text === 'Your garden is open for today’s check-in. A drought is forecast in 2 days.')).toBe(true)
  })

  it('suggests one production not played yet, in the Theater’s order', () => {
    const journal = journalAt(NOW, ['game_start', 'pente', {}, NOW])
    const s = { ...fresh(), journal, pente: { gameRating: 1040, puzzlesSolved: 0, dailyDoneToday: false, streak: 0, due: 0 } }
    const fresh_ = welcomeBack(s, BILLINGS)!.notes.find((n) => n.kind === 'new')!
    expect(fresh_).toMatchObject({ href: '/posts/go' })
    expect(fresh_.text).toBe('Not tried yet: Go. Territory.')
  })

  it('never suggests a piece that is not a game', () => {
    const journal = journalAt(NOW, ...['pente', 'go', 'pass-and-cut', 'read-and-react', 'moments', 'nanu-pika-td', 'tend']
      .map((g) => ['game_start', g, {}, NOW] as [string, string, Record<string, unknown>, Date]))
    const s = { ...fresh(), journal, pente: { gameRating: 1000, puzzlesSolved: 2, dailyDoneToday: true, streak: 0, due: 0 }, go: { rating: 1000, solved: 1, total: 11, due: 0 } }
    expect(welcomeBack(s, BILLINGS)!.notes.filter((n) => n.kind === 'new')).toEqual([])
  })

  it('shows at most three notes', () => {
    const journal = journalAt(new Date(2026, 9, 10), ['game_start', 'go', {}, new Date(2026, 9, 10)])
    const s: Snapshot = {
      ...fresh(),
      journal,
      go: { rating: 1100, solved: 3, total: 11, due: 2 },
      pente: { gameRating: null, puzzlesSolved: 4, dailyDoneToday: false, streak: 3, due: 0 },
      tend: { checkins: 5, inBloom: 1, checkedInToday: false, droughtsWhileAway: 2, droughtInDays: null },
    }
    const w = welcomeBack(s, BILLINGS)!
    expect(w.notes.length).toBeLessThanOrEqual(3)
    expect(w.notes[0].text).toBe('2 Go puzzles you missed are due for review.')
  })
})

describe('progress lines', () => {
  it('only for games with progress, phrased per game', () => {
    const s: Snapshot = {
      ...fresh(),
      td: { cleared: 2, total: 8, stars: 5, next: { number: 3, name: 'Zigzag Run' } },
      go: { rating: 1018, solved: 4, total: 11, due: 0 },
      tend: { checkins: 1, inBloom: 0, checkedInToday: true, droughtsWhileAway: 0, droughtInDays: null },
    }
    expect(progressLines(s)).toEqual({
      nanu_pika: 'Level 3 of 8 · 5★',
      go: 'Rating 1018',
      go_puzzles: '4 of 11 solved',
      tend: '1 day tended · 0 in bloom',
    })
  })

  it('a finished campaign says so', () => {
    const s = { ...fresh(), td: { cleared: 8, total: 8, stars: 20, next: null } }
    expect(progressLines(s).nanu_pika).toBe('All 8 cleared · 20★')
  })
})
