import { describe, it, expect } from 'vitest'
import { INTERVAL_DAYS, dueForReview, goAttempts, nextDue, penteAttempts, reviewState, type Attempt } from 'src/lib/review'

const DAY = 24 * 60 * 60 * 1000
const T = Date.UTC(2026, 9, 1, 12)
const miss = (id: string, day: number): Attempt => ({ puzzleId: id, solved: false, at: T + day * DAY })
const solve = (id: string, day: number, minutes = 0): Attempt => ({ puzzleId: id, solved: true, at: T + day * DAY + minutes * 60_000 })

describe('the Leitner schedule', () => {
  it('a puzzle solved first time never enters review', () => {
    expect(reviewState([solve('a', 0)]).size).toBe(0)
  })

  it('a miss comes due a day later', () => {
    const h = [miss('a', 0)]
    expect(dueForReview(h, T + 0.5 * DAY)).toEqual([])
    expect(dueForReview(h, T + DAY).map((i) => i.puzzleId)).toEqual(['a'])
  })

  it('an immediate retry does not count — recall has to wait for forgetting', () => {
    const h = [miss('a', 0), solve('a', 0, 2)]
    expect(reviewState(h).get('a')).toMatchObject({ box: 0, dueAt: T + DAY })
  })

  it('solving it when due climbs 1 → 3 → 7 days, then graduates', () => {
    let h = [miss('a', 0), solve('a', 1)]
    expect(reviewState(h).get('a')).toMatchObject({ box: 1, dueAt: T + (1 + INTERVAL_DAYS[1]) * DAY })
    h = [...h, solve('a', 4)]
    expect(reviewState(h).get('a')).toMatchObject({ box: 2, dueAt: T + (4 + INTERVAL_DAYS[2]) * DAY })
    h = [...h, solve('a', 11)]
    expect(reviewState(h).has('a')).toBe(false)
    expect(nextDue(h)).toBeNull()
  })

  it('a miss at any box starts it over and counts the lapse', () => {
    const h = [miss('a', 0), solve('a', 1), miss('a', 2)]
    expect(reviewState(h).get('a')).toMatchObject({ box: 0, dueAt: T + 3 * DAY, lapses: 2 })
  })

  it('order of the history does not matter', () => {
    const h = [miss('a', 0), solve('a', 1), solve('a', 4)]
    expect(reviewState([...h].reverse())).toEqual(reviewState(h))
  })

  it('most overdue first, then most missed', () => {
    const h = [miss('late', 3), miss('early', 0), miss('twice', 3), miss('twice', 3)]
    expect(dueForReview(h, T + 10 * DAY).map((i) => i.puzzleId)).toEqual(['early', 'twice', 'late'])
  })
})

describe('adapters', () => {
  it('reads Go attempts and skips malformed ones', () => {
    const attempts = [
      { puzzleId: 'p1', solved: false, createdAt: '2026-10-01T12:00:00Z' },
      { puzzleId: 'p2', solved: 'no', createdAt: '2026-10-01T12:00:00Z' },
      { puzzleId: 'p3', solved: true, createdAt: 'not a date' },
      null,
    ]
    expect(goAttempts(attempts)).toEqual([{ puzzleId: 'p1', solved: false, at: Date.parse('2026-10-01T12:00:00Z') }])
    expect(goAttempts('nope')).toEqual([])
  })

  it('reads Pente solve/wrong events for catalog puzzles only', () => {
    const history = [
      { timestamp: 1, puzzleId: 'capture-001', event: 'wrong' },
      { timestamp: 2, puzzleId: 'capture-001', event: 'solve' },
      { timestamp: 3, puzzleId: 'endless-xyz', event: 'wrong' },
      { timestamp: 4, event: 'game', delta: 12 },
    ]
    expect(penteAttempts(history, (id) => id.startsWith('capture'))).toEqual([
      { puzzleId: 'capture-001', solved: false, at: 1 },
      { puzzleId: 'capture-001', solved: true, at: 2 },
    ])
  })
})
