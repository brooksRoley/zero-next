import Head from 'next/head'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import SkyBackdrop from 'src/components/games/cloudfall/SkyBackdrop'
import styles from 'src/components/games/cloudfall/Cloudfall.module.css'
import { drawBoard, drawPreview, FLASH_MS, OUTLINE, type Flash } from 'src/components/games/cloudfall/paint'
import {
  COLS,
  LINES_PER_LEVEL,
  PREVIEW_COUNT,
  VISIBLE_ROWS,
  createGame,
  describeEvent,
  hardDrop,
  holdPiece,
  move,
  rotate,
  softDrop,
  start,
  tick,
  togglePause,
  type GameEvent,
  type GameState,
  type PieceKind,
  type Status,
} from 'src/lib/games/cloudfall/engine'
import { createGameTracker, trackGame } from 'src/lib/analytics'
import { prefersReducedMotion } from 'src/lib/motion'
import { absoluteUrl } from 'src/lib/routes'

const SLUG = 'cloudfall'
const BEST_KEY = 'cloudfall_best'
const EVENT_SHOW_MS = 3500
// Holding a move key: one step at once, then a short wait, then a steady repeat.
const REPEAT_DELAY_MS = 170
const OVER_GRACE_MS = 800

type Action = 'left' | 'right' | 'rotate' | 'rotateBack' | 'soft' | 'hard' | 'hold'
const REPEAT_MS: Partial<Record<Action, number>> = { left: 50, right: 50, soft: 40 }

const KEYS: Record<string, Action> = {
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
  w: 'rotate',
  arrowup: 'rotate',
  x: 'rotate',
  z: 'rotateBack',
  q: 'rotateBack',
  s: 'soft',
  arrowdown: 'soft',
  ' ': 'hard',
  c: 'hold',
  shift: 'hold',
}

function apply(s: GameState, action: Action): GameState {
  switch (action) {
    case 'left':
      return move(s, -1)
    case 'right':
      return move(s, 1)
    case 'rotate':
      return rotate(s, 1)
    case 'rotateBack':
      return rotate(s, -1)
    case 'soft':
      return softDrop(s)
    case 'hard':
      return hardDrop(s)
    case 'hold':
      return holdPiece(s)
  }
}

const freshGame = () => createGame(Math.floor(Math.random() * 2 ** 32))

type Hud = {
  score: number
  lines: number
  level: number
  status: Status
  next: PieceKind[]
  hold: PieceKind | null
  canHold: boolean
  event: GameEvent | null
  eventId: number
}

function hudOf(s: GameState): Hud {
  return {
    score: s.score,
    lines: s.lines,
    level: s.level,
    status: s.status,
    next: s.queue.slice(0, PREVIEW_COUNT),
    hold: s.hold,
    canHold: s.canHold,
    event: s.event,
    eventId: s.eventId,
  }
}

function sameHud(a: Hud, b: Hud): boolean {
  return (
    a.score === b.score &&
    a.lines === b.lines &&
    a.level === b.level &&
    a.status === b.status &&
    a.hold === b.hold &&
    a.canHold === b.canHold &&
    a.eventId === b.eventId &&
    a.next.join('') === b.next.join('')
  )
}

function readBest(): number {
  try {
    const n = Number(window.localStorage.getItem(BEST_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function writeBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n))
  } catch {
    /* storage may be blocked; the best score just won't survive the visit */
  }
}

const fmt = (n: number) => n.toLocaleString('en-US')

/** Cell size that fits the well, the score bar and the buttons in the viewport. */
function useCellSize(): number {
  const [cell, setCell] = useState(26)
  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const wide = vw >= 1024
      // Below the nav (64px): the instruction line on wide screens; on phones also the title, score bar and buttons.
      const reserved = wide ? 64 + 110 : 64 + 270
      const fromH = (vh - reserved) / VISIBLE_ROWS
      const fromW = wide ? 32 : (vw - 32) / COLS
      setCell(Math.max(14, Math.min(32, Math.floor(Math.min(fromH, fromW)))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return cell
}

function Preview({ kind, size, dimmed = false }: { kind: PieceKind | null; size: [number, number]; dimmed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [w, h] = size
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawPreview(ctx, kind, w, h, dimmed)
  }, [kind, w, h, dimmed])
  return <canvas ref={ref} aria-hidden="true" style={{ width: w, height: h }} />
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border-2 bg-white/90 ${className}`}
      style={{ borderColor: OUTLINE, boxShadow: `0 4px 0 ${OUTLINE}` }}
    >
      {children}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-600">{children}</p>
}

function CandyButton({ onClick, children, autoFocus }: { onClick: () => void; children: ReactNode; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={(e) => {
        e.currentTarget.blur()
        onClick()
      }}
      className="min-h-[44px] rounded-full border-2 px-6 py-2 text-base font-bold text-ink-950 transition-transform duration-tap ease-settle hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
      style={{ borderColor: OUTLINE, background: '#ff8cbc', boxShadow: `0 3px 0 ${OUTLINE}` }}
    >
      {children}
    </button>
  )
}

const ICONS: Record<Action, ReactNode> = {
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  rotate: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" />,
  rotateBack: <path d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4" />,
  soft: <path d="M12 5v13M6 12l6 6 6-6" />,
  hard: <path d="M12 4v10M7 9l5 5 5-5M6 19h12" />,
  hold: <path d="M6 7h12v10H6zM9 7V5h6v2" />,
}

const PAD: { action: Action; label: string }[] = [
  { action: 'hold', label: 'Hold' },
  { action: 'left', label: 'Left' },
  { action: 'right', label: 'Right' },
  { action: 'rotate', label: 'Turn' },
  { action: 'soft', label: 'Down' },
  { action: 'hard', label: 'Drop' },
]

/** The one line of guidance under the title: what to do now, or why something just happened. */
function instruction(hud: Hud, touch: boolean, showEvent: boolean): string {
  if (hud.status === 'ready') {
    return touch
      ? 'Tap Start. Left and Right move, Turn rotates, Drop lands the piece.'
      : 'Press Space to start. A/D move, W rotate, Space drops.'
  }
  if (hud.status === 'paused') return touch ? 'Paused. Tap Resume to carry on.' : 'Paused. Press P to carry on.'
  if (hud.status === 'over') return ''
  if (showEvent) {
    const said = describeEvent(hud.event)
    if (said) return said
  }
  if (hud.lines === 0) return 'Fill a row from wall to wall to clear it.'
  const toGo = LINES_PER_LEVEL - (hud.lines % LINES_PER_LEVEL)
  const rows = toGo === 1 ? '1 more row' : `${toGo} more rows`
  return touch
    ? `${rows} to level ${hud.level + 1}. Hold saves a piece for later.`
    : `${rows} to level ${hud.level + 1}. C holds a piece, P pauses.`
}

export default function CloudfallPage() {
  const cell = useCellSize()
  const boardRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGame(1))
  const heldRef = useRef(new Map<string, { action: Action; nextAt: number }>())
  const flashRef = useRef<Flash | null>(null)
  const bestRef = useRef(0)
  const touchRef = useRef(false)
  const overAtRef = useRef(0)
  const trackerRef = useRef(createGameTracker(SLUG, (event, game, metadata) => trackGame(event, game, metadata)))

  const [hud, setHud] = useState<Hud>(() => hudOf(stateRef.current))
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [touch, setTouch] = useState(false)
  const [showEvent, setShowEvent] = useState(false)

  const commit = useCallback((next: GameState) => {
    const prev = stateRef.current
    if (next === prev) return
    stateRef.current = next
    if (next.eventId !== prev.eventId && next.event?.type === 'clear' && !prefersReducedMotion()) {
      flashRef.current = { rows: next.event.rows, startedAt: performance.now() }
    }
    trackerRef.current.update(
      { moveCount: next.moves, finished: next.status === 'over' },
      {
        start: () => ({ input: touchRef.current ? 'touch' : 'keyboard' }),
        end: () => ({
          score: next.score,
          lines: next.lines,
          level: next.level,
          pieces: next.pieces,
          reason: next.event?.type === 'over' ? next.event.reason : null,
        }),
      },
    )
    if (next.status === 'over' && prev.status !== 'over') {
      overAtRef.current = performance.now()
      const beat = next.score > bestRef.current
      setNewBest(beat && next.score > 0)
      if (beat) {
        bestRef.current = next.score
        setBest(next.score)
        writeBest(next.score)
      }
    }
    const h = hudOf(next)
    setHud((cur) => (sameHud(cur, h) ? cur : h))
  }, [])

  const newGame = useCallback(() => {
    heldRef.current.clear()
    setNewBest(false)
    commit(start(freshGame()))
  }, [commit])

  const press = useCallback(
    (action: Action, id: string) => {
      const s = stateRef.current
      if (s.status === 'ready') {
        commit(start(s))
        return
      }
      if (s.status !== 'playing') return
      commit(apply(s, action))
      const repeat = REPEAT_MS[action]
      if (repeat) heldRef.current.set(id, { action, nextAt: performance.now() + REPEAT_DELAY_MS })
    },
    [commit],
  )

  const release = useCallback((id: string) => {
    heldRef.current.delete(id)
  }, [])

  const pause = useCallback(() => {
    heldRef.current.clear()
    commit(togglePause(stateRef.current))
  }, [commit])

  // A fresh, random game and the saved best score, once the page is in the browser.
  useEffect(() => {
    stateRef.current = freshGame()
    setHud(hudOf(stateRef.current))
    bestRef.current = readBest()
    setBest(bestRef.current)
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    touchRef.current = coarse
    setTouch(coarse)
  }, [])

  // The event line shows for a few seconds after something happens, then the next goal returns.
  useEffect(() => {
    if (!hud.eventId) return
    setShowEvent(true)
    const t = window.setTimeout(() => setShowEvent(false), EVENT_SHOW_MS)
    return () => window.clearTimeout(t)
  }, [hud.eventId])

  // Size the well's canvas for the screen's pixel density.
  useEffect(() => {
    const canvas = boardRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(COLS * cell * dpr)
    canvas.height = Math.round(VISIBLE_ROWS * cell * dpr)
  }, [cell])

  // The game clock: held-key repeats, gravity, and a fresh drawing each frame.
  useEffect(() => {
    const canvas = boardRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(100, now - last)
      last = now
      let s = stateRef.current
      for (const held of heldRef.current.values()) {
        if (now >= held.nextAt) {
          s = apply(s, held.action)
          held.nextAt = now + (REPEAT_MS[held.action] ?? 50)
        }
      }
      commit(tick(s, dt))
      const scale = canvas.width / (COLS * cell)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      const flash = flashRef.current
      if (flash && now - flash.startedAt > FLASH_MS) flashRef.current = null
      drawBoard(ctx, stateRef.current, cell, flashRef.current, now)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [cell, commit])

  // Keyboard, and pausing when the tab is hidden.
  useEffect(() => {
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return
      const key = e.key.toLowerCase()
      const status = stateRef.current.status
      if (key === 'p' || key === 'escape') {
        if (status === 'playing' || status === 'paused') {
          e.preventDefault()
          pause()
        }
        return
      }
      // After a game, Space and Enter belong to the focused "Play again" button, but not
      // in the first moments: a player still hammering Space should see why the game ended.
      if (status === 'over') {
        if (performance.now() - overAtRef.current < OVER_GRACE_MS) e.preventDefault()
        return
      }
      if (key === 'enter' && status === 'ready') {
        e.preventDefault()
        press('hard', 'key:enter')
        return
      }
      const action = KEYS[key]
      if (!action) return
      e.preventDefault()
      if (e.repeat) return
      touchRef.current = false
      press(action, `key:${key}`)
    }
    const onKeyUp = (e: KeyboardEvent) => release(`key:${e.key.toLowerCase()}`)
    const onBlur = () => heldRef.current.clear()
    const onVisibility = () => {
      heldRef.current.clear()
      if (document.hidden && stateRef.current.status === 'playing') pause()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [press, release, pause])

  const onPadDown = (action: Action) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault() // keep focus off the button, and stop the long-press menu
    if (e.pointerType === 'touch' && !touchRef.current) {
      touchRef.current = true
      setTouch(true)
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    press(action, `pad:${action}`)
  }
  const onPadUp = (action: Action) => () => release(`pad:${action}`)

  const say = instruction(hud, touch, showEvent)
  const overReason = hud.status === 'over' ? describeEvent(hud.event) : null
  const canPause = hud.status === 'playing' || hud.status === 'paused'
  const boardW = COLS * cell
  const boardH = VISIBLE_ROWS * cell

  const stats = (
    <dl className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1 lg:gap-3 lg:text-left">
      {[
        ['Score', hud.score],
        ['Lines', hud.lines],
        ['Level', hud.level],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-600">{label}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums text-ink-950 lg:text-2xl">{fmt(value as number)}</dd>
        </div>
      ))}
    </dl>
  )

  const pauseButton = canPause && (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur()
        pause()
      }}
      className="min-h-[44px] min-w-[44px] rounded-xl border-2 bg-white px-3 text-sm font-bold text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
      style={{ borderColor: OUTLINE }}
      aria-label={hud.status === 'paused' ? 'Resume' : 'Pause'}
    >
      {hud.status === 'paused' ? 'Resume' : 'Pause'}
    </button>
  )

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-x-hidden font-sans text-ink-950">
      <Head>
        <title>Cloudfall | Brooks Roley</title>
        <meta
          name="description"
          content="Cloudfall, a falling-block puzzle by Brooks Roley: seven candy-coloured shapes drop from the clouds, and every full row clears. Plays with a keyboard or on a phone."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Cloudfall — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="A falling-block puzzle under a bright sky. Fill a row from wall to wall to clear it."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('cloudfall')} key="og:url" />
      </Head>

      <SkyBackdrop />

      <div className={`relative mx-auto max-w-5xl px-4 pb-10 pt-2 lg:pt-6 ${styles.layout}`}>
        <header className={`${styles.title} text-center lg:text-left`}>
          <p className="hidden font-mono text-xs font-semibold uppercase tracking-widest text-ink-700 lg:block">
            A falling-block puzzle
          </p>
          <h1
            className="text-2xl font-black tracking-tight text-white lg:text-5xl"
            style={{ WebkitTextStroke: `1.5px ${OUTLINE}`, textShadow: `0 3px 0 ${OUTLINE}` }}
          >
            Cloudfall
          </h1>
        </header>

        <Card className={`${styles.note} max-w-[65ch] p-4`}>
          <p className="text-sm leading-relaxed text-ink-800">
            Fill a row from wall to wall and it clears. I made Cloudfall to practise a game loop whose rules are
            tested on their own, apart from the drawing. Your best score stays in this browser.
          </p>
        </Card>

        {/* Phones: hold, score and the next piece in one strip above the well. */}
        <Card className={`${styles.bar} flex items-center justify-between gap-2 px-2 py-1`}>
          <div className="flex flex-col items-center">
            <Label>Hold</Label>
            <Preview kind={hud.hold} size={[44, 26]} dimmed={!hud.canHold} />
          </div>
          <div className="flex-1">{stats}</div>
          <div className="flex flex-col items-center">
            <Label>Next</Label>
            <Preview kind={hud.next[0] ?? null} size={[44, 26]} />
          </div>
          {pauseButton}
        </Card>

        <p
          className={`${styles.say} flex min-h-[2.5rem] items-center justify-center text-center text-sm font-semibold text-ink-950 lg:text-base`}
          role="status"
          aria-live="polite"
        >
          {say && <span className="rounded-2xl bg-white/90 px-3 py-1">{say}</span>}
        </p>

        <div className={`${styles.board} relative`} style={{ width: boardW + 6, height: boardH + 6 }}>
          <canvas
            ref={boardRef}
            role="img"
            aria-label={`Cloudfall well. Score ${hud.score}, ${hud.lines} lines, level ${hud.level}.`}
            className="block rounded-xl border-[3px]"
            style={{ width: boardW + 6, height: boardH + 6, borderColor: OUTLINE, touchAction: 'none' }}
          />
          {hud.status !== 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {hud.status === 'ready' && <CandyButton onClick={() => press('hard', 'start')}>Start</CandyButton>}
              {hud.status === 'paused' && <CandyButton onClick={pause}>Resume</CandyButton>}
              {hud.status === 'over' && (
                <Card className="w-full max-w-[17rem] p-4 text-center">
                  <p className="text-lg font-black text-ink-950">Game over</p>
                  {overReason && <p className="mt-1 text-sm leading-snug text-ink-800">{overReason}</p>}
                  <p className="mt-3 font-mono text-sm text-ink-800">
                    {fmt(hud.score)} points · {hud.lines} lines · level {hud.level}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-950">
                    {newBest ? 'A new best score.' : `Best: ${fmt(best)}`}
                  </p>
                  <div className="mt-4">
                    <CandyButton onClick={newGame} autoFocus>
                      Play again
                    </CandyButton>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Touch controls: under the thumbs on phones, and on any touch screen. */}
        <div className={`${styles.pad} ${touch ? '' : 'lg:hidden'} grid grid-cols-6 gap-1.5 lg:grid-cols-3`}>
          {PAD.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              aria-label={label}
              onPointerDown={onPadDown(action)}
              onPointerUp={onPadUp(action)}
              onPointerCancel={onPadUp(action)}
              onLostPointerCapture={onPadUp(action)}
              onContextMenu={(e) => e.preventDefault()}
              className="flex min-h-[56px] select-none flex-col items-center justify-center rounded-xl border-2 bg-white/95 text-xs font-bold text-ink-950 active:translate-y-0.5"
              style={{ borderColor: OUTLINE, boxShadow: `0 3px 0 ${OUTLINE}`, touchAction: 'none' }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[action]}
              </svg>
              {label}
            </button>
          ))}
        </div>

        {/* Wide screens: score and hold on the left, the queue on the right. */}
        <div className={`${styles.side} flex-col gap-3`}>
          <Card className="p-4">{stats}</Card>
          <Card className="flex items-center justify-between p-3">
            <Label>Hold</Label>
            <Preview kind={hud.hold} size={[96, 52]} dimmed={!hud.canHold} />
          </Card>
          <Card className="flex items-center justify-between p-3">
            <Label>Best</Label>
            <span className="font-mono text-lg font-bold tabular-nums">{fmt(best)}</span>
          </Card>
        </div>

        <div className={`${styles.next} flex-col gap-3`}>
          <Card className="flex flex-col items-center gap-1 p-3">
            <Label>Next</Label>
            {Array.from({ length: PREVIEW_COUNT }, (_, i) => (
              <Preview key={i} kind={hud.next[i] ?? null} size={[120, 60]} dimmed={i > 0} />
            ))}
          </Card>
          {pauseButton}
        </div>
      </div>
    </main>
  )
}
