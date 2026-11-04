import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { COLS, VISIBLE_ROWS, createGame, start, type GameState } from '../engine'
import { actionForKey, applyAction, backstageLine, isTypingTarget, viewCells } from '../backstage'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const playing = (): GameState => start(createGame(7))

describe('backstage keys', () => {
  it('maps W A S D, Space, P and Esc, in either case', () => {
    expect(actionForKey('a')).toBe('left')
    expect(actionForKey('D')).toBe('right')
    expect(actionForKey('w')).toBe('rotate')
    expect(actionForKey('s')).toBe('soft')
    expect(actionForKey(' ')).toBe('drop')
    expect(actionForKey('p')).toBe('pause')
    expect(actionForKey('Escape')).toBe('exit')
  })

  it('leaves arrow keys, page keys and shortcuts to the page, so it still scrolls', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'PageDown', 'Home', 'Tab', 'Enter']) {
      expect(actionForKey(key), key).toBeNull()
    }
    expect(actionForKey('s', { meta: true })).toBeNull()
    expect(actionForKey('a', { ctrl: true })).toBeNull()
    expect(actionForKey(' ', { alt: true })).toBeNull()
  })

  it('treats fields as typing, and buttons and the page body as not', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('backstage actions', () => {
  it('Space starts a game, then drops the piece', () => {
    const ready = createGame(7)
    const started = applyAction(ready, 'drop', 1)
    expect(started.status).toBe('playing')
    const dropped = applyAction(started, 'drop', 1)
    expect(dropped.pieces).toBeGreaterThan(started.pieces)
  })

  it('Space after a game over starts a fresh one', () => {
    const over: GameState = { ...playing(), status: 'over', score: 900 }
    const next = applyAction(over, 'drop', 3)
    expect(next.status).toBe('playing')
    expect(next.score).toBe(0)
  })

  it('P pauses and Space resumes', () => {
    const paused = applyAction(playing(), 'pause', 1)
    expect(paused.status).toBe('paused')
    expect(applyAction(paused, 'drop', 1).status).toBe('playing')
  })

  it('A and D move the piece one column', () => {
    const s = playing()
    expect(applyAction(s, 'left', 1).active!.x).toBe(s.active!.x - 1)
    expect(applyAction(s, 'right', 1).active!.x).toBe(s.active!.x + 1)
  })

  it('Esc leaves the game alone; the overlay closes it', () => {
    const s = playing()
    expect(applyAction(s, 'exit', 1)).toBe(s)
  })
})

describe('backstage view', () => {
  it('shows 200 squares: the falling piece and where it would land', () => {
    const cells = viewCells(playing())
    expect(cells).toHaveLength(COLS * VISIBLE_ROWS)
    expect(cells.filter((c) => c?.layer === 'active').length).toBeGreaterThan(0)
    expect(cells.filter((c) => c?.layer === 'ghost')).toHaveLength(4)
  })

  it('shows an empty board before a game starts', () => {
    expect(viewCells(createGame(7)).every((c) => c === null)).toBe(true)
  })

  it('says one thing at a time', () => {
    expect(backstageLine(createGame(7))).toMatch(/^Space to start/)
    expect(backstageLine({ ...playing(), status: 'over', score: 1200 })).toBe('Game over at 1,200 · Space for another')
  })
})

describe('the backstage overlay stays out of the way', () => {
  const overlay = read('src/components/games/cloudfall/BackstageBlocks.tsx')
  const theater = read('src/pages/theater.tsx')

  it('never takes a click and hides its board from screen readers', () => {
    expect(overlay).toContain('pointer-events-none fixed inset-0')
    expect(overlay).toContain('aria-hidden="true"')
  })

  it('is off until a visitor turns it on, and is not remembered', () => {
    expect(theater).toContain('useState(false)')
    expect(theater).toContain('{backstage && <BackstageBlocks')
    expect(theater).not.toMatch(/localStorage[\s\S]{0,80}backstage/)
  })

  it('loads its code only when turned on', () => {
    expect(theater).toMatch(/dynamic\(\(\) => import\('src\/components\/games\/cloudfall\/BackstageBlocks'\)/)
  })

  it('lets fields keep their keys and fires the shared game events', () => {
    expect(overlay).toContain('isTypingTarget(e.target)')
    expect(overlay).toContain("createGameTracker(SLUG")
    expect(overlay).toContain("mode: 'backstage'")
  })
})
