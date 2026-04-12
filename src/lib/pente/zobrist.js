/**
 * zobrist.js
 * Zobrist hashing for Pente board positions.
 *
 * 19×19 board × 4 possible stone colors (BLACK=1, WHITE=2, RED=3, BLUE=4).
 * Each (row, col, color) triple gets a unique random 32-bit key pair (hi, lo)
 * that we XOR together for incremental hash updates.
 *
 * We use two 32-bit ints instead of BigInt for performance in hot loops.
 */

const BOARD_SIZE = 19
const NUM_COLORS = 4 // BLACK=1..BLUE=4, indices 0..3

// Deterministic PRNG (xorshift32) so hashes are stable across runs
function xorshift32(state) {
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  return state >>> 0 // unsigned
}

// Generate the table once at module load
const TABLE_HI = new Uint32Array(BOARD_SIZE * BOARD_SIZE * NUM_COLORS)
const TABLE_LO = new Uint32Array(BOARD_SIZE * BOARD_SIZE * NUM_COLORS)

let seed = 0x50656E74 // "Pent" in hex
for (let i = 0; i < TABLE_HI.length; i++) {
  seed = xorshift32(seed)
  TABLE_HI[i] = seed
  seed = xorshift32(seed)
  TABLE_LO[i] = seed
}

function idx(row, col, color) {
  return (row * BOARD_SIZE + col) * NUM_COLORS + (color - 1)
}

/**
 * Compute full Zobrist hash of a board from scratch.
 * @returns {{ hi: number, lo: number }}
 */
export function hashBoard(board) {
  let hi = 0, lo = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c]
      if (cell === 0) continue
      const i = idx(r, c, cell)
      hi ^= TABLE_HI[i]
      lo ^= TABLE_LO[i]
    }
  }
  return { hi, lo }
}

/**
 * Incrementally update hash after placing a stone.
 */
export function hashPlace(hash, row, col, color) {
  const i = idx(row, col, color)
  return { hi: hash.hi ^ TABLE_HI[i], lo: hash.lo ^ TABLE_LO[i] }
}

/**
 * Incrementally update hash after removing a stone (same as place — XOR is its own inverse).
 */
export function hashRemove(hash, row, col, color) {
  return hashPlace(hash, row, col, color)
}

/**
 * Combine hi+lo into a single string key for Map lookups.
 */
export function hashKey(hash) {
  return `${hash.hi}:${hash.lo}`
}
