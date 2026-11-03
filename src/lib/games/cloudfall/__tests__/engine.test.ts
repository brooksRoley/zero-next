import { describe, it, expect } from 'vitest'
import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  LOCK_DELAY_MS,
  PIECES,
  cellValue,
  clearLines,
  createGame,
  describeEvent,
  drawBag,
  emptyBoard,
  fits,
  ghostY,
  gravityMs,
  hardDrop,
  holdPiece,
  move,
  pieceCells,
  rotate,
  softDrop,
  start,
  tick,
  togglePause,
  type Board,
  type GameState,
  type PieceKind,
} from 'src/lib/games/cloudfall/engine'

/** A playing state with a chosen piece in a chosen place on a chosen board. */
function staged(kind: PieceKind, x: number, y: number, board: Board = emptyBoard(), rot = 0): GameState {
  const s = start(createGame(7))
  return { ...s, board, active: { kind, rot, x, y }, lowestY: y }
}

/** A board whose bottom `rows` rows are full except for the columns in `gaps`. */
function filledBottom(rows: number, gaps: number[] = []): Board {
  const b = emptyBoard()
  for (let y = ROWS - rows; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (!gaps.includes(x)) b[y][x] = cellValue('O')
  }
  return b
}

const sortCells = (cells: (readonly [number, number])[]) =>
  cells.map(([x, y]) => `${x},${y}`).sort()

describe('the seven-piece bag', () => {
  it('deals each of the seven pieces exactly once per bag', () => {
    let seed = 12345
    for (let i = 0; i < 50; i++) {
      const [bag, next] = drawBag(seed)
      expect([...bag].sort()).toEqual([...PIECES].sort())
      seed = next
    }
  })

  it('keeps that promise across a long game: every aligned run of 7 pieces is a full set', () => {
    let s = start(createGame(99))
    const dealt: PieceKind[] = [s.active!.kind]
    // Hard-drop on an empty-ish board, clearing it whenever it gets tall, to see 70 pieces.
    while (dealt.length < 70) {
      s = hardDrop(s)
      if (s.status === 'over' || s.board[8].some((c) => c > 0)) s = { ...s, board: emptyBoard(), status: 'playing' }
      if (!s.active) s = { ...s, ...start({ ...s, status: 'ready' }) }
      dealt.push(s.active!.kind)
    }
    for (let i = 0; i < 70; i += 7) {
      expect(dealt.slice(i, i + 7).sort()).toEqual([...PIECES].sort())
    }
  })

  it('is reproducible from a seed', () => {
    expect(createGame(5).queue).toEqual(createGame(5).queue)
    expect(createGame(5).queue).not.toEqual(createGame(6).queue)
  })
})

describe('moving and turning', () => {
  it('starts in the ready state and only spawns a piece on start', () => {
    const g = createGame(1)
    expect(g.status).toBe('ready')
    expect(g.active).toBeNull()
    expect(move(g, 1)).toBe(g)
    const s = start(g)
    expect(s.status).toBe('playing')
    expect(s.active?.kind).toBe(g.queue[0])
    expect(s.moves).toBe(0)
  })

  it('stops at the walls', () => {
    let s = staged('O', 0, 10)
    expect(move(s, -1)).toBe(s)
    s = staged('O', COLS - 2, 10)
    expect(move(s, 1)).toBe(s)
  })

  it('turns the T clockwise around its centre', () => {
    const s = rotate(staged('T', 3, 10), 1)
    expect(s.active!.rot).toBe(1)
    expect(sortCells(pieceCells(s.active!))).toEqual(sortCells([[4, 10], [4, 11], [4, 12], [5, 11]]))
    expect(s.moves).toBe(1)
  })

  it('four turns bring every piece back where it started', () => {
    for (const kind of PIECES) {
      let s = staged(kind, 3, 10)
      const before = sortCells(pieceCells(s.active!))
      for (let i = 0; i < 4; i++) s = rotate(s, 1)
      expect(sortCells(pieceCells(s.active!))).toEqual(before)
    }
  })

  it('kicks off the left wall instead of refusing the turn', () => {
    // A vertical I hugging the left wall (rotation 3 puts it in box column 1, so x = -1).
    const s = staged('I', -1, 8, emptyBoard(), 3)
    expect(fits(s.board, s.active!)).toBe(true)
    const turned = rotate(s, 1) // 3 -> 0 would poke out at x = -1 without a kick
    expect(turned.active!.rot).toBe(0)
    expect(pieceCells(turned.active!).every(([x]) => x >= 0 && x < COLS)).toBe(true)
    expect(turned.active!.x).toBeGreaterThan(s.active!.x)
  })

  it('kicks off the right wall too', () => {
    const s = staged('T', COLS - 2, 10, emptyBoard(), 3) // pointing left, cells in box columns 0–1
    expect(fits(s.board, s.active!)).toBe(true)
    const turned = rotate(s, 1) // 3 -> 0 needs three columns, one past the wall
    expect(turned.active!.x).toBeLessThan(s.active!.x)
    expect(turned.active!.rot).toBe(0)
    expect(pieceCells(turned.active!).every(([x]) => x < COLS)).toBe(true)
  })

  it('refuses a turn when every kick is blocked', () => {
    // An I lying flat in a one-row-tall tunnel cannot stand up.
    const b = emptyBoard()
    for (let x = 0; x < COLS; x++) {
      b[ROWS - 2][x] = cellValue('O')
      if (x > 3) b[ROWS - 1][x] = cellValue('O')
    }
    for (let y = 0; y < ROWS - 2; y++) for (let x = 0; x < COLS; x++) b[y][x] = cellValue('Z')
    const s = staged('I', 0, ROWS - 2, b) // cells on the bottom row, x 0–3
    expect(fits(b, s.active!)).toBe(true)
    expect(rotate(s, 1)).toBe(s)
  })

  it('leaves the O alone when asked to turn', () => {
    const s = staged('O', 4, 10)
    expect(rotate(s, 1)).toBe(s)
  })
})

describe('dropping and locking', () => {
  it('soft drop moves one row for one point', () => {
    const s = softDrop(staged('T', 3, 5))
    expect(s.active!.y).toBe(6)
    expect(s.score).toBe(1)
  })

  it('hard drop lands on the ghost, scores two a row, and brings the next piece', () => {
    const s = staged('O', 4, 2)
    const landing = ghostY(s)!
    expect(landing).toBe(ROWS - 2)
    const after = hardDrop(s)
    expect(after.board[ROWS - 1][4]).toBe(cellValue('O'))
    expect(after.score).toBe(2 * (landing - 2))
    expect(after.pieces).toBe(1)
    expect(after.active).not.toBeNull()
  })

  it('gravity pulls the piece down one row per interval', () => {
    const s = staged('T', 3, 5)
    expect(tick(s, gravityMs(1) - 1).active!.y).toBe(5)
    expect(tick(s, gravityMs(1)).active!.y).toBe(6)
  })

  it('a grounded piece locks after the lock delay, not before', () => {
    const s = staged('O', 4, ROWS - 2)
    expect(tick(s, LOCK_DELAY_MS - 1).pieces).toBe(0)
    expect(tick(tick(s, LOCK_DELAY_MS - 1), 1).pieces).toBe(1)
  })

  it('pausing freezes time and moves', () => {
    const p = togglePause(staged('T', 3, 5))
    expect(p.status).toBe('paused')
    expect(tick(p, 5000)).toBe(p)
    expect(move(p, 1)).toBe(p)
    expect(togglePause(p).status).toBe('playing')
  })

  it('hold swaps once per piece', () => {
    const s = staged('T', 3, 5)
    const held = holdPiece(s)
    expect(held.hold).toBe('T')
    expect(held.active!.kind).toBe(s.queue[0])
    expect(holdPiece(held)).toBe(held)
    const next = holdPiece(hardDrop(held))
    expect(next.active!.kind).toBe('T')
  })
})

describe('clearing rows and scoring', () => {
  it('clearLines removes full rows and drops the rest', () => {
    const b = filledBottom(2)
    b[ROWS - 3][0] = cellValue('L')
    const [after, n] = clearLines(b)
    expect(n).toBe(2)
    expect(after).toHaveLength(ROWS)
    expect(after[ROWS - 1][0]).toBe(cellValue('L'))
    expect(after[ROWS - 2].every((c) => c === 0)).toBe(true)
  })

  it.each([
    [1, 100, 'Single'],
    [2, 300, 'Double'],
    [3, 500, 'Triple'],
    [4, 800, 'Skyline'],
  ])('a vertical I finishing %i rows scores %i at level 1', (rows, points, name) => {
    // Rows full except column 0; the I stands in that column (rotation 1 = box column 2, so x = -2).
    const board = filledBottom(rows, [0])
    const s = staged('I', -2, ROWS - 4, board, 1)
    const after = hardDrop(s)
    expect(after.lines).toBe(rows)
    expect(after.score - s.score).toBe(points)
    expect(after.event).toMatchObject({ type: 'clear', lines: rows, name, points })
    expect(describeEvent(after.event)).toContain(`= ${points} points`)
  })

  it('multiplies by the level and levels up every ten rows', () => {
    const s = { ...staged('I', -2, ROWS - 4, filledBottom(4, [0]), 1), lines: 8, level: 3 }
    const after = hardDrop(s)
    expect(after.score - s.score).toBe(800 * 3)
    expect(after.lines).toBe(12)
    expect(after.level).toBe(2) // level follows lines: 1 + floor(12 / 10)
    const fast = { ...s, lines: 28 }
    const up = hardDrop(fast)
    expect(up.level).toBe(4)
    expect(up.event).toMatchObject({ newLevel: 4 })
    expect(describeEvent(up.event)).toMatch(/Level 4/)
  })

  it('gets faster as the level rises', () => {
    expect(gravityMs(1)).toBe(1000)
    expect(gravityMs(5)).toBeLessThan(gravityMs(4))
    expect(gravityMs(30)).toBeGreaterThanOrEqual(16)
  })
})

describe('game over', () => {
  it('ends when the next piece has no room to come in, and says why', () => {
    const b = emptyBoard()
    for (let y = 0; y < ROWS; y++) for (let x = 1; x < COLS - 1; x++) b[y][x] = cellValue('S')
    // Columns 0 and 9 are open, so the I can drop without finishing a row; the spawn area is blocked.
    const s = staged('I', -2, 0, b, 1)
    const after = hardDrop(s)
    expect(after.status).toBe('over')
    expect(after.active).toBeNull()
    expect(after.event).toEqual({ type: 'over', reason: 'blockOut' })
    expect(describeEvent(after.event)).toMatch(/reached the clouds/)
  })

  it('ends when a piece settles wholly above the visible well', () => {
    const b = emptyBoard()
    for (let y = HIDDEN_ROWS; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x !== 9) b[y][x] = cellValue('S')
    const s = staged('O', 0, 0, b)
    const after = hardDrop(s)
    expect(after.status).toBe('over')
    expect(after.event).toEqual({ type: 'over', reason: 'lockOut' })
  })

  it('a finished game ignores input and time', () => {
    const over = { ...staged('T', 3, 5), status: 'over' as const }
    expect(move(over, 1)).toBe(over)
    expect(hardDrop(over)).toBe(over)
    expect(tick(over, 1000)).toBe(over)
  })

  it('a random game played by hard drops always ends, and never leaves a full row behind', () => {
    let s = start(createGame(2024))
    let guard = 0
    while (s.status === 'playing' && guard++ < 1000) {
      s = guard % 3 === 0 ? move(s, 1) : s
      s = guard % 5 === 0 ? rotate(s, 1) : s
      s = hardDrop(s)
      expect(s.board.some((row) => row.every((c) => c > 0))).toBe(false)
    }
    expect(s.status).toBe('over')
  })
})
