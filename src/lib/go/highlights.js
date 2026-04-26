import { findGroup } from './gameLogic'

/**
 * Returns the set of empty cells that are liberties of the group containing
 * (row, col). Returned as an array of [r, c] pairs for easy iteration.
 */
export function libertiesOf(board, row, col) {
  const { liberties } = findGroup(board, row, col)
  return Array.from(liberties).map(k => k.split(',').map(Number))
}

/**
 * Collects liberty cells for every group of `color` on the board. Used in the
 * "see liberties" demos so we can highlight the entire breath of a position.
 * Returns array of [r, c] (deduped — a single empty cell may be a liberty of
 * multiple groups but we mark it once).
 */
export function allLibertiesOfColor(board, color) {
  const size = board.length
  const visitedGroups = new Set()
  const out = new Set()
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== color) continue
      const key = `${r},${c}`
      if (visitedGroups.has(key)) continue
      const group = findGroup(board, r, c)
      for (const [sr, sc] of group.stones) visitedGroups.add(`${sr},${sc}`)
      for (const lib of group.liberties) out.add(lib)
    }
  }
  return Array.from(out).map(k => k.split(',').map(Number))
}

/**
 * True when the group containing (row, col) has exactly one liberty — i.e.
 * the group is in atari and a single move from the opponent captures it.
 */
export function isAtari(board, row, col) {
  const { liberties } = findGroup(board, row, col)
  return liberties.size === 1
}
