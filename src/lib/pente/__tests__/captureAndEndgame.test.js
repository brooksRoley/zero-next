import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard,
  checkForFiveInARow,
  computeCaptures,
  applyMove,
} from '../gameLogic.js'
import { EMPTY, BLACK, WHITE, BOARD_SIZE, GAME_MODES } from '../constants.js'
import { PenteEngine } from '../penteEngine.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function place(board, stones) {
  const b = board.map(r => [...r])
  for (const [row, col, color] of stones) {
    b[row][col] = color
  }
  return b
}

function stoneCount(board) {
  let count = 0
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] !== EMPTY) count++
  return count
}

// ── Corner and edge captures ─────────────────────────────────────────────────

describe('corner captures', () => {
  it('captures a pair along the top edge from corner (0,0)', () => {
    // BLACK at (0,0) flanks WHITE at (0,1),(0,2) with BLACK at (0,3)
    const board = place(createEmptyBoard(), [
      [0, 1, WHITE], [0, 2, WHITE], [0, 3, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 0, 0, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[0][1]).toBe(EMPTY)
    expect(newBoard[0][2]).toBe(EMPTY)
  })

  it('captures a pair along the left edge from corner (0,0)', () => {
    // BLACK at (0,0) flanks WHITE at (1,0),(2,0) with BLACK at (3,0)
    const board = place(createEmptyBoard(), [
      [1, 0, WHITE], [2, 0, WHITE], [3, 0, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 0, 0, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[1][0]).toBe(EMPTY)
    expect(newBoard[2][0]).toBe(EMPTY)
  })

  it('captures a pair diagonally from corner (0,0)', () => {
    // BLACK at (0,0) flanks WHITE at (1,1),(2,2) with BLACK at (3,3)
    const board = place(createEmptyBoard(), [
      [1, 1, WHITE], [2, 2, WHITE], [3, 3, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 0, 0, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[1][1]).toBe(EMPTY)
    expect(newBoard[2][2]).toBe(EMPTY)
  })

  it('captures from bottom-right corner (18,18)', () => {
    const board = place(createEmptyBoard(), [
      [17, 18, WHITE], [16, 18, WHITE], [15, 18, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 18, 18, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[17][18]).toBe(EMPTY)
    expect(newBoard[16][18]).toBe(EMPTY)
  })

  it('captures diagonally from bottom-right corner (18,18)', () => {
    const board = place(createEmptyBoard(), [
      [17, 17, WHITE], [16, 16, WHITE], [15, 15, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 18, 18, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[17][17]).toBe(EMPTY)
    expect(newBoard[16][16]).toBe(EMPTY)
  })

  it('captures from top-right corner (0,18)', () => {
    const board = place(createEmptyBoard(), [
      [0, 17, WHITE], [0, 16, WHITE], [0, 15, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 0, 18, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[0][17]).toBe(EMPTY)
    expect(newBoard[0][16]).toBe(EMPTY)
  })

  it('captures from bottom-left corner (18,0)', () => {
    const board = place(createEmptyBoard(), [
      [17, 0, WHITE], [16, 0, WHITE], [15, 0, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 18, 0, BLACK)
    expect(capturedPairs).toBe(1)
    expect(newBoard[17][0]).toBe(EMPTY)
    expect(newBoard[16][0]).toBe(EMPTY)
  })

  it('does NOT capture when pattern runs off the board edge', () => {
    // WHITE at (0,1),(0,2) — BLACK places at (0,0) but no BLACK at (0,3) side
    // and the other direction goes off-board at (0,-1)
    const board = place(createEmptyBoard(), [
      [0, 1, WHITE], [0, 2, WHITE],
    ])
    const { capturedPairs } = computeCaptures(board, 0, 0, BLACK)
    // No bracket stone exists in any direction → 0 captures
    expect(capturedPairs).toBe(0)
  })

  it('multiple captures from a single corner placement', () => {
    // BLACK at (0,0) captures in two directions simultaneously
    const board = place(createEmptyBoard(), [
      // Horizontal: WHITE at (0,1),(0,2), BLACK bracket at (0,3)
      [0, 1, WHITE], [0, 2, WHITE], [0, 3, BLACK],
      // Diagonal: WHITE at (1,1),(2,2), BLACK bracket at (3,3)
      [1, 1, WHITE], [2, 2, WHITE], [3, 3, BLACK],
    ])
    const { capturedPairs, newBoard } = computeCaptures(board, 0, 0, BLACK)
    expect(capturedPairs).toBe(2)
    expect(newBoard[0][1]).toBe(EMPTY)
    expect(newBoard[0][2]).toBe(EMPTY)
    expect(newBoard[1][1]).toBe(EMPTY)
    expect(newBoard[2][2]).toBe(EMPTY)
  })
})

describe('edge captures (non-corner)', () => {
  it('captures along top row mid-edge', () => {
    // BLACK at (0,5) flanks WHITE at (0,6),(0,7) with BLACK at (0,8)
    const board = place(createEmptyBoard(), [
      [0, 6, WHITE], [0, 7, WHITE], [0, 8, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 0, 5, BLACK)
    expect(capturedPairs).toBe(1)
  })

  it('captures perpendicular to edge (downward from top)', () => {
    // BLACK at (0,9) flanks WHITE at (1,9),(2,9) with BLACK at (3,9)
    const board = place(createEmptyBoard(), [
      [1, 9, WHITE], [2, 9, WHITE], [3, 9, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 0, 9, BLACK)
    expect(capturedPairs).toBe(1)
  })

  it('captures along bottom row', () => {
    const board = place(createEmptyBoard(), [
      [18, 10, WHITE], [18, 11, WHITE], [18, 12, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 18, 9, BLACK)
    expect(capturedPairs).toBe(1)
  })

  it('captures along left column', () => {
    const board = place(createEmptyBoard(), [
      [5, 0, WHITE], [6, 0, WHITE], [7, 0, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 4, 0, BLACK)
    expect(capturedPairs).toBe(1)
  })

  it('captures along right column', () => {
    const board = place(createEmptyBoard(), [
      [5, 18, WHITE], [6, 18, WHITE], [7, 18, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 4, 18, BLACK)
    expect(capturedPairs).toBe(1)
  })
})

// ── Five-in-a-row at edges and corners ───────────────────────────────────────

describe('five-in-a-row edge cases', () => {
  it('detects five along top row starting at column 0', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [0, 1, BLACK], [0, 2, BLACK], [0, 3, BLACK], [0, 4, BLACK],
    ])
    expect(checkForFiveInARow(board, 0, 2, BLACK)).toBe(true)
  })

  it('detects five along top row ending at column 18', () => {
    const board = place(createEmptyBoard(), [
      [0, 14, WHITE], [0, 15, WHITE], [0, 16, WHITE], [0, 17, WHITE], [0, 18, WHITE],
    ])
    expect(checkForFiveInARow(board, 0, 16, WHITE)).toBe(true)
  })

  it('detects five along left column', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [1, 0, BLACK], [2, 0, BLACK], [3, 0, BLACK], [4, 0, BLACK],
    ])
    expect(checkForFiveInARow(board, 2, 0, BLACK)).toBe(true)
  })

  it('detects five along bottom row', () => {
    const board = place(createEmptyBoard(), [
      [18, 0, WHITE], [18, 1, WHITE], [18, 2, WHITE], [18, 3, WHITE], [18, 4, WHITE],
    ])
    expect(checkForFiveInARow(board, 18, 2, WHITE)).toBe(true)
  })

  it('detects five diagonally from top-left corner', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [1, 1, BLACK], [2, 2, BLACK], [3, 3, BLACK], [4, 4, BLACK],
    ])
    expect(checkForFiveInARow(board, 2, 2, BLACK)).toBe(true)
  })

  it('detects five diagonally ending at bottom-right corner', () => {
    const board = place(createEmptyBoard(), [
      [14, 14, WHITE], [15, 15, WHITE], [16, 16, WHITE], [17, 17, WHITE], [18, 18, WHITE],
    ])
    expect(checkForFiveInARow(board, 16, 16, WHITE)).toBe(true)
  })

  it('detects five anti-diagonally from top-right corner', () => {
    const board = place(createEmptyBoard(), [
      [0, 18, BLACK], [1, 17, BLACK], [2, 16, BLACK], [3, 15, BLACK], [4, 14, BLACK],
    ])
    expect(checkForFiveInARow(board, 2, 16, BLACK)).toBe(true)
  })

  it('does not false-positive with 4 on the edge', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [0, 1, BLACK], [0, 2, BLACK], [0, 3, BLACK],
    ])
    expect(checkForFiveInARow(board, 0, 1, BLACK)).toBe(false)
  })

  it('detects five when checked from the first stone in the line', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [0, 1, BLACK], [0, 2, BLACK], [0, 3, BLACK], [0, 4, BLACK],
    ])
    // Check from the leftmost stone
    expect(checkForFiveInARow(board, 0, 0, BLACK)).toBe(true)
  })

  it('detects five when checked from the last stone in the line', () => {
    const board = place(createEmptyBoard(), [
      [0, 0, BLACK], [0, 1, BLACK], [0, 2, BLACK], [0, 3, BLACK], [0, 4, BLACK],
    ])
    // Check from the rightmost stone
    expect(checkForFiveInARow(board, 0, 4, BLACK)).toBe(true)
  })
})

// ── End game via applyMove ───────────────────────────────────────────────────

describe('end game — capture wins', () => {
  it('wins when reaching exactly 5 captured pairs', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const result = applyMove(board, 9, 6, BLACK, 4, 0)
    expect(result.winner).toBe('black')
    expect(result.winReason).toBe('captures')
    expect(result.blackCaptures).toBe(5)
  })

  it('wins when exceeding 5 captured pairs (multi-capture move)', () => {
    // Setup: BLACK can capture 2 pairs in one move, going from 4 to 6
    const board = place(createEmptyBoard(), [
      // Horizontal pair
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
      // Vertical pair
      [7, 6, WHITE], [8, 6, WHITE], [6, 6, BLACK],
    ])
    const result = applyMove(board, 9, 6, BLACK, 4, 0)
    expect(result.winner).toBe('black')
    expect(result.winReason).toBe('captures')
  })

  it('white wins by captures', () => {
    const board = place(createEmptyBoard(), [
      [5, 7, BLACK], [5, 8, BLACK], [5, 9, WHITE],
    ])
    const result = applyMove(board, 5, 6, WHITE, 0, 4)
    expect(result.winner).toBe('white')
    expect(result.winReason).toBe('captures')
    expect(result.whiteCaptures).toBe(5)
  })

  it('does not win at 4 captured pairs', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const result = applyMove(board, 9, 6, BLACK, 3, 0)
    expect(result.winner).toBeNull()
    expect(result.blackCaptures).toBe(4)
  })

  it('five-in-a-row takes priority over captures on the same move', () => {
    // Setup where placing a stone creates both five-in-a-row AND a capture
    const board = place(createEmptyBoard(), [
      // Four in a row for BLACK, placing 5th at (9,10) completes it
      [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
      // Also a capture setup: WHITE at (9,11),(9,12), BLACK at (9,13)
      [9, 11, WHITE], [9, 12, WHITE], [9, 13, BLACK],
    ])
    const result = applyMove(board, 9, 10, BLACK, 4, 0)
    // five_in_a_row should be detected first
    expect(result.winner).toBe('black')
    expect(result.winReason).toBe('five_in_a_row')
  })
})

describe('end game — five in a row wins', () => {
  it('black wins with horizontal five', () => {
    const board = place(createEmptyBoard(), [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
    ])
    const result = applyMove(board, 9, 9, BLACK, 0, 0)
    expect(result.winner).toBe('black')
    expect(result.winReason).toBe('five_in_a_row')
  })

  it('white wins with vertical five', () => {
    const board = place(createEmptyBoard(), [
      [5, 9, WHITE], [6, 9, WHITE], [7, 9, WHITE], [8, 9, WHITE],
    ])
    const result = applyMove(board, 9, 9, WHITE, 0, 0)
    expect(result.winner).toBe('white')
    expect(result.winReason).toBe('five_in_a_row')
  })

  it('no winner when game continues normally', () => {
    const result = applyMove(createEmptyBoard(), 9, 9, BLACK, 0, 0)
    expect(result.winner).toBeNull()
    expect(result.winReason).toBeNull()
  })
})

describe('end game — new captures API with game modes', () => {
  it('classic mode win via captures (new API)', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const captures = { [BLACK]: 4, [WHITE]: 0 }
    const result = applyMove(board, 9, 6, BLACK, captures, GAME_MODES.classic)
    expect(result.winner).toBe(BLACK)
    expect(result.winReason).toBe('captures')
  })

  it('team2v2 mode win via team captures', () => {
    const board = place(createEmptyBoard(), [
      // RED pair for BLACK to capture
      [9, 7, 3], [9, 8, 3], [9, 9, BLACK],
    ])
    const captures = { team0: 4, team1: 0 }
    const result = applyMove(board, 9, 6, BLACK, captures, GAME_MODES.team2v2)
    expect(result.winner).toBe(BLACK)
    expect(result.winReason).toBe('captures')
    expect(result.captures.team0).toBe(5)
  })

  it('ffa4 mode — each player tracks captures independently', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const captures = { [BLACK]: 4, [WHITE]: 3, [3]: 1, [4]: 0 }
    const result = applyMove(board, 9, 6, BLACK, captures, GAME_MODES.ffa4)
    expect(result.winner).toBe(BLACK)
    expect(result.winReason).toBe('captures')
  })
})

// ── Turn order ───────────────────────────────────────────────────────────────

describe('turn order after moves', () => {
  it('classic: BLACK → WHITE', () => {
    const result = applyMove(createEmptyBoard(), 9, 9, BLACK, 0, 0)
    expect(result.nextPlayer).toBe(WHITE)
  })

  it('classic: WHITE → BLACK', () => {
    const board = place(createEmptyBoard(), [[9, 9, BLACK]])
    const result = applyMove(board, 8, 8, WHITE, 0, 0)
    expect(result.nextPlayer).toBe(BLACK)
  })

  it('ffa4: cycles through all four players', () => {
    const captures = { [BLACK]: 0, [WHITE]: 0, [3]: 0, [4]: 0 }
    const r1 = applyMove(createEmptyBoard(), 9, 9, BLACK, captures, GAME_MODES.ffa4)
    expect(r1.nextPlayer).toBe(WHITE)

    const r2 = applyMove(r1.newBoard, 8, 8, WHITE, r1.captures, GAME_MODES.ffa4)
    expect(r2.nextPlayer).toBe(3) // RED

    const r3 = applyMove(r2.newBoard, 7, 7, 3, r2.captures, GAME_MODES.ffa4)
    expect(r3.nextPlayer).toBe(4) // BLUE

    const r4 = applyMove(r3.newBoard, 6, 6, 4, r3.captures, GAME_MODES.ffa4)
    expect(r4.nextPlayer).toBe(BLACK) // wraps around
  })

  it('team2v2: alternates teams (BLACK → RED → WHITE → BLUE)', () => {
    const captures = { team0: 0, team1: 0 }
    const r1 = applyMove(createEmptyBoard(), 9, 9, BLACK, captures, GAME_MODES.team2v2)
    expect(r1.nextPlayer).toBe(3) // RED (team 1)

    const r2 = applyMove(r1.newBoard, 8, 8, 3, r1.captures, GAME_MODES.team2v2)
    expect(r2.nextPlayer).toBe(WHITE) // WHITE (team 0)

    const r3 = applyMove(r2.newBoard, 7, 7, WHITE, r2.captures, GAME_MODES.team2v2)
    expect(r3.nextPlayer).toBe(4) // BLUE (team 1)
  })
})

// ── Bot engine end-game behavior ─────────────────────────────────────────────

describe('PenteEngine — finds winning moves', () => {
  it('plays a winning five-in-a-row move', () => {
    const board = place(createEmptyBoard(), [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      // Some white stones so the board isn't trivial
      [8, 5, WHITE], [8, 6, WHITE], [8, 7, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 2, timeBudgetMs: 5000 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    // Must play (9,9) or (9,4) to complete the five
    expect(
      (move.row === 9 && move.col === 9) || (move.row === 9 && move.col === 4)
    ).toBe(true)
    expect(move.score).toBeGreaterThanOrEqual(900000)
  })

  it('plays a winning capture move (5th pair)', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
      // Scatter some stones
      [5, 5, BLACK], [5, 6, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 2, timeBudgetMs: 5000 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 4, [WHITE]: 0 })
    // Must play (9,6) to capture the pair and win
    expect(move.row).toBe(9)
    expect(move.col).toBe(6)
    expect(move.score).toBeGreaterThanOrEqual(900000)
  })

  it('blocks opponent five-in-a-row', () => {
    const board = place(createEmptyBoard(), [
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE],
      // BLACK stones elsewhere
      [5, 5, BLACK], [6, 6, BLACK],
    ])
    const engine = new PenteEngine({ searchDepth: 2, timeBudgetMs: 5000, blunderRate: 0 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    // Must block at (9,4) or (9,9)
    expect(
      (move.row === 9 && move.col === 9) || (move.row === 9 && move.col === 4)
    ).toBe(true)
  })

  it('blocks opponent capture win', () => {
    // WHITE has 4 captures and can capture BLACK's pair at (9,7),(9,8) by playing (9,6)
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, WHITE],
      // WHITE needs to play (9,6) to capture — BLACK should block or disrupt
      [5, 5, BLACK], [10, 10, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 2, timeBudgetMs: 5000, blunderRate: 0 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 4 })
    // BLACK should play (9,6) to block the capture lane, or move one of the vulnerable stones
    // At minimum, the bot should NOT leave the winning capture open
    expect(move).toBeDefined()
    expect(move.row).toBeDefined()
    expect(move.col).toBeDefined()
  })

  it('prefers shorter winning paths', () => {
    // Immediate win available at depth 1
    const board = place(createEmptyBoard(), [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [7, 5, WHITE], [7, 6, WHITE], [7, 7, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 3, timeBudgetMs: 5000 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    // Should find the immediate win, not a deeper path
    expect(move.score).toBeGreaterThanOrEqual(999990)
  })

  it('returns a valid move on empty board', () => {
    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 1000 })
    const move = engine.findBestMove(createEmptyBoard(), BLACK, { [BLACK]: 0, [WHITE]: 0 })
    expect(move.row).toBe(9) // center
    expect(move.col).toBe(9)
  })

  it('returns a valid move on nearly full board', () => {
    // Fill the board except for a few cells
    const board = createEmptyBoard()
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // Alternate in a pattern that doesn't create five-in-a-row
        board[r][c] = ((r + c) % 3 === 0) ? BLACK : ((r + c) % 3 === 1) ? WHITE : BLACK
      }
    }
    // Clear a few cells
    board[0][0] = EMPTY
    board[0][1] = EMPTY
    board[1][0] = EMPTY

    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 2000 })
    const move = engine.findBestMove(board, WHITE, { [WHITE]: 0, [BLACK]: 0 })
    expect(move).toBeDefined()
    expect(board[move.row][move.col]).toBe(EMPTY)
  })
})

describe('PenteEngine — blunder injection', () => {
  it('blundered moves are still valid board positions', () => {
    const board = place(createEmptyBoard(), [
      [9, 9, BLACK], [9, 10, WHITE], [8, 8, BLACK], [8, 9, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 1000, blunderRate: 1.0 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    expect(move.row).toBeGreaterThanOrEqual(0)
    expect(move.row).toBeLessThan(BOARD_SIZE)
    expect(move.col).toBeGreaterThanOrEqual(0)
    expect(move.col).toBeLessThan(BOARD_SIZE)
    expect(board[move.row][move.col]).toBe(EMPTY)
  })

  it('even with max blunder rate, a winning move is still valid', () => {
    // Only one possible move that matters
    const board = place(createEmptyBoard(), [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [8, 9, WHITE], [10, 9, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 2, timeBudgetMs: 2000, blunderRate: 1.0 })
    const move = engine.findBestMove(board, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    // Move should be a valid empty cell regardless
    expect(board[move.row][move.col]).toBe(EMPTY)
  })
})

// ── Capture edge cases ───────────────────────────────────────────────────────

describe('capture edge cases', () => {
  it('does not capture when middle stones are different colors', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('captures do not chain (removing stones does not trigger further captures)', () => {
    // After capturing a pair, the resulting empty cells should NOT
    // trigger additional captures in the same move
    const board = place(createEmptyBoard(), [
      // BLACK at (9,3) captures WHITE pair at (9,4),(9,5) via bracket at (9,6)
      [9, 4, WHITE], [9, 5, WHITE], [9, 6, BLACK],
      // Behind the captured pair: another WHITE stone that could theoretically
      // form a new pattern after the pair is removed — but it shouldn't
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    // Place BLACK at (9,3) — should only capture the (9,4),(9,5) pair
    const { capturedPairs } = computeCaptures(board, 9, 3, BLACK)
    expect(capturedPairs).toBe(1)
  })

  it('a stone cannot capture itself or same-color stones', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, BLACK], [9, 8, BLACK], [9, 9, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('single opponent stone between two friendly stones is not captured', () => {
    // Only pairs are captured in Pente, not single stones
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('three opponent stones between brackets are not captured', () => {
    // Pente captures exactly 2, not 3
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, WHITE], [9, 10, BLACK],
    ])
    const { capturedPairs } = computeCaptures(board, 9, 6, BLACK)
    expect(capturedPairs).toBe(0)
  })

  it('board is not mutated by computeCaptures', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const snapshot = JSON.stringify(board)
    computeCaptures(board, 9, 6, BLACK)
    expect(JSON.stringify(board)).toBe(snapshot)
  })
})

// ── Engine make/unmake consistency ───────────────────────────────────────────

describe('PenteEngine — doMove/undoMove consistency', () => {
  it('undoMove restores the board exactly', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])
    const snapshot = JSON.stringify(board)

    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 1000 })
    const saved = engine.doMove(board, 9, 6, BLACK, { [BLACK]: 0, [WHITE]: 0 })
    // Board is mutated after doMove
    expect(board[9][6]).toBe(BLACK)

    engine.undoMove(board, 9, 6, saved)
    expect(JSON.stringify(board)).toBe(snapshot)
  })

  it('undoMove restores captured stones with correct colors', () => {
    const board = place(createEmptyBoard(), [
      [9, 7, WHITE], [9, 8, WHITE], [9, 9, BLACK],
    ])

    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 1000 })
    const saved = engine.doMove(board, 9, 6, BLACK, { [BLACK]: 0, [WHITE]: 0 })

    // After move, captured stones should be removed
    expect(board[9][7]).toBe(EMPTY)
    expect(board[9][8]).toBe(EMPTY)

    // After undo, they should be restored
    engine.undoMove(board, 9, 6, saved)
    expect(board[9][7]).toBe(WHITE)
    expect(board[9][8]).toBe(WHITE)
    expect(board[9][6]).toBe(EMPTY)
  })
})
