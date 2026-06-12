import { describe, it, expect } from 'vitest'
import { createEmptyBoard, getWinningLine } from '../gameLogic.js'
import { BLACK, WHITE } from '../constants.js'

function place(stones) {
  const b = createEmptyBoard()
  for (const [row, col, color] of stones) b[row][col] = color
  return b
}

describe('getWinningLine', () => {
  it('returns null when there is no five', () => {
    const board = place([
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
    ])
    expect(getWinningLine(board, 9, 8, BLACK)).toBeNull()
  })

  it('finds a horizontal five from either end of the run', () => {
    const board = place([
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const expected = [[9, 5], [9, 6], [9, 7], [9, 8], [9, 9]]
    expect(getWinningLine(board, 9, 5, BLACK)).toEqual(expected)
    expect(getWinningLine(board, 9, 9, BLACK)).toEqual(expected)
  })

  it('finds a five when the last stone fills a middle gap', () => {
    const board = place([
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    expect(getWinningLine(board, 9, 7, BLACK)).toEqual([
      [9, 5], [9, 6], [9, 7], [9, 8], [9, 9],
    ])
  })

  it('finds vertical and diagonal fives', () => {
    const vertical = place([
      [3, 4, WHITE], [4, 4, WHITE], [5, 4, WHITE], [6, 4, WHITE], [7, 4, WHITE],
    ])
    expect(getWinningLine(vertical, 5, 4, WHITE)).toEqual([
      [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    ])

    const diagonal = place([
      [4, 10, WHITE], [5, 9, WHITE], [6, 8, WHITE], [7, 7, WHITE], [8, 6, WHITE],
    ])
    const line = getWinningLine(diagonal, 6, 8, WHITE)
    expect(line).toHaveLength(5)
    expect(line).toContainEqual([4, 10])
    expect(line).toContainEqual([8, 6])
  })

  it('returns the full run for an overline (six in a row)', () => {
    const board = place([
      [9, 4, BLACK], [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const line = getWinningLine(board, 9, 7, BLACK)
    expect(line.length).toBeGreaterThanOrEqual(5)
    expect(line).toContainEqual([9, 4])
    expect(line).toContainEqual([9, 9])
  })

  it('ignores runs of the other color', () => {
    const board = place([
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE], [9, 9, WHITE],
    ])
    expect(getWinningLine(board, 9, 7, BLACK)).toBeNull()
  })
})
