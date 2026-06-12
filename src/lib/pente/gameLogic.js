import { BOARD_SIZE, EMPTY, BLACK, WHITE, GAME_MODES, getTeamIndex, isOpponent } from './constants'

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
 * Returns the cells of the winning five-in-a-row through (row, col), or null.
 * Used by the UI to animate the winning line. If the run is longer than five,
 * returns the full run.
 * @returns {Array<[number, number]>|null}
 */
export function getWinningLine(board, row, col, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (const [dx, dy] of directions) {
    const cells = [[row, col]]
    for (let i = 1; i < 5; i++) {
      const r = row + i * dx, c = col + i * dy
      if (!isValidPosition(r, c) || board[r][c] !== player) break
      cells.push([r, c])
    }
    for (let i = 1; i < 5; i++) {
      const r = row - i * dx, c = col - i * dy
      if (!isValidPosition(r, c) || board[r][c] !== player) break
      cells.unshift([r, c])
    }
    if (cells.length >= 5) return cells
  }
  return null
}

/**
 * Computes captures for a move. Returns a new board (no mutation) and metadata.
 * @param {number[][]} board
 * @param {number} row
 * @param {number} col
 * @param {number} player
 * @param {object} [gameMode] - Optional game mode config. When absent, classic 2-player rules.
 */
export function computeCaptures(board, row, col, player, gameMode) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
  const captured = []

  for (const [dx, dy] of directions) {
    for (const sign of [1, -1]) {
      const sdx = dx * sign, sdy = dy * sign
      const r1 = row + sdx, c1 = col + sdy
      const r2 = row + 2 * sdx, c2 = col + 2 * sdy
      const r3 = row + 3 * sdx, c3 = col + 3 * sdy

      if (!isValidPosition(r1, c1) || !isValidPosition(r2, c2) || !isValidPosition(r3, c3)) continue

      const mid1 = board[r1][c1]
      const mid2 = board[r2][c2]
      const far  = board[r3][c3]

      if (mid1 === EMPTY || mid2 === EMPTY) continue
      if (mid1 !== mid2) continue // both middle stones must be same player

      if (!gameMode || gameMode.key === 'classic') {
        // Classic 2-player: opponent is the other color
        const opponent = player === BLACK ? WHITE : BLACK
        if (mid1 === opponent && far === player) {
          captured.push([r1, c1], [r2, c2])
        }
      } else if (gameMode.teams) {
        // Team mode: middle must be opponent, far must be friendly (self or teammate)
        if (isOpponent(player, mid1, gameMode) && !isOpponent(player, far, gameMode) && far !== EMPTY) {
          captured.push([r1, c1], [r2, c2])
        }
      } else {
        // FFA: middle must be non-self (same color pair), far must be self
        if (mid1 !== player && far === player) {
          captured.push([r1, c1], [r2, c2])
        }
      }
    }
  }

  const newBoard = board.map(r => [...r])
  for (const [cr, cc] of captured) {
    newBoard[cr][cc] = EMPTY
  }

  return { newBoard, capturedPairs: captured.length / 2, captured }
}

/**
 * Applies a move and returns the full resulting game state.
 *
 * New signature uses a captures object: { [playerColor]: count } or { team0: count, team1: count }
 * For backward compat, also accepts the old (board, row, col, player, blackCaptures, whiteCaptures) form.
 *
 * @param {number[][]} board
 * @param {number} row
 * @param {number} col
 * @param {number} player
 * @param {object|number} capturesOrBlackCaptures - Either captures object or blackCaptures number
 * @param {object|number} [gameModeOrWhiteCaptures] - Either gameMode object or whiteCaptures number
 */
export function applyMove(board, row, col, player, capturesOrBlackCaptures, gameModeOrWhiteCaptures) {
  if (!isValidPosition(row, col)) throw new Error('Position out of bounds')
  if (board[row][col] !== EMPTY) throw new Error('Cell is not empty')

  // Detect old vs new signature
  let captures, gameMode
  if (typeof capturesOrBlackCaptures === 'number') {
    // Old signature: (board, row, col, player, blackCaptures, whiteCaptures)
    captures = { [BLACK]: capturesOrBlackCaptures, [WHITE]: gameModeOrWhiteCaptures || 0 }
    gameMode = null
  } else {
    captures = capturesOrBlackCaptures || {}
    gameMode = gameModeOrWhiteCaptures || null
  }

  // Place stone
  const boardWithMove = board.map(r => [...r])
  boardWithMove[row][col] = player

  // Check captures
  const { newBoard, capturedPairs, captured } = computeCaptures(boardWithMove, row, col, player, gameMode)

  // Update captures
  const newCaptures = { ...captures }
  if (gameMode?.teams) {
    const teamIdx = getTeamIndex(player, gameMode)
    const teamKey = `team${teamIdx}`
    newCaptures[teamKey] = (newCaptures[teamKey] || 0) + capturedPairs
  } else {
    newCaptures[player] = (newCaptures[player] || 0) + capturedPairs
  }

  // Check win conditions
  let winner = null
  let winReason = null
  const threshold = gameMode?.captureThreshold || 5

  if (checkForFiveInARow(newBoard, row, col, player)) {
    winner = player
    winReason = 'five_in_a_row'
  } else if (gameMode?.teams) {
    const teamIdx = getTeamIndex(player, gameMode)
    if ((newCaptures[`team${teamIdx}`] || 0) >= threshold) {
      winner = player
      winReason = 'captures'
    }
  } else {
    if ((newCaptures[player] || 0) >= threshold) {
      winner = player
      winReason = 'captures'
    }
  }

  // Next player in turn order
  const mode = gameMode || GAME_MODES.classic
  const currentIdx = mode.turnOrder.indexOf(player)
  const nextPlayer = mode.turnOrder[(currentIdx + 1) % mode.turnOrder.length]

  // Backward compat return shape — include old field names alongside new
  const result = {
    newBoard,
    captured,
    capturedPairs,
    captures: newCaptures,
    winner,
    winReason,
    nextPlayer,
  }

  // Old-style fields for existing callers (pente.js, multiplayer API)
  if (!gameMode) {
    result.blackCaptures = newCaptures[BLACK] || 0
    result.whiteCaptures = newCaptures[WHITE] || 0
    // Map winner to string for old callers
    if (winner === BLACK) result.winner = 'black'
    else if (winner === WHITE) result.winner = 'white'
  }

  return result
}
