import { useCallback, useEffect, useRef, useState } from 'react'
import { PIECE_COLORS } from 'src/components/games/cloudfall/paint'
import { createGameTracker, trackGame } from 'src/lib/analytics'
import { COLS, createGame, tick, VISIBLE_ROWS, type GameState } from 'src/lib/games/cloudfall/engine'
import { WELL_ASPECT } from 'src/lib/games/cloudfall/dimensions'
import { startFrameClock } from 'src/lib/ui/frameClock'
import {
  actionForKey,
  applyAction,
  backstageLine,
  isTypingTarget,
  viewCells,
  type ViewCell,
} from 'src/lib/games/cloudfall/backstage'

// Cloudfall played over the page as a faint CSS grid: the experimental piece in
// the Theater. It never takes a click (pointer-events: none), it takes only
// W A S D, Space, P and Esc, and only while it is on. Arrow keys still scroll.
// The rules are the tested engine from /games/cloudfall; this only draws.

const SLUG = 'cloudfall'

// How strongly each layer shows. Low enough to read the Theater through.
const ALPHA: Record<NonNullable<ViewCell>['layer'], number> = {
  locked: 0.16,
  active: 0.32,
  ghost: 0.08,
}

function seed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
}

// Re-render only when something a viewer can see changed, not on every frame.
function looksSame(a: GameState, b: GameState): boolean {
  return a.board === b.board && a.active === b.active && a.status === b.status && a.score === b.score
}

export default function BackstageBlocks({ onExit }: { onExit: () => void }) {
  const stateRef = useRef<GameState>(createGame(seed()))
  const [view, setView] = useState<GameState>(stateRef.current)
  const trackerRef = useRef(createGameTracker(SLUG, (event, game, metadata) => trackGame(event, game, metadata)))

  const commit = useCallback((next: GameState) => {
    const prev = stateRef.current
    if (next === prev) return
    stateRef.current = next
    trackerRef.current.update(
      { moveCount: next.moves, finished: next.status === 'over' },
      {
        start: () => ({ mode: 'backstage', input: 'keyboard' }),
        end: () => ({ mode: 'backstage', score: next.score, lines: next.lines, level: next.level, pieces: next.pieces }),
      },
    )
    if (!looksSame(prev, next)) setView(next)
  }, [])

  // Keys: captured before the page sees them, so Space drops a piece instead of
  // scrolling or pressing the focused button. Fields keep every key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const action = actionForKey(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey })
      if (!action) return
      e.preventDefault()
      e.stopPropagation()
      if (action === 'exit') return onExit()
      if (e.repeat && (action === 'drop' || action === 'rotate' || action === 'pause')) return
      commit(applyAction(stateRef.current, action, seed()))
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [commit, onExit])

  // Gravity. requestAnimationFrame stops in a hidden tab, and the step is
  // capped, so coming back to the tab never drops a piece by surprise.
  useEffect(() => startFrameClock((dt) => commit(tick(stateRef.current, dt))), [commit])

  // A game left running is paused when the overlay goes away, and counted.
  useEffect(() => () => {
    const s = stateRef.current
    if (s.moves > 0 && s.status !== 'over') {
      trackerRef.current.update({ moveCount: s.moves, finished: true }, {
        end: () => ({ mode: 'backstage', score: s.score, lines: s.lines, level: s.level, pieces: s.pieces, reason: 'closed' }),
      })
    }
  }, [])

  const cells = viewCells(view)

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="backstage-board"
        className="pointer-events-none fixed inset-0 z-40 flex justify-center pb-14 pt-20"
      >
        <div
          className="grid h-full max-w-[calc(100vw-32px)] gap-[2px] border-x border-[#E9E3D6]/[0.06]"
          style={{
            aspectRatio: WELL_ASPECT,
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${VISIBLE_ROWS}, 1fr)`,
            opacity: view.status === 'over' ? 0.5 : 1,
            transition: 'opacity 0.4s ease',
          }}
        >
          {cells.map((cell, i) => (
            <span
              key={i}
              className="rounded-[3px]"
              style={
                cell
                  ? cell.layer === 'ghost'
                    ? { boxShadow: `inset 0 0 0 1px ${PIECE_COLORS[cell.kind]}`, opacity: ALPHA.ghost * 3 }
                    : { backgroundColor: PIECE_COLORS[cell.kind], opacity: ALPHA[cell.layer] }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none fixed bottom-4 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2 truncate rounded-full bg-ink-950/70 px-4 py-1.5 font-mono text-xs text-ink-300 backdrop-blur"
      >
        {backstageLine(view)}
      </p>
      {/* Screen readers hear the status changes, not every point scored. */}
      <p role="status" className="sr-only">
        {view.status === 'playing' ? 'Cloudfall is running over the page.' : backstageLine(view)}
      </p>
    </>
  )
}
