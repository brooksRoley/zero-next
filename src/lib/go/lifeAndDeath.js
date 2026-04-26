import { EMPTY, findGroup, getNeighbors } from './gameLogic'

/**
 * Find empty regions fully enclosed by stones of `color` (no opponent stones
 * touch the region). Each region is one connected blob of empty intersections.
 *
 * MVP simplification: we don't distinguish "true" eyes from "false" eyes
 * (which require checking diagonal neighbors at the boundary). Good enough
 * for teaching the two-eye concept.
 */
export function findEyeRegions(board, color) {
  const size = board.length
  const visited = new Set()
  const regions = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue
      const key = `${r},${c}`
      if (visited.has(key)) continue
      const cells = []
      const stack = [[r, c]]
      let touchesColor = false
      let touchesOpp = false
      while (stack.length) {
        const [rr, cc] = stack.pop()
        const k = `${rr},${cc}`
        if (visited.has(k)) continue
        visited.add(k)
        cells.push([rr, cc])
        for (const [nr, nc] of getNeighbors(rr, cc, size)) {
          const v = board[nr][nc]
          if (v === EMPTY) stack.push([nr, nc])
          else if (v === color) touchesColor = true
          else touchesOpp = true
        }
      }
      if (touchesColor && !touchesOpp) {
        regions.push({ cells })
      }
    }
  }
  return regions
}

/**
 * Returns all eye regions adjacent to the group at (row, col). Used by demos
 * to highlight the specific group's eyes (not every same-color group's eyes).
 */
export function eyesOfGroup(board, row, col) {
  if (board[row][col] === EMPTY) return []
  const size = board.length
  const player = board[row][col]
  const group = findGroup(board, row, col)
  const groupSet = new Set(group.stones.map(([r, c]) => `${r},${c}`))
  const regions = findEyeRegions(board, player)
  return regions.filter(region => region.cells.some(([er, ec]) => (
    getNeighbors(er, ec, size).some(([nr, nc]) => groupSet.has(`${nr},${nc}`))
  )))
}

/**
 * MVP-level life check: the group at (row, col) has at least 2 eye regions
 * adjacent to it. Good enough for lesson demos; not a tournament-strength
 * tactical solver (which would also detect false eyes and seki).
 */
export function hasTwoEyes(board, row, col) {
  return eyesOfGroup(board, row, col).length >= 2
}
