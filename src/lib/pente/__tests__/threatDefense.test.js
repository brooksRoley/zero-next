import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import {
  createEmptyBoard,
  checkForFiveInARow,
  computeCaptures,
  applyMove,
} from '../gameLogic.js'
import { EMPTY, BLACK, WHITE, BOARD_SIZE } from '../constants.js'
import { PenteEngine } from '../penteEngine.js'

/**
 * Threat-defense suite.
 *
 * These tests encode the contract a first-time player implicitly expects:
 * the bot must never ignore a basic 4-in-a-row / 5-in-a-row threat, at ANY
 * difficulty — including the depth-1, high-blunder config that new players
 * get from getAdaptiveBotConfig. A bot that drops these reads as "buggy",
 * not "beginner".
 *
 * Assertions are functional rather than square-exact: capturing stones out
 * of the threatening line is a legal Pente defense, so we assert "after the
 * bot's reply the human cannot win next move" instead of pinning one cell.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function place(stones) {
  const b = createEmptyBoard()
  for (const [row, col, color] of stones) b[row][col] = color
  return b
}

/** All empty cells of the board. */
function emptyCells(board) {
  const cells = []
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === EMPTY) cells.push([r, c])
  return cells
}

/**
 * Can `player` win immediately by playing one stone (five-in-a-row or
 * reaching 5 captured pairs)? Returns the winning cell or null.
 */
function canWinNextMove(board, player, captures = {}) {
  for (const [r, c] of emptyCells(board)) {
    const result = applyMove(board, r, c, player, { ...captures }, null)
    if (result.winner) return [r, c]
  }
  return null
}

/**
 * Can `player` create an OPEN four (four in a row with both ends empty —
 * unstoppable next turn) by playing one stone?
 */
function canMakeOpenFour(board, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
  const valid = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
  for (const [r, c] of emptyCells(board)) {
    // Apply with captures so a capture-assisted four counts too
    const withStone = board.map(row => [...row])
    withStone[r][c] = player
    const { newBoard } = computeCaptures(withStone, r, c, player, null)
    for (const [dr, dc] of dirs) {
      // Walk to the start of the run through (r, c)
      let sr = r, sc = c
      while (valid(sr - dr, sc - dc) && newBoard[sr - dr][sc - dc] === player) {
        sr -= dr; sc -= dc
      }
      let len = 0
      let er = sr, ec = sc
      while (valid(er, ec) && newBoard[er][ec] === player) {
        len++; er += dr; ec += dc
      }
      const beforeOpen = valid(sr - dr, sc - dc) && newBoard[sr - dr][sc - dc] === EMPTY
      const afterOpen = valid(er, ec) && newBoard[er][ec] === EMPTY
      if (len === 4 && beforeOpen && afterOpen) return [r, c]
    }
  }
  return null
}

/** Run the importable engine for WHITE and apply its move. */
function engineReply(board, captures, config) {
  const engine = new PenteEngine({ timeBudgetMs: 1200, blunderRate: 0, ...config })
  const move = engine.findBestMove(board.map(r => [...r]), WHITE, { ...captures })
  expect(move).toBeTruthy()
  const applied = applyMove(board, move.row, move.col, WHITE, { ...captures }, null)
  return { move, applied }
}

// ── Threat positions ──────────────────────────────────────────────────────────
// Human is BLACK (as in the real game); bot is WHITE and to move.

const THREATS = [
  {
    name: 'horizontal simple four (XXXX with one open end)',
    stones: [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [9, 4, WHITE], [12, 12, WHITE],
    ],
  },
  {
    name: 'vertical simple four',
    stones: [
      [5, 9, BLACK], [6, 9, BLACK], [7, 9, BLACK], [8, 9, BLACK],
      [4, 9, WHITE], [13, 4, WHITE],
    ],
  },
  {
    name: 'diagonal simple four',
    stones: [
      [5, 5, BLACK], [6, 6, BLACK], [7, 7, BLACK], [8, 8, BLACK],
      [4, 4, WHITE], [14, 14, WHITE],
    ],
  },
  {
    name: 'split four XX_XX (five through the gap)',
    stones: [
      [9, 5, BLACK], [9, 6, BLACK], [9, 8, BLACK], [9, 9, BLACK],
      [5, 5, WHITE], [14, 14, WHITE],
    ],
  },
  {
    name: 'split four XXX_X (five through the gap)',
    stones: [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 9, BLACK],
      [5, 5, WHITE], [14, 14, WHITE],
    ],
  },
]

// Sanity: every fixture really is an immediate human win threat
describe('threat fixtures are valid', () => {
  for (const t of THREATS) {
    it(`${t.name} — human wins next move if ignored`, () => {
      expect(canWinNextMove(place(t.stones), BLACK)).not.toBeNull()
    })
  }
})

// ── Core contract: the bot averts immediate five threats at every depth ──────

describe.each([1, 2, 4])('engine averts immediate win threats (depth %i)', (searchDepth) => {
  for (const t of THREATS) {
    it(`blocks ${t.name}`, () => {
      const board = place(t.stones)
      const { applied } = engineReply(board, {}, { searchDepth })
      // Bot may not have won itself...
      expect(applied.winner).toBeFalsy()
      // ...so the human must have no winning reply left.
      const win = canWinNextMove(applied.newBoard, BLACK)
      expect(win, `human can still win at ${JSON.stringify(win)}`).toBeNull()
    })
  }
})

// ── Open three: must not be allowed to become an open four ───────────────────

describe.each([1, 2, 4])('engine defuses an open three (depth %i)', (searchDepth) => {
  it('prevents _XXX_ from becoming an open four', () => {
    const board = place([
      [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [3, 3, WHITE], [15, 15, WHITE],
    ])
    const { applied } = engineReply(board, {}, { searchDepth })
    const openFour = canMakeOpenFour(applied.newBoard, BLACK)
    expect(openFour, `human can make an open four at ${JSON.stringify(openFour)}`).toBeNull()
  })
})

// ── Winning: the bot must take its own wins ───────────────────────────────────

describe.each([1, 2, 4])('engine takes wins (depth %i)', (searchDepth) => {
  it('completes its own five-in-a-row', () => {
    const board = place([
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE],
      [9, 4, BLACK],
      [11, 5, BLACK], [11, 6, BLACK], [12, 8, BLACK],
    ])
    const { move, applied } = engineReply(board, {}, { searchDepth })
    expect(move.row).toBe(9)
    expect(move.col).toBe(9)
    expect(applied.winner).toBeTruthy()
  })

  it('prefers winning now over blocking the opponent', () => {
    // Both sides have a four: WHITE must take its own win, not block.
    const board = place([
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE],
      [11, 5, BLACK], [11, 6, BLACK], [11, 7, BLACK], [11, 8, BLACK],
      [11, 4, WHITE], [9, 4, BLACK],
    ])
    const { applied } = engineReply(board, {}, { searchDepth })
    expect(applied.winner).toBeTruthy()
  })

  it('takes the fifth capture for a capture win', () => {
    // W _ B B W bracket: playing (9,4) captures the pair → 5th capture
    const board = place([
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, WHITE],
      [4, 4, BLACK], [15, 4, BLACK],
    ])
    const { move, applied } = engineReply(board, { [WHITE]: 4 }, { searchDepth })
    expect([move.row, move.col]).toEqual([9, 4])
    expect(applied.winner).toBeTruthy()
  })
})

// ── Blunder injection must never override forced moves ───────────────────────
// New players get blunderRate 0.15 at depth 1 (getAdaptiveBotConfig at low ELO).
// A blunder that skips a forced block is indistinguishable from a bug.

describe('blunder injection respects forced moves', () => {
  it('always blocks a simple four even at blunderRate 1.0', () => {
    const stones = [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [9, 4, WHITE], [12, 12, WHITE],
    ]
    for (let i = 0; i < 25; i++) {
      const board = place(stones)
      const { applied } = engineReply(board, {}, { searchDepth: 1, blunderRate: 1.0 })
      expect(applied.winner).toBeFalsy()
      expect(canWinNextMove(applied.newBoard, BLACK)).toBeNull()
    }
  })

  it('always takes its own five even at blunderRate 1.0', () => {
    const stones = [
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE],
      [9, 4, BLACK], [11, 5, BLACK], [11, 6, BLACK], [12, 8, BLACK],
    ]
    for (let i = 0; i < 25; i++) {
      const board = place(stones)
      const { applied } = engineReply(board, {}, { searchDepth: 1, blunderRate: 1.0 })
      expect(applied.winner).toBeTruthy()
    }
  })

  it('still blunders in quiet positions (the feature stays alive)', () => {
    // No forced move on the board — blunderRate 1.0 must produce a blunder.
    const board = place([
      [9, 9, BLACK], [9, 10, WHITE], [10, 9, BLACK], [8, 8, WHITE],
    ])
    const engine = new PenteEngine({ searchDepth: 1, timeBudgetMs: 500, blunderRate: 1.0 })
    const move = engine.findBestMove(board, WHITE, {})
    expect(move.blundered).toBe(true)
  })
})

// ── Production worker parity ──────────────────────────────────────────────────
// The live game gets moves from public/penteWorker.js, not from PenteEngine.
// Load the actual worker file in a VM sandbox and drive it via onmessage.

function loadWorker() {
  const url = new URL('../../../../public/penteWorker.js', import.meta.url)
  const code = fs.readFileSync(url, 'utf8')
  const messages = []
  const sandbox = {}
  sandbox.self = {
    onmessage: null,
    postMessage: (m) => messages.push(m),
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: 'penteWorker.js' })
  return {
    findMove(board, player, captures, config) {
      messages.length = 0
      sandbox.self.onmessage({
        data: { type: 'findMove', board, player, captures, config, gameMode: null },
      })
      const reply = messages[messages.length - 1]
      expect(reply?.type).toBe('move')
      return reply.result
    },
  }
}

describe('production worker (public/penteWorker.js) parity', () => {
  const worker = loadWorker()

  const workerReply = (board, captures, config) => {
    const move = worker.findMove(
      board.map(r => [...r]), WHITE, { ...captures },
      { timeBudgetMs: 1200, blunderRate: 0, ...config },
    )
    expect(move).toBeTruthy()
    return { move, applied: applyMove(board, move.row, move.col, WHITE, { ...captures }, null) }
  }

  describe.each([1, 2])('averts immediate win threats (depth %i)', (searchDepth) => {
    for (const t of THREATS) {
      it(`blocks ${t.name}`, () => {
        const board = place(t.stones)
        const { applied } = workerReply(board, {}, { searchDepth })
        expect(applied.winner).toBeFalsy()
        expect(canWinNextMove(applied.newBoard, BLACK)).toBeNull()
      })
    }
  })

  it('completes its own five-in-a-row', () => {
    const board = place([
      [9, 5, WHITE], [9, 6, WHITE], [9, 7, WHITE], [9, 8, WHITE],
      [9, 4, BLACK], [11, 5, BLACK], [11, 6, BLACK], [12, 8, BLACK],
    ])
    const { applied } = workerReply(board, {}, { searchDepth: 2 })
    expect(applied.winner).toBeTruthy()
  })

  it('takes the fifth capture for a capture win', () => {
    const board = place([
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, WHITE],
      [4, 4, BLACK], [15, 4, BLACK],
    ])
    const { move } = workerReply(board, { [WHITE]: 4 }, { searchDepth: 2 })
    expect([move.row, move.col]).toEqual([9, 4])
  })

  it('never blunders a forced block, even at blunderRate 1.0', () => {
    const stones = [
      [9, 5, BLACK], [9, 6, BLACK], [9, 7, BLACK], [9, 8, BLACK],
      [9, 4, WHITE], [12, 12, WHITE],
    ]
    for (let i = 0; i < 25; i++) {
      const board = place(stones)
      const { applied } = workerReply(board, {}, { searchDepth: 1, blunderRate: 1.0 })
      expect(applied.winner).toBeFalsy()
      expect(canWinNextMove(applied.newBoard, BLACK)).toBeNull()
    }
  })
})
