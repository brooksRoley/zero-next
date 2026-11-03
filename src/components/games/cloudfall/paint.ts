/**
 * Canvas drawing for Cloudfall: the candy blocks, the well, and the sky behind
 * it. Nothing here knows the rules; it is handed a GameState and paints it.
 */
import {
  COLS,
  HIDDEN_ROWS,
  VISIBLE_ROWS,
  ghostY,
  kindOf,
  pieceCells,
  previewCells,
  type GameState,
  type PieceKind,
} from 'src/lib/games/cloudfall/engine'

export const OUTLINE = '#2a1838'

/** One candy colour per piece. */
export const PIECE_COLORS: Record<PieceKind, string> = {
  I: '#3fd6f5', // cyan
  O: '#ffd23f', // yellow
  T: '#e04fd0', // magenta
  S: '#5fd35a', // green
  Z: '#ff6fa8', // pink
  J: '#8f6bff', // violet
  L: '#ff9a3c', // orange
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `rgb(${r},${g},${b})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A glossy candy block: dark outline, a top-lit body, and a soft highlight. */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  const r = size * 0.24
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, r)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  const inset = Math.max(1.5, size * 0.08)
  const body = ctx.createLinearGradient(0, y, 0, y + size)
  body.addColorStop(0, shade(color, 0.35))
  body.addColorStop(0.55, color)
  body.addColorStop(1, shade(color, -0.22))
  roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, r * 0.7)
  ctx.fillStyle = body
  ctx.fill()
  // Highlight: a soft oval near the top-left, and a small bright dot beside it.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(x + size * 0.38, y + size * 0.28, size * 0.2, size * 0.09, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(x + size * 0.68, y + size * 0.24, size * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export type Flash = { rows: number[]; startedAt: number }
export const FLASH_MS = 320

/** The well: a pale glass panel, faint grid, settled blocks, the ghost, and the falling piece. */
export function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, cell: number, flash: Flash | null, now: number) {
  const w = COLS * cell
  const h = VISIBLE_ROWS * cell
  ctx.clearRect(0, 0, w, h)
  const glass = ctx.createLinearGradient(0, 0, 0, h)
  glass.addColorStop(0, 'rgba(255,255,255,0.95)')
  glass.addColorStop(1, 'rgba(234,248,255,0.97)')
  ctx.fillStyle = glass
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(42,24,56,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * cell + 0.5, 0)
    ctx.lineTo(x * cell + 0.5, h)
  }
  for (let y = 1; y < VISIBLE_ROWS; y++) {
    ctx.moveTo(0, y * cell + 0.5)
    ctx.lineTo(w, y * cell + 0.5)
  }
  ctx.stroke()

  const py = (row: number) => (row - HIDDEN_ROWS) * cell
  state.board.forEach((row, y) => {
    if (y < HIDDEN_ROWS) return
    row.forEach((c, x) => {
      const kind = kindOf(c)
      if (kind) drawBlock(ctx, x * cell, py(y), cell, PIECE_COLORS[kind])
    })
  })

  const p = state.active
  if (p && (state.status === 'playing' || state.status === 'paused')) {
    const gy = ghostY(state)
    if (gy !== null && gy !== p.y) {
      ctx.save()
      ctx.strokeStyle = PIECE_COLORS[p.kind]
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      for (const [x, y] of pieceCells({ ...p, y: gy })) {
        if (y < HIDDEN_ROWS) continue
        roundRect(ctx, x * cell + 3, py(y) + 3, cell - 6, cell - 6, cell * 0.2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
    }
    for (const [x, y] of pieceCells(p)) {
      if (y >= HIDDEN_ROWS) drawBlock(ctx, x * cell, py(y), cell, PIECE_COLORS[p.kind])
    }
  }

  if (flash) {
    const t = (now - flash.startedAt) / FLASH_MS
    if (t < 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - t)})`
      for (const row of flash.rows) {
        if (row >= HIDDEN_ROWS) ctx.fillRect(0, py(row), w, cell)
      }
    }
  }

  if (state.status === 'paused' || state.status === 'over' || state.status === 'ready') {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(0, 0, w, h)
  }
}

/** A small piece drawn centred in a box, for the next and hold slots. */
export function drawPreview(ctx: CanvasRenderingContext2D, kind: PieceKind | null, width: number, height: number, dimmed: boolean) {
  ctx.clearRect(0, 0, width, height)
  if (!kind) return
  const cells = previewCells(kind)
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const cw = Math.max(...xs) - Math.min(...xs) + 1
  const ch = Math.max(...ys) - Math.min(...ys) + 1
  const cell = Math.floor(Math.min(width / 4.4, height / 2.6))
  const ox = (width - cw * cell) / 2 - Math.min(...xs) * cell
  const oy = (height - ch * cell) / 2 - Math.min(...ys) * cell
  for (const [x, y] of cells) drawBlock(ctx, ox + x * cell, oy + y * cell, cell, PIECE_COLORS[kind], dimmed ? 0.55 : 1)
}

// ── The sky ──

type Cloud = { x: number; y: number; scale: number; speed: number }

const CLOUDS: Cloud[] = [
  { x: 0.08, y: 0.12, scale: 1.1, speed: 9 },
  { x: 0.42, y: 0.07, scale: 0.8, speed: 6 },
  { x: 0.7, y: 0.18, scale: 1.3, speed: 11 },
  { x: 0.25, y: 0.32, scale: 0.7, speed: 5 },
  { x: 0.88, y: 0.38, scale: 0.9, speed: 7 },
]

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const puffs: [number, number, number][] = [
    [-46, 8, 26], [-18, -10, 34], [18, -16, 38], [50, 0, 28], [10, 14, 30], [-30, 16, 22], [36, 16, 24],
  ]
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  // Outline pass, then a soft blue underside, then the white body.
  ctx.fillStyle = 'rgba(42,24,56,0.85)'
  for (const [x, y, r] of puffs) {
    ctx.beginPath()
    ctx.arc(x, y, r + 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#cfeefc'
  for (const [x, y, r] of puffs) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffffff'
  for (const [x, y, r] of puffs) {
    ctx.beginPath()
    ctx.arc(x - r * 0.12, y - r * 0.18, r * 0.86, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// Low, wide rolling ridges with contour bands (2026-11-03). The first draft used
// tall round-topped "pill" hills with dots and stripes, which read as one game
// franchise's scenery; these are Cloudfall's own: a continuous ridgeline per layer,
// lighter terraces following the slope, and a single outline along the crest.
type HillLayer = {
  base: number // fraction of height where the ridge's average crest sits
  amp: number // crest swing, as a fraction of height
  wave: number // px per ridge cycle
  color: string
  band: string // contour band colour
  speed: number // px per second
  outline: boolean
}

const HILLS: HillLayer[] = [
  { base: 0.72, amp: 0.06, wave: 900, color: '#b7ecc4', band: 'rgba(255,255,255,0.28)', speed: 4, outline: false },
  { base: 0.8, amp: 0.05, wave: 640, color: '#5ccb79', band: 'rgba(255,255,255,0.18)', speed: 9, outline: true },
  { base: 0.89, amp: 0.035, wave: 480, color: '#33a45a', band: 'rgba(255,255,255,0.14)', speed: 16, outline: true },
]

/** Crest height at x: two slow waves, so the ridge never repeats too obviously. */
function crest(layer: HillLayer, x: number, h: number): number {
  const a = Math.sin((x / layer.wave) * Math.PI * 2)
  const b = Math.sin((x / (layer.wave * 0.43)) * Math.PI * 2 + 1.3)
  return h * (layer.base - layer.amp * (0.65 * a + 0.35 * b))
}

function ridgePath(ctx: CanvasRenderingContext2D, layer: HillLayer, w: number, h: number, shift: number, lift = 0) {
  ctx.beginPath()
  ctx.moveTo(0, h + 4)
  for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, crest(layer, x + shift, h) + lift)
  ctx.lineTo(w + 8, h + 4)
  ctx.closePath()
}

function drawHillLayer(ctx: CanvasRenderingContext2D, layer: HillLayer, w: number, h: number, t: number) {
  const shift = t * layer.speed
  ridgePath(ctx, layer, w, h, shift)
  ctx.fillStyle = layer.color
  ctx.fill()
  // Contour terraces: the crest line repeated a little lower each time.
  ctx.save()
  ridgePath(ctx, layer, w, h, shift)
  ctx.clip()
  ctx.strokeStyle = layer.band
  ctx.lineWidth = 3
  for (let lift = 18; lift < h * 0.4; lift += 22) {
    ctx.beginPath()
    for (let x = 0; x <= w + 8; x += 8) {
      const y = crest(layer, x + shift, h) + lift
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
  if (layer.outline) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = 0; x <= w + 8; x += 8) {
      const y = crest(layer, x + shift, h)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

/** The whole backdrop at time `t` seconds. Pass a fixed t for a still frame. */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#4cc3f5')
  sky.addColorStop(0.55, '#a9e9ff')
  sky.addColorStop(1, '#fff3cf')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const span = w + 260
  for (const c of CLOUDS) {
    const x = ((c.x * span + t * c.speed) % span) - 130
    drawCloud(ctx, x, c.y * h, c.scale * Math.min(1, Math.max(0.6, w / 1100)))
  }
  for (const layer of HILLS) drawHillLayer(ctx, layer, w, h, t)
}
