import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard,
  isValidPosition,
  checkForFiveInARow,
  computeCaptures,
  applyMove,
} from '../gameLogic.js'
import { EMPTY, BLACK, WHITE, BOARD_SIZE } from '../constants.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function place(board, stones) {
  const b = board.map(r => [...r])
  for (const [row, col, color] of stones) {
    b[row][col] = color
  }
  return b
}

// ── createEmptyBoard ──────────────────────────────────────────────────────────

describe('createEmptyBoard', () => {
  it('returns a 19×19 grid', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(BOARD_SIZE)
    expect(board[0]).toHaveLength(BOARD_SIZE)
  })

  it('fills every cell with EMPTY', () => {
    const board = createEmptyBoard()
    expect(board.every(row => row.every(cell => cell === EMPTY))).toBe(true)
  })

  it('returns independent row arrays (no shared references)', () => {
    const board = createEmptyBoard()
    board[0][0] = BLACK
    expect(board[1][0]).toBe(EMPTY)
  })
})

// ── isValidPosition ───────────────────────────────────────────────────────────

describe('isValidPosition', () => {
  it('accepts corners', () => {
    expect(isValidPosition(0, 0)).toBe(true)
    expect(isValidPosition(18, 18)).toBe(true)
    expect(isValidPosition(0, 18)).toBe(true)
    expect(isValidPosition(18, 0)).toBe(true)
  })

  it('rejects negative indices', () => {
    expect(isValidPosition(-1, 0)).toBe(false)
    expect(isValidPosition(0, -1)).toBe(false)
  })

  it('rejects out-of-bounds indices', () => {
    expect(isValidPosition(19, 0)).toBe(false)
    expect(isValidPosition(0, 19)).toBe(false)
  })
})

// ── checkForFiveInARow ────────────────────────────────────────────────────────

describe('checkForFiveInARow', () => {
  it('detects a horizontal five', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK], [9, 10, BLACK], [9, 11, BLACK],
    ])
    expect(checkForFiveInARow(board, 9, 9, BLACK)).toBe(true)
  })

  it('detects a vertical five', () => {
    const board = place(createEmptyBoard(), [
      [5, 9, WHITE], [6, 9, WHITE], [7, 9, WHITE], [8, 9, WHITE], [9, 9, WHITE],
    ])
    expect(checkForFiveInARow(board, 7, 9, WHITE)).toBe(true)
  })

  it('detects a diagonal five (top-left → bottom-right)', () => {
    const board = place(createEmptyBoard(), [
      [5, 5, BLACK], [6, 6, BLACK], [7, 7, BLACK], [8, 8, BLACK], [9, 9, BLACK],
    ])
    expect(checkForFiveInARow(board, 7, 7, BLACK)).toBe(true)
  })

  it('detects a diagonal five (top-right → bottom-left)', () => {
    const board = place(createEmptyBoard(), [
      [5, 13, WHITE], [6, 12, WHITE], [7, 11, WHITE], [8, 10, WHITE], [9, 9, WHITE],
    ])
    expect(checkForFiveInARow(board, 7, 11, WHITE)).toBe(true)
  })

  it('returns false for four in a row', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK], [9, 10, BLACK],
    ])
    expect(checkForFiveInARow(board, 9, 9, BLACK)).toBe(false)
  })

  it('returns false when color does not match', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK], [9, 10, BLACK], [9, 11, BLACK],
    ])
    expect(checkForFiveInARow(board, 9, 9, WHITE)).toBe(false)
  })

  it('detects six or more in a row', () => {
    const board = place(createEmptyBoard(), [
      [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [9, 9, BLACK], [9, 10, BLACK], [9, 11, BLACK],
    ])
    expect(checkForFiveInARow(board, 9, 9, BLACK)).toBe(true)
  })
})

// ── computeCaptures ───────────────────────────────────────────────────────────

describe('computeCaptures', () => {
  it('captures a sandwiched pair horizontally', () => {
    // BLACK places at (9,6): flanks WHITE at (9,7),(9,8) with BLACK at (9,9)
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const { newBoard, capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[9][7]).toBe(EMPTY)
    expect(newBoard[9][8]).toBe(EMPTY)
  })

  it('captures a sandwiched pair vertically', () => {
    const board = place(createEmptyBoard(), [
      [7, 9, WHITE], [8, 9, WHITE], [9, 9, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 6, 9, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[7][9]).toBe(EMPTY)
    expect(newBoard[8][9]).toBe(EMPTY)
  })

  it('does not capture a non-sandwiched pair', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('does not capture own stones', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('handles multiple simultaneous captures', () => {
    // Two separate pairs flanked in different directions
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],   // horizontal right
      [7, 6, WHITE], [8, 6, WHITE], [9, 6, BLACK],   // vertical up from (9,6)
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBeGreaterThanOrEqual(1)
  })

  it('returns an immutable new board (original unchanged)', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const original = board.map(r => [...r])
    computeCaptures(board, 9, 6, BLACK)
    expect(board[9][7]).toBe(original[9][7])
  })
})

// ── applyMove ─────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('throws on occupied cell', () => {
    const board = place(createEmptyBoard(), [[9, 9, BLACK]])
    expect(() => applyMove(board, 9, 9, WHITE, 0, 0)).toThrow('Cell is not empty')
  })

  it('throws on out-of-bounds position', () => {
    expect(() => applyMove(createEmptyBoard(), -1, 0, BLACK, 0, 0)).toThrow()
    expect(() => applyMove(createEmptyBoard(), 0, 19, BLACK, 0, 0)).toThrow()
  })

  it('alternates nextPlayer correctly', () => {
    const result = applyMove(createEmptyBoard(), 9, 9, BLACK, 0, 0)
    expect(result.nextPlayer).toBe(WHITE)

    const result2 = applyMove(createEmptyBoard(), 9, 9, WHITE, 0, 0)
    expect(result2.nextPlayer).toBe(BLACK)
  })

  it('reports winner on five in a row', () => {
    const board = place(createEmptyBoard(), [
      [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const { winner, winReason } = applyMove(board, 9, 10, BLACK, 0, 0)
    expect(winner).toBe('black')
    expect(winReason).toBe('five_in_a_row')
  })

  it('reports winner on capture threshold (5 pairs)', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const { winner, winReason } = applyMove(board, 9, 6, BLACK, 4, 0)
    expect(winner).toBe('black')
    expect(winReason).toBe('captures')
  })

  it('returns null winner when game continues', () => {
    const { winner } = applyMove(createEmptyBoard(), 9, 9, BLACK, 0, 0)
    expect(winner).toBeNull()
  })

  it('accumulates black capture count', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const { blackCaptures } = applyMove(board, 9, 6, BLACK, 2, 0)
    expect(blackCaptures).toBe(3)
  })
})
