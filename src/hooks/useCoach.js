import { useState, useCallback, useRef } from 'react'
import { BLACK, WHITE, findGroup, getNeighbors } from 'src/lib/go/gameLogic'
import { findEyeRegions } from 'src/lib/go/lifeAndDeath'
import { computeAreaScore } from 'src/lib/go/scoring'

const THROTTLE_MAX = 3

function coordLabel(r, c) {
  const letters = 'ABCDEFGHJKLMNOPQRST'
  return `${letters[c] || '?'}${r + 1}`
}

/**
 * Pure detection function — scans the board and returns one tip or null.
 * Exported for testing.
 */
export function detectCoachTip(board, playerColor, koPoint, lessonProgress, counts) {
  const size = board.length
  const oppColor = playerColor === BLACK ? WHITE : BLACK

  // 1. Atari alert — player's group has 1 liberty
  if (counts.atari < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== playerColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.liberties.size === 1) {
          const linkback = lessonProgress?.['1']?.completed ? ' Remember *Breath*.' : ''
          return {
            category: 'atari',
            message: `Your group near ${coordLabel(r, c)} is in atari -- it'll be captured next move unless you extend or connect.${linkback}`,
          }
        }
      }
    }
  }

  // 2. Capture opportunity — opponent group has 1 liberty
  if (counts.capture < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== oppColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.liberties.size === 1) {
          const linkback = lessonProgress?.['1']?.completed ? ' Remember *Breath*.' : ''
          return {
            category: 'capture',
            message: `The ${oppColor === WHITE ? 'white' : 'black'} group near ${coordLabel(r, c)} has one breath left -- you can capture it.${linkback}`,
          }
        }
      }
    }
  }

  // 3. Ko situation
  if (counts.ko < THROTTLE_MAX && koPoint) {
    return {
      category: 'ko',
      message: `This is a ko -- you need to play elsewhere before recapturing at ${coordLabel(koPoint[0], koPoint[1])}.`,
    }
  }

  // 4. Eye teaching — player's group has exactly 1 eye region
  if (counts.eye < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== playerColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.stones.length < 4) continue

        const groupSet = new Set(group.stones.map(([gr, gc]) => `${gr},${gc}`))
        const eyeRegions = findEyeRegions(board, playerColor)
        const adjacentEyes = eyeRegions.filter(region =>
          region.cells.some(([er, ec]) =>
            getNeighbors(er, ec, size).some(([nr, nc]) => groupSet.has(`${nr},${nc}`))
          )
        )
        if (adjacentEyes.length === 1) {
          const linkback = lessonProgress?.['2']?.completed ? ' Remember *Survival*.' : ''
          return {
            category: 'eye',
            message: `This group has one eye. It needs two to live permanently.${linkback}`,
          }
        }
      }
    }
  }

  // 5. Territory moment — large enclosed region (8+ points)
  if (counts.territory < THROTTLE_MAX) {
    const s = computeAreaScore(board)
    const playerTerritory = playerColor === BLACK ? s.blackTerritory : s.whiteTerritory
    if (playerTerritory >= 8) {
      const linkback = lessonProgress?.['3']?.completed ? ' Remember *Expansion*.' : ''
      return {
        category: 'territory',
        message: `You've enclosed ~${playerTerritory} points of territory.${linkback}`,
      }
    }
  }

  return null
}

/**
 * React hook for coach mode. Manages throttle counts and auto-dismiss timing.
 */
export default function useCoach() {
  const [tip, setTip] = useState(null)
  const countsRef = useRef({ atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
  const dismissTimerRef = useRef(null)

  const checkForTip = useCallback((board, playerColor, koPoint, lessonProgress) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }

    const detected = detectCoachTip(board, playerColor, koPoint, lessonProgress, countsRef.current)
    if (detected) {
      countsRef.current[detected.category]++
      setTip(detected)
      dismissTimerRef.current = setTimeout(() => setTip(null), 5000)
    } else {
      setTip(null)
    }
  }, [])

  const dismissTip = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setTip(null)
  }, [])

  const resetCounts = useCallback(() => {
    countsRef.current = { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 }
    setTip(null)
  }, [])

  return { tip, checkForTip, dismissTip, resetCounts }
}
