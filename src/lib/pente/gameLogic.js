import { BOARD_SIZE, EMPTY, BLACK, WHITE } from './constants'

export function createEmptyBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY))
}

export function isValidPosition(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function checkForFiveInARow(board, row, col, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (const [dx, dy] of directions) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const r = row + i * dx, c = col + i * dy
      if (!isValidPosition(r, c) || board[r][c] !== player) break
      count++
    }
    for (let i = 1; i < 5; i++) {
      const r = row - i * dx, c = col - i * dy
      if (!isValidPosition(r, c) || board[r][c] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

/**
 * Computes captures for a move. Returns a new board (no mutation) and metadata.
 */
export function computeCaptures(board, row, col, player) {
  const opponent = player === BLACK ? WHITE : BLACK
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  const captured = []

  for (const [dx, dy] of directions) {
    for (const sign of [1, -1]) {
      const sdx = dx * sign, sdy = dy * sign
      if (
        isValidPosition(row + sdx, col + sdy) &&
        isValidPosition(row + 2 * sdx, col + 2 * sdy) &&
        isValidPosition(row + 3 * sdx, col + 3 * sdy) &&
        board[row + sdx][col + sdy] === opponent &&
        board[row + 2 * sdx][col + 2 * sdy] === opponent &&
        board[row + 3 * sdx][col + 3 * sdy] === player
      ) {
        captured.push([row + sdx, col + sdy])
        captured.push([row + 2 * sdx, col + 2 * sdy])
      }
    }
  }

  // Build new board with captures removed
  const newBoard = board.map(r => [...r])
  for (const [cr, cc] of captured) {
    newBoard[cr][cc] = EMPTY
  }

  return { newBoard, capturedPairs: captured.length / 2, captured }
}

/**
 * Applies a move and returns the full resulting game state.
 * Throws if the move is invalid.
 */
export function applyMove(board, row, col, player, blackCaptures, whiteCaptures) {
  if (!isValidPosition(row, col)) throw new Error('Position out of bounds')
  if (board[row][col] !== EMPTY) throw new Error('Cell is not empty')

  // Place stone
  const boardWithMove = board.map(r => [...r])
  boardWithMove[row][col] = player

  // Check captures
  const { newBoard, capturedPairs, captured } = computeCaptures(boardWithMove, row, col, player)

  const newBlackCaptures = player === BLACK ? blackCaptures + capturedPairs : blackCaptures
  const newWhiteCaptures = player === WHITE ? whiteCaptures + capturedPairs : whiteCaptures

  // Check win conditions
  let winner = null
  let winReason = null

  if (checkForFiveInARow(newBoard, row, col, player)) {
    winner = player === BLACK ? 'black' : 'white'
    winReason = 'five_in_a_row'
  } else if (
    (player === BLACK && newBlackCaptures >= 5) ||
    (player === WHITE && newWhiteCaptures >= 5)
  ) {
    winner = player === BLACK ? 'black' : 'white'
    winReason = 'captures'
  }

  return {
    newBoard,
    captured,
    capturedPairs,
    blackCaptures: newBlackCaptures,
    whiteCaptures: newWhiteCaptures,
    winner,
    winReason,
    nextPlayer: player === BLACK ? WHITE : BLACK,
  }
}
