import { describe, it, expect } from 'vitest'
import { mergeProfiles, profileFromSupabase, profileToSupabase } from 'src/hooks/usePlayerProfile'

const base = {
  id: 'p1',
  name: '',
  elo: 800,
  peakElo: 800,
  gameElo: 800,
  gamePeakElo: 800,
  puzzlesSolved: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastSolveDate: null,
  eloHistory: [],
  solvedPuzzles: [],
  attemptedPuzzles: {},
}

const gameEvent = (timestamp, elo, won = true) => ({
  timestamp, elo, delta: 10, event: won ? 'game_win' : 'game_loss',
})
const solveEvent = (timestamp, elo) => ({
  timestamp, elo, delta: 12, puzzleId: 'x', event: 'solve',
})

describe('mergeProfiles — split ratings', () => {
  it('takes gameElo from the side with the most recent game event', () => {
    const local = { ...base, gameElo: 900, eloHistory: [gameEvent(2000, 900)] }
    const remote = { ...base, gameElo: 1100, eloHistory: [gameEvent(1000, 1100)] }
    expect(mergeProfiles(local, remote).gameElo).toBe(900)
    expect(mergeProfiles(remote, local).gameElo).toBe(900)
  })

  it('a side that never played a game loses gameElo to one that has', () => {
    const local = { ...base, gameElo: 800, eloHistory: [solveEvent(9999, 850)] }
    const remote = { ...base, gameElo: 1050, eloHistory: [gameEvent(1000, 1050)] }
    expect(mergeProfiles(local, remote).gameElo).toBe(1050)
  })

  it('keeps the max gamePeakElo regardless of recency', () => {
    const local = { ...base, gameElo: 700, gamePeakElo: 1300, eloHistory: [gameEvent(2000, 700, false)] }
    const remote = { ...base, gameElo: 1000, gamePeakElo: 1000, eloHistory: [gameEvent(1000, 1000)] }
    const merged = mergeProfiles(local, remote)
    expect(merged.gameElo).toBe(700)
    expect(merged.gamePeakElo).toBe(1300)
  })

  it('puzzle elo still follows lastSolveDate, independent of game recency', () => {
    const local = {
      ...base, elo: 950, lastSolveDate: '2026-07-08',
      eloHistory: [gameEvent(1, 900)],
    }
    const remote = {
      ...base, elo: 880, gameElo: 1200, lastSolveDate: '2026-07-01',
      eloHistory: [gameEvent(9999, 1200)],
    }
    const merged = mergeProfiles(local, remote)
    expect(merged.elo).toBe(950)
    expect(merged.gameElo).toBe(1200)
  })
})

describe('Supabase row mapping — pre-0005 compatibility', () => {
  it('seeds gameElo from the blended elo when game_elo is absent', () => {
    const row = {
      id: 'p1', name: 'B', elo: 1042, peak_elo: 1180,
      puzzles_solved: 3, games_played: 2, games_won: 1,
      current_streak: 1, best_streak: 2, last_solve_date: '2026-07-01',
      elo_history: [], solved_puzzles: [], attempted_puzzles: {},
    }
    const profile = profileFromSupabase(row)
    expect(profile.gameElo).toBe(1042)
    expect(profile.gamePeakElo).toBe(1180)
  })

  it('prefers real game_elo columns when present', () => {
    const row = {
      id: 'p1', name: 'B', elo: 1042, peak_elo: 1180,
      game_elo: 875, game_peak_elo: 990,
      puzzles_solved: 0, games_played: 5, games_won: 2,
      current_streak: 0, best_streak: 0, last_solve_date: null,
      elo_history: [], solved_puzzles: [], attempted_puzzles: {},
    }
    const profile = profileFromSupabase(row)
    expect(profile.gameElo).toBe(875)
    expect(profile.gamePeakElo).toBe(990)
  })

  it('round-trips both ratings through profileToSupabase', () => {
    const profile = { ...base, elo: 910, peakElo: 1000, gameElo: 1210, gamePeakElo: 1300 }
    const row = profileToSupabase(profile)
    expect(row.elo).toBe(910)
    expect(row.peak_elo).toBe(1000)
    expect(row.game_elo).toBe(1210)
    expect(row.game_peak_elo).toBe(1300)
  })
})
