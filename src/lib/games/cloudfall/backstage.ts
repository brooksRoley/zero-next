// Cloudfall, backstage: the same rules as /games/cloudfall, played faintly over
// the Theater page. This file is the pure part: which keys mean what, which
// targets keep their keys, and what each of the 200 visible squares shows.
// The overlay component only draws what viewCells() returns.

import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  VISIBLE_ROWS,
  createGame,
  ghostY,
  hardDrop,
  kindOf,
  move,
  pieceCells,
  rotate,
  softDrop,
  start,
  togglePause,
  type GameState,
  type PieceKind,
} from './engine'

export type BackstageAction = 'left' | 'right' | 'rotate' | 'soft' | 'drop' | 'pause' | 'exit'

// W A S D and Space only. Arrow keys and Page keys stay with the page, so a
// reader can still scroll the Theater while a game runs.
const KEYS: Record<string, BackstageAction> = {
  a: 'left',
  d: 'right',
  w: 'rotate',
  s: 'soft',
  ' ': 'drop',
  p: 'pause',
  escape: 'exit',
}

/** The action a key means backstage, or null when the page should keep the key. */
export function actionForKey(key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {}): BackstageAction | null {
  if (mods.ctrl || mods.meta || mods.alt) return null
  return KEYS[key.toLowerCase()] ?? null
}

/** Typing into a field must never move a piece. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const el = target as HTMLElement
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true
}

/**
 * Apply one action. Space starts a fresh game when none is running, so a
 * visitor never needs the mouse once the overlay is on. 'exit' is the
 * caller's to handle (it turns the overlay off) and leaves the state alone.
 */
export function applyAction(state: GameState, action: BackstageAction, seed: number): GameState {
  switch (action) {
    case 'left':
      return move(state, -1)
    case 'right':
      return move(state, 1)
    case 'rotate':
      return rotate(state, 1)
    case 'soft':
      return softDrop(state)
    case 'drop':
      if (state.status === 'ready') return start(state)
      if (state.status === 'over') return start(createGame(seed))
      if (state.status === 'paused') return togglePause(state)
      return hardDrop(state)
    case 'pause':
      return togglePause(state)
    case 'exit':
      return state
  }
}

export type ViewCell = { kind: PieceKind; layer: 'locked' | 'active' | 'ghost' } | null

/** The 20 × 10 visible squares, row by row: locked blocks, the falling piece, and where it would land. */
export function viewCells(state: GameState): ViewCell[] {
  const cells: ViewCell[] = []
  for (let y = HIDDEN_ROWS; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const kind = kindOf(state.board[y][x])
      cells.push(kind ? { kind, layer: 'locked' } : null)
    }
  }
  const p = state.active
  if (p && state.status !== 'over') {
    const put = (x: number, y: number, layer: 'active' | 'ghost') => {
      const row = y - HIDDEN_ROWS
      if (row < 0 || row >= VISIBLE_ROWS || x < 0 || x >= COLS) return
      const i = row * COLS + x
      if (layer === 'ghost' && cells[i]) return
      cells[i] = { kind: p.kind, layer }
    }
    const gy = ghostY(state)
    if (gy !== null && gy !== p.y) {
      for (const [x, y] of pieceCells({ ...p, y: gy })) put(x, y, 'ghost')
    }
    for (const [x, y] of pieceCells(p)) put(x, y, 'active')
  }
  return cells
}

/** What the one line of status text says. */
export function backstageLine(state: GameState): string {
  if (state.status === 'ready') return 'Space to start · W A S D to play · Esc to put it away'
  if (state.status === 'paused') return 'Paused · Space or P to carry on'
  if (state.status === 'over') return `Game over at ${state.score.toLocaleString('en-US')} · Space for another`
  return `${state.score.toLocaleString('en-US')} · ${state.lines} ${state.lines === 1 ? 'row' : 'rows'} · level ${state.level}`
}
