export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2

export const BOARD_SIZES = [9, 13, 19]
export const DEFAULT_BOARD_SIZE = 9

// Standard handicap-stone placements per board size. Order matters: handicap N
// uses the first N entries. Conventional sequences (corners → tengen → edges).
const HANDICAP_POINTS = {
  9: [
    [2, 6], [6, 2], [6, 6], [2, 2], [4, 4], [4, 2], [4, 6], [2, 4], [6, 4],
  ],
  13: [
    [3, 9], [9, 3], [9, 9], [3, 3], [6, 6], [6, 3], [6, 9], [3, 6], [9, 6],
  ],
  19: [
    [3, 15], [15, 3], [15, 15], [3, 3], [9, 9], [9, 3], [9, 15], [3, 9], [15, 9],
  ],
}

export const HANDICAP_COUNTS = [0, 2, 3, 4, 5, 6, 7, 8, 9]

export function getHandicapStones(size, count) {
  if (!count || count < 2) return []
  const points = HANDICAP_POINTS[size]
  if (!points) return []
  return points.slice(0, Math.min(count, points.length))
}

export function createEmptyBoard(size = DEFAULT_BOARD_SIZE) {
  return Array(size).fill(null).map(() => Array(size).fill(EMPTY))
}

export function isValidPosition(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size
}

export function opponent(player) {
  return player === BLACK ? WHITE : BLACK
}

export function getNeighbors(row, col, size) {
  const out = []
  if (row > 0) out.push([row - 1, col])
  if (row < size - 1) out.push([row + 1, col])
  if (col > 0) out.push([row, col - 1])
  if (col < size - 1) out.push([row, col + 1])
  return out
}

/**
 * Flood-fill the connected same-color group containing (row, col).
 * Returns { stones: [[r,c],...], liberties: Set<"r,c"> }.
 * If the cell is empty, returns an empty group.
 */
export function findGroup(board, row, col) {
  const size = board.length
  const player = board[row][col]
  if (player === EMPTY) return { stones: [], liberties: new Set() }

  const visited = new Set()
  const stones = []
  const liberties = new Set()
  const stack = [[row, col]]

  while (stack.length > 0) {
    const [r, c] = stack.pop()
    const key = `${r},${c}`
    if (visited.has(key)) continue
    visited.add(key)
    if (board[r][c] !== player) continue

    stones.push([r, c])
    for (const [nr, nc] of getNeighbors(r, c, size)) {
      const v = board[nr][nc]
      if (v === EMPTY) {
        liberties.add(`${nr},${nc}`)
      } else if (v === player) {
        stack.push([nr, nc])
      }
    }
  }

  return { stones, liberties }
}

/**
 * Apply a move. Enforces:
 *  - cell must be empty
 *  - simple ko (cannot replay the single point captured last turn)
 *  - suicide is illegal (own group must have ≥1 liberty after captures resolve)
 *
 * Returns { newBoard, captured: [[r,c],...], nextKoPoint: [r,c]|null, error: string|null }.
 * On error the original board is returned unchanged.
 */
export function applyMove(board, row, col, player, koPoint = null) {
  const size = board.length
  if (!isValidPosition(row, col, size)) {
    return { newBoard: board, captured: [], nextKoPoint: null, error: 'out_of_bounds' }
  }
  if (board[row][col] !== EMPTY) {
    return { newBoard: board, captured: [], nextKoPoint: null, error: 'occupied' }
  }
  if (koPoint && koPoint[0] === row && koPoint[1] === col) {
    return { newBoard: board, captured: [], nextKoPoint: null, error: 'ko' }
  }

  const next = board.map(r => [...r])
  next[row][col] = player

  const opp = opponent(player)
  const captured = []
  const seenGroup = new Set()
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (next[nr][nc] !== opp) continue
    const headKey = `${nr},${nc}`
    if (seenGroup.has(headKey)) continue
    const group = findGroup(next, nr, nc)
    for (const [sr, sc] of group.stones) seenGroup.add(`${sr},${sc}`)
    if (group.liberties.size === 0) {
      for (const [sr, sc] of group.stones) {
        next[sr][sc] = EMPTY
        captured.push([sr, sc])
      }
    }
  }

  if (captured.length === 0) {
    const own = findGroup(next, row, col)
    if (own.liberties.size === 0) {
      return { newBoard: board, captured: [], nextKoPoint: null, error: 'suicide' }
    }
  }

  // Simple ko: only forbid an immediate single-stone recapture.
  // Triggered when this move captured exactly one stone AND the placed stone
  // is alone with exactly one liberty (the captured square).
  let nextKoPoint = null
  if (captured.length === 1) {
    const own = findGroup(next, row, col)
    if (own.stones.length === 1 && own.liberties.size === 1) {
      nextKoPoint = captured[0]
    }
  }

  return { newBoard: next, captured, nextKoPoint, error: null }
}
