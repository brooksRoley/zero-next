/**
 * Cloudfall: the falling-block rules, with no React and no canvas.
 *
 * Every function here is pure: it takes a state and returns a new one, so the
 * page only draws, and the tests can replay a game move by move from a seed.
 *
 * Coordinates: x grows right, y grows down. The well is 10 wide and 22 tall;
 * rows 0 and 1 are the hidden "clouds" above the visible 20 rows, where new
 * pieces enter.
 */

export const COLS = 10
export const VISIBLE_ROWS = 20
export const HIDDEN_ROWS = 2
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS

/** How long a grounded piece waits before it locks, and how many moves may reset that wait. */
export const LOCK_DELAY_MS = 500
export const MAX_LOCK_RESETS = 15
export const LINES_PER_LEVEL = 10
export const PREVIEW_COUNT = 3

export const PIECES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const
export type PieceKind = (typeof PIECES)[number]

/** A board cell: 0 is empty, otherwise 1 + the index of the piece in PIECES. */
export type Cell = number
export type Board = Cell[][]

type Point = readonly [number, number]

/** Spawn shapes (rotation 0) inside each piece's bounding box. */
const SHAPES: Record<PieceKind, { size: number; cells: Point[] }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
}

/** Each piece's cells for rotations 0..3 (clockwise), worked out once. */
const ROTATIONS: Record<PieceKind, Point[][]> = Object.fromEntries(
  PIECES.map((kind) => {
    const { size, cells } = SHAPES[kind]
    const states: Point[][] = [cells]
    for (let r = 1; r < 4; r++) {
      states.push(states[r - 1].map(([x, y]) => [size - 1 - y, x] as Point))
    }
    return [kind, states]
  }),
) as Record<PieceKind, Point[][]>

/**
 * Wall kicks: the offsets tried, in order, when a turn is blocked. The values
 * are the widely used "SRS" table, written with y pointing down. Keyed by
 * `${from}${to}` rotation index.
 */
const KICKS_JLSTZ: Record<string, Point[]> = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}
const KICKS_I: Record<string, Point[]> = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}

/** Points for clearing 1–4 rows at once, before the level multiplier. */
export const LINE_POINTS = [0, 100, 300, 500, 800] as const
export const CLEAR_NAMES = ['', 'Single', 'Double', 'Triple', 'Skyline'] as const

export type ActivePiece = { kind: PieceKind; rot: number; x: number; y: number }

export type GameEvent =
  | { type: 'clear'; lines: number; points: number; level: number; name: string; newLevel: number | null; rows: number[] }
  | { type: 'over'; reason: 'blockOut' | 'lockOut' }

export type Status = 'ready' | 'playing' | 'paused' | 'over'

export type GameState = {
  board: Board
  active: ActivePiece | null
  queue: PieceKind[]
  hold: PieceKind | null
  canHold: boolean
  score: number
  lines: number
  level: number
  status: Status
  /** Player actions that changed the board or the piece. 0 means nobody has played yet. */
  moves: number
  pieces: number
  /** The latest thing worth explaining to the player, with an id that changes each time. */
  event: GameEvent | null
  eventId: number
  rng: number
  fallMs: number
  lockMs: number
  lockResets: number
  lowestY: number
}

// ── Randomness ──

/** One step of mulberry32: returns the next seed and a float in [0, 1). */
export function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) | 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296]
}

/** A shuffled bag of all seven pieces (Fisher–Yates), so each arrives once per seven. */
export function drawBag(seed: number): [PieceKind[], number] {
  const bag: PieceKind[] = [...PIECES]
  let s = seed
  for (let i = bag.length - 1; i > 0; i--) {
    const [ns, r] = nextRandom(s)
    s = ns
    const j = Math.floor(r * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return [bag, s]
}

function refill(queue: PieceKind[], seed: number): [PieceKind[], number] {
  let q = queue
  let s = seed
  while (q.length < PREVIEW_COUNT + 1) {
    const [bag, ns] = drawBag(s)
    q = [...q, ...bag]
    s = ns
  }
  return [q, s]
}

// ── Geometry ──

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0))
}

export function cellValue(kind: PieceKind): Cell {
  return PIECES.indexOf(kind) + 1
}

export function kindOf(cell: Cell): PieceKind | null {
  return cell > 0 ? PIECES[cell - 1] : null
}

/** The board squares a piece covers. */
export function pieceCells(p: ActivePiece): Point[] {
  return ROTATIONS[p.kind][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy] as Point)
}

/** A piece's shape at rotation 0, for drawing the next and hold previews. */
export function previewCells(kind: PieceKind): Point[] {
  return SHAPES[kind].cells
}

export function fits(board: Board, p: ActivePiece): boolean {
  return pieceCells(p).every(
    ([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y][x] === 0,
  )
}

function spawnPiece(kind: PieceKind): ActivePiece {
  const size = SHAPES[kind].size
  return { kind, rot: 0, x: Math.floor((COLS - size) / 2), y: kind === 'I' ? -1 : 0 }
}

/** Where the active piece would land if dropped straight down. */
export function ghostY(state: GameState): number | null {
  const p = state.active
  if (!p) return null
  let y = p.y
  while (fits(state.board, { ...p, y: y + 1 })) y++
  return y
}

/** Milliseconds per row at a level: the common guideline curve, floored at 1 row a frame. */
export function gravityMs(level: number): number {
  const l = Math.max(1, level)
  return Math.max(16, 1000 * Math.pow(0.8 - (l - 1) * 0.007, l - 1))
}

// ── State transitions ──

export function createGame(seed: number): GameState {
  const [queue, rng] = refill([], seed >>> 0)
  return {
    board: emptyBoard(),
    active: null,
    queue,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    status: 'ready',
    moves: 0,
    pieces: 0,
    event: null,
    eventId: 0,
    rng,
    fallMs: 0,
    lockMs: 0,
    lockResets: 0,
    lowestY: 0,
  }
}

function withEvent(state: GameState, event: GameEvent): GameState {
  return { ...state, event, eventId: state.eventId + 1 }
}

/** Bring the next piece in from the clouds, or end the game if it has no room. */
function spawnNext(state: GameState, kind?: PieceKind): GameState {
  let queue = state.queue
  let rng = state.rng
  let next = kind
  if (!next) {
    ;[next, ...queue] = queue
    ;[queue, rng] = refill(queue, rng)
  }
  let piece = spawnPiece(next)
  if (!fits(state.board, piece)) {
    return withEvent({ ...state, queue, rng, active: null, status: 'over' }, { type: 'over', reason: 'blockOut' })
  }
  // Step into view at once when there is room, so the new piece is visible.
  if (fits(state.board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 }
  return { ...state, queue, rng, active: piece, fallMs: 0, lockMs: 0, lockResets: 0, lowestY: piece.y }
}

export function start(state: GameState): GameState {
  if (state.status !== 'ready') return state
  return spawnNext({ ...state, status: 'playing' })
}

export function togglePause(state: GameState): GameState {
  if (state.status === 'playing') return { ...state, status: 'paused' }
  if (state.status === 'paused') return { ...state, status: 'playing' }
  return state
}

/** Remove full rows. Returns the new board, how many rows went, and which ones. */
export function clearLines(board: Board): [Board, number, number[]] {
  const full = board.flatMap((row, y) => (row.every((c) => c > 0) ? [y] : []))
  const kept = board.filter((row) => row.some((c) => c === 0))
  const fresh = Array.from({ length: full.length }, () => Array<Cell>(COLS).fill(0))
  return [[...fresh, ...kept], full.length, full]
}

/** Fix the active piece in place, clear rows, score them, and bring in the next piece. */
function lock(state: GameState): GameState {
  const p = state.active
  if (!p) return state
  const placed = state.board.map((row) => [...row])
  const cells = pieceCells(p)
  for (const [x, y] of cells) placed[y][x] = cellValue(p.kind)
  const [board, cleared, rows] = clearLines(placed)

  const lines = state.lines + cleared
  const level = 1 + Math.floor(lines / LINES_PER_LEVEL)
  const points = LINE_POINTS[cleared] * state.level
  let next: GameState = {
    ...state,
    board,
    active: null,
    lines,
    level,
    score: state.score + points,
    pieces: state.pieces + 1,
    canHold: true,
  }

  if (cleared > 0) {
    next = withEvent(next, {
      type: 'clear',
      lines: cleared,
      points,
      level: state.level,
      name: CLEAR_NAMES[cleared],
      newLevel: level > state.level ? level : null,
      rows,
    })
  }

  // A piece that settled wholly above the visible well means the stack has reached the clouds.
  if (cleared === 0 && cells.every(([, y]) => y < HIDDEN_ROWS)) {
    return withEvent({ ...next, status: 'over' }, { type: 'over', reason: 'lockOut' })
  }
  return spawnNext(next)
}

/** After a successful move or turn: a grounded piece gets more time, up to a limit. */
function afterShift(state: GameState, piece: ActivePiece): GameState {
  const grounded = !fits(state.board, { ...piece, y: piece.y + 1 })
  let { lockMs, lockResets } = state
  if (grounded && lockResets < MAX_LOCK_RESETS) {
    lockMs = 0
    lockResets++
  }
  return { ...state, active: piece, lockMs, lockResets, moves: state.moves + 1 }
}

export function move(state: GameState, dx: -1 | 1): GameState {
  if (state.status !== 'playing' || !state.active) return state
  const piece = { ...state.active, x: state.active.x + dx }
  if (!fits(state.board, piece)) return state
  return afterShift(state, piece)
}

/** Turn the piece (1 = clockwise, -1 = counter-clockwise), trying each wall kick in order. */
export function rotate(state: GameState, dir: 1 | -1 = 1): GameState {
  const p = state.active
  if (state.status !== 'playing' || !p) return state
  if (p.kind === 'O') return state
  const to = (p.rot + dir + 4) % 4
  const table = p.kind === 'I' ? KICKS_I : KICKS_JLSTZ
  for (const [kx, ky] of table[`${p.rot}${to}`]) {
    const piece = { ...p, rot: to, x: p.x + kx, y: p.y + ky }
    if (fits(state.board, piece)) return afterShift(state, piece)
  }
  return state
}

/** One row down by hand, for one point. Does nothing on the ground; the lock delay decides. */
export function softDrop(state: GameState): GameState {
  const p = state.active
  if (state.status !== 'playing' || !p) return state
  const piece = { ...p, y: p.y + 1 }
  if (!fits(state.board, piece)) return state
  return {
    ...state,
    active: piece,
    score: state.score + 1,
    moves: state.moves + 1,
    fallMs: 0,
    ...(piece.y > state.lowestY ? { lowestY: piece.y, lockResets: 0 } : {}),
  }
}

/** Straight to the ghost and lock at once, for two points a row. */
export function hardDrop(state: GameState): GameState {
  const p = state.active
  if (state.status !== 'playing' || !p) return state
  const y = ghostY(state) ?? p.y
  const dropped = { ...state, active: { ...p, y }, score: state.score + 2 * (y - p.y), moves: state.moves + 1 }
  return lock(dropped)
}

/** Put the piece aside for later (once per piece), taking the held one or the next. */
export function holdPiece(state: GameState): GameState {
  const p = state.active
  if (state.status !== 'playing' || !p || !state.canHold) return state
  return spawnNext({ ...state, hold: p.kind, canHold: false, moves: state.moves + 1 }, state.hold ?? undefined)
}

/** Advance time: gravity pulls the piece down, and a grounded piece locks after its delay. */
export function tick(state: GameState, dtMs: number): GameState {
  if (state.status !== 'playing' || !state.active) return state
  let s = state
  let fallMs = s.fallMs + dtMs
  const interval = gravityMs(s.level)
  let piece = s.active!
  while (fallMs >= interval && fits(s.board, { ...piece, y: piece.y + 1 })) {
    fallMs -= interval
    piece = { ...piece, y: piece.y + 1 }
  }
  const grounded = !fits(s.board, { ...piece, y: piece.y + 1 })
  s = { ...s, active: piece, fallMs: grounded ? 0 : fallMs }
  if (piece.y > s.lowestY) s = { ...s, lowestY: piece.y, lockResets: 0, lockMs: 0 }
  if (!grounded) return { ...s, lockMs: 0 }
  const lockMs = s.lockMs + dtMs
  if (lockMs >= LOCK_DELAY_MS) return lock(s)
  return { ...s, lockMs }
}

/** The sentence that explains the latest event, in the game's own words. */
export function describeEvent(event: GameEvent | null): string | null {
  if (!event) return null
  switch (event.type) {
    case 'clear': {
      const rows = event.lines === 1 ? '1 row' : `${event.lines} rows`
      const base = LINE_POINTS[event.lines]
      const sum = `${event.name}! ${rows} cleared: ${base} × level ${event.level} = ${event.points} points.`
      return event.newLevel
        ? `${sum} Level ${event.newLevel}: every ${LINES_PER_LEVEL} rows, pieces fall faster.`
        : sum
    }
    case 'over':
      return event.reason === 'blockOut'
        ? 'The stack reached the clouds: the next piece had no room to come in.'
        : 'The stack reached the clouds: that piece settled above the top of the well.'
  }
}
