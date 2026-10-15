import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  isDormant,
  misfit,
  placementEffect,
  stageOf,
  STAGE_NAMES,
  tendedDays,
  translate,
  type Bed,
  type GardenState,
  type Misfit,
  type PlacementEffect,
} from 'src/lib/games/tend/engine'
import { PLANTS, type Cell, type PlantKind } from 'src/lib/games/tend/plants'
import styles from './TendBoard.module.css'
import TendPets from './TendPets'
import TendPlant, { GOLD } from './TendPlants'
import { PHASE_TINT, type Phase } from 'src/lib/games/tend/daylight'

const C = 48 // one grid cell, in SVG units
const SOIL = '#16241c'
/** Open soil during a drought: dry and straw-coloured, not grey. */
const PARCHED = '#2e2a1b'
const TILLED = '#3a2b1f'
const INVALID = '#d9655b'
const HELP_RING = '#d8efc9'
const SHADE_RING = '#f0b44c'

const STRAW_RIM = '#a8915a'

type Props = {
  garden: GardenState
  today: number
  /** The seed being placed, in its current orientation, or null when not placing. */
  placing: { kind: PlantKind; shape: Cell[] } | null
  onPlace: (anchor: Cell) => void
  onRotate: () => void
  onCancel: () => void
  /** Called when the player tries a spot that doesn't fit, with the reason. */
  onRefuse?: (why: Misfit) => void
  /** The bed planted a moment ago, which lands with a pop and a puff of soil. */
  fresh?: string | null
  /** Beds that grew at the last check-in, which pop one after another; `n` replays it. */
  growth?: { grew: string[]; bloomed: string[]; n: number } | null
  /** A cell that just got planted, so the nearest pet turns to look; `n` makes each one count. */
  attention?: { cell: Cell; n: number } | null
  /** The real time of day: tints the board, opens the datura, brings out fireflies, puts the pets to sleep. */
  phase?: Phase
  /** A drought is on: open soil looks dry. */
  parched?: boolean
}

/** Where the fireflies drift, as fractions of the board, with their own timing. */
const FIREFLIES = [
  [0.18, 0.3, 0],
  [0.42, 0.62, 1.3],
  [0.7, 0.22, 2.1],
  [0.86, 0.7, 0.6],
  [0.3, 0.85, 1.8],
  [0.58, 0.44, 2.7],
] as const

/** "the coast live oak", keeping "California" capitalised. */
function plantName(kind: PlantKind): string {
  const name = PLANTS[kind].name
  return `the ${name.startsWith('California') ? name : name[0].toLowerCase() + name.slice(1)}`
}

export function misfitText(why: Misfit): string {
  return why.reason === 'edge' ? 'off the edge' : `overlaps ${plantName(why.bed.kind)}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The effect of a spot in words, for the screen reader: what the bed would do for its neighbours, and for itself. */
export function effectText(kind: PlantKind, effect: PlacementEffect): string {
  const parts: string[] = []
  const n = effect.helps.length
  if (n && kind === 'oak') parts.push(`speeds up ${plural(n, 'vine', 'vines')}`)
  if (n && kind === 'fern') parts.push(`keeps ${plural(n, 'neighbour', 'neighbours')} safe from drought`)
  if (n && kind === 'moonflower') parts.push(`helps ${plural(n, 'neighbour', 'neighbours')} recover from drought sooner`)
  if (effect.shades.length) parts.push(`shades ${plural(effect.shades.length, 'poppy', 'poppies')} out of bloom`)
  if (effect.self === 'helped') parts.push('grows faster beside the oak')
  if (effect.self === 'shaded') parts.push("won't bloom under the oak")
  return parts.join('; ')
}

const PUFF = [0, 60, 120, 180, 240, 300].map((deg) => {
  const rad = (deg * Math.PI) / 180
  return { dx: Math.cos(rad) * 20, dy: Math.sin(rad) * 14 - 6 }
})

const PETAL: Record<PlantKind, string> = {
  oak: '#e9dcc0',
  vine: '#d9cdea',
  moonflower: '#f3f1ea',
  sunflower: GOLD,
  fern: '#d8efc9',
}

/** The hovered cell is the shape's first cell, so the cursor always sits on the bed. */
function anchorFor(cell: Cell, shape: Cell[]): Cell {
  return [cell[0] - shape[0][0], cell[1] - shape[0][1]]
}

const centre = (cells: readonly Cell[]) => ({
  cx: (cells.reduce((sum, [x]) => sum + x, 0) / cells.length) * C + C / 2,
  cy: (cells.reduce((sum, [, y]) => sum + y, 0) / cells.length) * C + C / 2,
})

/**
 * A bed's outline as one shape: a rounded square per cell, bridged to its
 * neighbours so joins don't show as seams. `pad` grows it (positive) or
 * shrinks it (negative) evenly, for rims and rings.
 */
function Silhouette({ cells, pad = 0 }: { cells: readonly Cell[]; pad?: number }) {
  const has = (x: number, y: number) => cells.some(([cx, cy]) => cx === x && cy === y)
  const inset = 3 - pad
  const side = C - inset * 2
  return (
    <>
      {cells.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <rect x={x * C + inset} y={y * C + inset} width={side} height={side} rx={10 + pad} />
          {has(x + 1, y) && <rect x={x * C + C - 12} y={y * C + inset} width={24} height={side} />}
          {has(x, y + 1) && <rect x={x * C + inset} y={y * C + C - 12} width={side} height={24} />}
          {has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1) && (
            <rect x={x * C + C - 12} y={y * C + C - 12} width={24} height={24} />
          )}
        </g>
      ))}
    </>
  )
}

function Burst({ cx, cy, color, className, count = 6, delay = 0 }: { cx: number; cy: number; color: string; className: string; count?: number; delay?: number }) {
  return (
    <g pointerEvents="none" aria-hidden>
      {PUFF.slice(0, count).map(({ dx, dy }, i) => (
        <circle
          key={i}
          className={className}
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${delay + i * 12}ms` } as CSSProperties}
          cx={cx}
          cy={cy}
          r={3 + (i % 2)}
          fill={color}
        />
      ))}
    </g>
  )
}

function BedShape({
  bed,
  garden,
  today,
  inert,
  fresh,
  grewAt,
  bloomed,
}: {
  bed: Bed
  garden: GardenState
  today: number
  inert: boolean
  fresh: boolean
  /** Stagger index when this bed grew at the last check-in, else null. */
  grewAt: number | null
  bloomed: boolean
}) {
  const sleeping = isDormant(garden, bed.id, today)
  const stage = stageOf(garden, bed, today)
  const { cx, cy } = centre(bed.cells)
  const label = `${PLANTS[bed.kind].name}, ${sleeping ? 'sleeping after a drought' : STAGE_NAMES[stage]}, ${tendedDays(garden, bed, today)} tended days`
  const delay = grewAt === null ? 0 : grewAt * 110
  const order = Number(bed.id.replace(/\D/g, '')) || 0
  // While placing, beds let the pointer through to the soil so the preview follows the cursor everywhere.
  return (
    <g pointerEvents={inert ? 'none' : undefined} className={fresh ? styles.planted : undefined}>
      <title>{label}</title>
      <g fill={sleeping ? STRAW_RIM : PLANTS[bed.kind].color}>
        <Silhouette cells={bed.cells} />
      </g>
      <g fill={sleeping ? '#4a3a26' : TILLED}>
        <Silhouette cells={bed.cells} pad={-2} />
      </g>
      <g
        className={grewAt !== null ? styles.grew : undefined}
        style={grewAt !== null ? { animationDelay: `${delay}ms` } : undefined}
      >
        {bed.cells.map(([x, y], i) => (
          <g key={`${x},${y}`} transform={`translate(${x * C} ${y * C})`}>
            <TendPlant kind={bed.kind} stage={stage} dry={sleeping} sway={order * 3 + i} />
          </g>
        ))}
      </g>
      {fresh && <Burst cx={cx} cy={cy + 10} color="#8a6f4e" className={styles.puff} />}
      {bloomed && <Burst cx={cx} cy={cy - 6} color={PETAL[bed.kind]} className={styles.petal} delay={delay + 120} />}
    </g>
  )
}

export default function TendBoard({
  garden,
  today,
  placing,
  onPlace,
  onRotate,
  onCancel,
  onRefuse,
  fresh = null,
  growth = null,
  attention = null,
  phase = 'day',
  parched = false,
}: Props) {
  const [cursor, setCursor] = useState<Cell | null>(null)
  const [touchMode, setTouchMode] = useState(false)
  // The last refused try. Its count remounts the preview, so each try shakes once, and only on that cell.
  const [refused, setRefused] = useState<{ n: number; cell: Cell } | null>(null)
  const size = garden.size

  const ghost = placing && cursor ? translate(placing.shape, anchorFor(cursor, placing.shape)) : null
  const why = ghost ? misfit(garden, ghost) : null
  const fits = !!ghost && !why
  const effect = placing && ghost && fits ? placementEffect(garden, placing.kind, ghost) : null

  const tryPlace = (cell: Cell) => {
    if (!placing) return
    const anchor = anchorFor(cell, placing.shape)
    const problem = misfit(garden, translate(placing.shape, anchor))
    if (!problem) {
      onPlace(anchor)
      return
    }
    setCursor(cell)
    setRefused((prev) => ({ n: (prev?.n ?? 0) + 1, cell }))
    onRefuse?.(problem)
  }

  const handleCellClick = (cell: Cell) => {
    // Touch has no hover: the first tap previews, a second tap on the same cell plants.
    if (touchMode && (!cursor || cursor[0] !== cell[0] || cursor[1] !== cell[1])) {
      setCursor(cell)
      return
    }
    tryPlace(cell)
  }

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!placing) return
    const [x, y] = cursor ?? [0, 0]
    const move: Record<string, Cell> = {
      ArrowLeft: [Math.max(0, x - 1), y],
      ArrowRight: [Math.min(size - 1, x + 1), y],
      ArrowUp: [x, Math.max(0, y - 1)],
      ArrowDown: [x, Math.min(size - 1, y + 1)],
    }
    if (move[e.key]) {
      e.preventDefault()
      setCursor(move[e.key])
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      onRotate()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tryPlace(cursor ?? [0, 0])
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const status = !placing
    ? 'No seed selected.'
    : !cursor
      ? `Placing a ${PLANTS[placing.kind].name}. Use the arrow keys or point at a spot.`
      : `${PLANTS[placing.kind].name} at column ${cursor[0] + 1}, row ${cursor[1] + 1}: ${
          fits
            ? ['fits', effect && effectText(placing.kind, effect)].filter(Boolean).join(', ')
            : `doesn't fit, ${why ? misfitText(why) : 'no room'}`
        }.`

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Garden. When a seed is selected: arrow keys move, R rotates, Enter plants, Escape cancels."
      onKeyDown={handleKey}
      onPointerDown={(e) => setTouchMode(e.pointerType === 'touch')}
      className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <svg
        viewBox={`0 0 ${size * C} ${size * C}`}
        className="block h-auto w-full select-none"
        onPointerLeave={() => !touchMode && setCursor(null)}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const cell: Cell = [i % size, Math.floor(i / size)]
          return (
            <rect
              key={i}
              x={cell[0] * C + 3}
              y={cell[1] * C + 3}
              width={C - 6}
              height={C - 6}
              rx={10}
              fill={parched ? PARCHED : SOIL}
              className={placing ? 'cursor-pointer' : undefined}
              onPointerEnter={() => !touchMode && setCursor(cell)}
              onClick={() => handleCellClick(cell)}
            />
          )
        })}
        {effect && (
          <g pointerEvents="none" aria-hidden className={styles.ring}>
            {effect.helps.map((b) => (
              <g key={b.id} fill={HELP_RING}>
                <Silhouette cells={b.cells} pad={3} />
              </g>
            ))}
            {effect.shades.map((b) => (
              <g key={b.id} fill={SHADE_RING}>
                <Silhouette cells={b.cells} pad={3} />
              </g>
            ))}
          </g>
        )}
        {garden.beds.map((bed) => {
          const grewAt = growth ? growth.grew.indexOf(bed.id) : -1
          return (
            <BedShape
              key={growth && grewAt >= 0 ? `${bed.id}-${growth.n}` : bed.id}
              bed={bed}
              garden={garden}
              today={today}
              inert={placing !== null}
              fresh={bed.id === fresh}
              grewAt={grewAt >= 0 ? grewAt : null}
              bloomed={!!growth && growth.bloomed.includes(bed.id)}
            />
          )
        })}
        <TendPets garden={garden} inert={placing !== null} attention={attention} asleep={phase === 'night'} />
        {PHASE_TINT[phase].opacity > 0 && (
          <rect
            x={0}
            y={0}
            width={size * C}
            height={size * C}
            fill={PHASE_TINT[phase].color}
            opacity={PHASE_TINT[phase].opacity}
            pointerEvents="none"
          />
        )}
        {phase === 'night' && (
          <g pointerEvents="none" aria-hidden>
            <defs>
              <radialGradient id="datura-glow">
                <stop offset="0" stopColor="#f3f1ea" stopOpacity={0.55} />
                <stop offset="1" stopColor="#b9a8e6" stopOpacity={0} />
              </radialGradient>
            </defs>
            {/* Datura opens near full dark: its blooming beds glow through the night tint. */}
            {garden.beds
              .filter((b) => b.kind === 'moonflower' && !isDormant(garden, b.id, today) && stageOf(garden, b, today) === 3)
              .flatMap((b) => b.cells)
              .map(([x, y]) => (
                <g key={`${x},${y}`}>
                  <circle className={styles.glow} cx={x * C + C / 2} cy={y * C + 20} r={22} fill="url(#datura-glow)" />
                  <g transform={`translate(${x * C} ${y * C})`}>
                    <TendPlant kind="moonflower" stage={3} />
                  </g>
                </g>
              ))}
            {FIREFLIES.map(([fx, fy, delay], i) => (
              <circle
                key={i}
                className={styles.firefly}
                style={{ animationDelay: `${-delay}s` }}
                cx={fx * size * C}
                cy={fy * size * C}
                r={2.2}
                fill="#e9f59a"
              />
            ))}
          </g>
        )}
        {placing && ghost && (
          <g
            key={refused?.n ?? 0}
            pointerEvents="none"
            className={refused && cursor && refused.cell[0] === cursor[0] && refused.cell[1] === cursor[1] ? styles.refused : undefined}
          >
            {ghost
              .filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size)
              .map(([x, y]) => {
                const tone = !fits ? INVALID : effect?.self === 'shaded' ? SHADE_RING : PLANTS[placing.kind].color
                return (
                  <g key={`${x},${y}`}>
                    <rect
                      x={x * C + 5}
                      y={y * C + 5}
                      width={C - 10}
                      height={C - 10}
                      rx={9}
                      fill={tone}
                      fillOpacity={0.22}
                      stroke={tone}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                    />
                    {fits && (
                      <g transform={`translate(${x * C} ${y * C})`} opacity={0.7}>
                        <TendPlant kind={placing.kind} stage={1} />
                      </g>
                    )}
                  </g>
                )
              })}
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
