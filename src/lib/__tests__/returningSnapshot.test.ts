import { describe, it, expect } from 'vitest'
import { readSnapshot } from 'src/lib/returningSnapshot'
import { emptyProgress, recordVictory, saveProgress, LEVELS as TD } from 'src/lib/games/nanupika/campaign'
import { LEVELS as RR } from 'src/lib/games/readreact/levels'
import { emptyScouting, recordSeries, saveScouting } from 'src/lib/games/readreact/scouting'
import { getDailyStamp } from 'src/lib/pente/dailyChallenge'

function memoryStorage(seed: Record<string, unknown> = {}) {
  const map = new Map<string, string>(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
}

const NOW = new Date(2026, 9, 25, 10, 0)

describe('readSnapshot reads each game through its real save', () => {
  it('an empty browser reads as never played', () => {
    const s = readSnapshot(memoryStorage(), NOW)
    expect(s.journal).toBeNull()
    expect(s.td).toMatchObject({ cleared: 0, next: { number: 1 } })
    expect(s.go).toMatchObject({ rating: null, solved: 0, due: 0 })
    expect(s.pente).toMatchObject({ gameRating: null, puzzlesSolved: 0, streak: 0 })
    expect(s.tend).toBeNull()
  })

  it('tower defense: cleared levels, stars and the next level', () => {
    const storage = memoryStorage()
    saveProgress(storage, recordVictory(emptyProgress(), TD[0].id, 15, 15, 1000))
    expect(readSnapshot(storage, NOW).td).toEqual({ cleared: 1, total: TD.length, stars: 3, next: { number: 2, name: TD[1].name } })
  })

  it('Read & React: completed levels, the next one, and the defense’s read on it', () => {
    const storage = memoryStorage({ readreact_progress: [RR[0].id] })
    saveScouting(storage, recordSeries(emptyScouting(), RR[1], [10, 2]))
    const rr = readSnapshot(storage, NOW).readReact
    expect(rr).toMatchObject({ completed: 1, next: RR[1].title })
    expect(rr.read?.label).toBe('Attack the Paint')
  })

  it('Go: counts puzzles whose review has come due, not every miss', () => {
    const day = 24 * 60 * 60 * 1000
    const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * day).toISOString()
    const storage = memoryStorage({
      'go.profile.v2': {
        goElo: 1018, gamesPlayed: 0, solved: ['capture-pair'],
        attempts: [
          { puzzleId: 'capture-edge', solved: false, createdAt: at(2) },   // missed 2 days ago: due
          { puzzleId: 'capture-corner', solved: false, createdAt: at(0) }, // missed today: not yet due
          { puzzleId: 'not-a-puzzle', solved: false, createdAt: at(5) },   // unknown id: ignored
        ],
      },
    })
    expect(readSnapshot(storage, NOW).go).toMatchObject({ rating: 1018, solved: 1, due: 1 })
  })

  it('Pente: rating-history misses and local re-solves drive the review count', () => {
    const day = 24 * 60 * 60 * 1000
    const storage = memoryStorage({
      pente_puzzle_progress: {
        solved: ['capture-001'], gamesPlayed: 0,
        eloHistory: [
          { timestamp: NOW.getTime() - 3 * day, puzzleId: 'capture-001', event: 'wrong', elo: 790, delta: -10 },
          { timestamp: NOW.getTime() - 3 * day + 60_000, puzzleId: 'capture-001', event: 'solve', elo: 805, delta: 15 },
        ],
        reviewLog: [],
      },
    })
    expect(readSnapshot(storage, NOW).pente.due).toBe(1)
  })

  it('Pente: a streak only stands if it was kept up yesterday or today', () => {
    const yesterday = getDailyStamp(new Date(2026, 9, 24, 12))
    const kept = memoryStorage({ pente_daily_challenge: { streak: 4, lastCompletedDate: yesterday } })
    expect(readSnapshot(kept, NOW).pente).toMatchObject({ streak: 4, dailyDoneToday: false })
    const lapsed = memoryStorage({ pente_daily_challenge: { streak: 4, lastCompletedDate: '2026-10-01' } })
    expect(readSnapshot(lapsed, NOW).pente.streak).toBe(0)
  })

  it('a corrupted save in one game does not blank the others', () => {
    const storage = memoryStorage({ 'go.profile.v2': '{broken', tend_garden_v1: '[]', readreact_progress: 'nope' })
    saveProgress(storage, recordVictory(emptyProgress(), TD[0].id, 15, 15, 1000))
    const s = readSnapshot(storage, NOW)
    expect(s.td.cleared).toBe(1)
    expect(s.go.solved).toBe(0)
    expect(s.tend).toBeNull()
    expect(s.readReact.completed).toBe(0)
  })
})
