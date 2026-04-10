import { useState, useEffect, useCallback } from 'react'
import { STARTING_ELO, MIN_ELO, MAX_ELO, calculateEloChange, calculatePuzzleEloChange, getZone } from 'src/lib/pente/elo'

const STORAGE_KEY = 'pente_puzzle_progress'

const defaultProgress = {
  solved: [],
  attempted: {},
  currentStreak: 0,
  lastSolveDate: null,
  bestStreak: 0,
  // ELO tracking
  elo: STARTING_ELO,
  peakElo: STARTING_ELO,
  eloHistory: [], // { timestamp, elo, delta, puzzleId, event }
}

export default function usePuzzleProgress() {
  const [progress, setProgress] = useState(defaultProgress)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Migrate old progress that lacks ELO fields
        setProgress({
          ...defaultProgress,
          ...parsed,
          elo: parsed.elo ?? STARTING_ELO,
          peakElo: parsed.peakElo ?? STARTING_ELO,
          eloHistory: parsed.eloHistory ?? [],
        })
      } catch {
        // corrupted — reset
      }
    }
  }, [])

  const save = useCallback((updated) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [])

  /**
   * Mark a puzzle as solved and update ELO.
   * @param {string} puzzleId
   * @param {number} puzzleRating - The puzzle's ELO rating
   * @param {number} attempts - Wrong attempts before solving
   * @param {boolean} usedHint - Whether hint was shown
   * @returns {{ delta: number, newElo: number, zone: object }} ELO change info
   */
  const markSolved = useCallback((puzzleId, puzzleRating, attempts = 0, usedHint = false) => {
    let result = { delta: 0, newElo: STARTING_ELO, zone: getZone(STARTING_ELO) }

    setProgress(prev => {
      if (prev.solved.includes(puzzleId)) {
        result = { delta: 0, newElo: prev.elo, zone: getZone(prev.elo) }
        return prev
      }

      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const isToday = prev.lastSolveDate === today
      const wasYesterday = prev.lastSolveDate === yesterday

      let newStreak = prev.currentStreak
      if (!isToday) {
        newStreak = wasYesterday ? prev.currentStreak + 1 : 1
      }

      // Calculate ELO change
      const delta = calculatePuzzleEloChange(prev.elo, puzzleRating, true, attempts, usedHint)
      const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, prev.elo + delta))
      const newPeak = Math.max(prev.peakElo, newElo)

      result = { delta, newElo, zone: getZone(newElo) }

      const updated = {
        ...prev,
        solved: [...prev.solved, puzzleId],
        currentStreak: newStreak,
        lastSolveDate: today,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        elo: newElo,
        peakElo: newPeak,
        eloHistory: [
          ...prev.eloHistory,
          {
            timestamp: Date.now(),
            elo: newElo,
            delta,
            puzzleId,
            event: 'solve',
          },
        ],
      }
      save(updated)
      return updated
    })

    return result
  }, [save])

  /**
   * Record a wrong attempt — small ELO penalty.
   */
  const recordAttempt = useCallback((puzzleId, puzzleRating) => {
    setProgress(prev => {
      // Small penalty per wrong attempt (K=8, score=0)
      const delta = Math.round(-8 * (1 / (1 + Math.pow(10, (puzzleRating - prev.elo) / 400))))
      const newElo = Math.max(MIN_ELO, prev.elo + delta)

      const updated = {
        ...prev,
        attempted: {
          ...prev.attempted,
          [puzzleId]: (prev.attempted[puzzleId] || 0) + 1,
        },
        elo: newElo,
        eloHistory: [
          ...prev.eloHistory,
          {
            timestamp: Date.now(),
            elo: newElo,
            delta,
            puzzleId,
            event: 'wrong',
          },
        ],
      }
      save(updated)
      return updated
    })
  }, [save])

  /**
   * Record a bot game result — affects ELO rating.
   * @param {number} opponentElo - Bot's ELO rating
   * @param {boolean} won - Whether the player won
   */
  const recordGameResult = useCallback((opponentElo, won) => {
    setProgress(prev => {
      const delta = calculateEloChange(prev.elo, opponentElo, won ? 1.0 : 0.0, 20)
      const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, prev.elo + delta))
      const updated = {
        ...prev,
        elo: newElo,
        peakElo: Math.max(prev.peakElo, newElo),
        eloHistory: [
          ...prev.eloHistory,
          {
            timestamp: Date.now(),
            elo: newElo,
            delta,
            event: won ? 'game_win' : 'game_loss',
          },
        ],
      }
      save(updated)
      return updated
    })
  }, [save])

  const isSolved = useCallback((puzzleId) => {
    return progress.solved.includes(puzzleId)
  }, [progress.solved])

  const getAttempts = useCallback((puzzleId) => {
    return progress.attempted[puzzleId] || 0
  }, [progress.attempted])

  return {
    progress,
    markSolved,
    recordAttempt,
    recordGameResult,
    isSolved,
    getAttempts,
    solvedCount: progress.solved.length,
    currentStreak: progress.currentStreak,
    bestStreak: progress.bestStreak,
    elo: progress.elo,
    peakElo: progress.peakElo,
    eloHistory: progress.eloHistory,
    zone: getZone(progress.elo),
  }
}
