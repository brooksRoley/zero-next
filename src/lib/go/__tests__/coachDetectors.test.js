import { describe, it, expect } from 'vitest'
import { detectCoachTip } from 'src/hooks/useCoach'
import { BLACK, WHITE, createEmptyBoard } from 'src/lib/go/gameLogic'

function setStones(board, stones) {
  for (const [r, c, color] of stones) board[r][c] = color
  return board
}

describe('detectCoachTip', () => {
  it('detects player group in atari', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('atari')
  })

  it('detects capture opportunity', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, WHITE],
      [0, 1, BLACK], [1, 0, BLACK], [1, 2, BLACK],
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('capture')
  })

  it('detects ko situation', () => {
    const board = createEmptyBoard(9)
    const koPoint = [3, 3]
    const tip = detectCoachTip(board, BLACK, koPoint, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('ko')
  })

  it('returns null when throttle limit reached', () => {
    const board = createEmptyBoard(9)
    const koPoint = [3, 3]
    const tip = detectCoachTip(board, BLACK, koPoint, {}, { atari: 0, capture: 0, ko: 3, eye: 0, territory: 0 })
    expect(tip).toBeNull()
  })

  it('includes lesson linkback when lesson is completed', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
    ])
    const lessonProgress = { '1': { completed: true } }
    const tip = detectCoachTip(board, BLACK, null, lessonProgress, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip.message).toContain('Breath')
  })

  it('omits lesson linkback when lesson not completed', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip.message).not.toContain('Breath')
  })
})
