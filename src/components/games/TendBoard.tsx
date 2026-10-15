import { useState, type KeyboardEvent } from 'react'
import {
  canPlace,
  isDormant,
  stageOf,
  STAGE_NAMES,
  tendedDays,
  translate,
  type Bed,
  type GardenState,
} from 'src/lib/games/tend/engine'
import { PLANTS, type Cell, type PlantKind } from 'src/lib/games/tend/plants'
import TendPets from './TendPets'

const C = 48 // one grid cell, in SVG units
const SOIL = '#16241c'
const GROUND = '#04120c' // forest-950, the page behind the board
const SLEEP = '#55605a'
const INVALID = '#d9655b'
const INK = '#0b1a12'
const STAGE_OPACITY = [0.3, 0.55, 0.8, 1]

type Props = {
  garden: GardenState
  today: number
  /** The seed being placed, in its current orientation, or null when not placing. */
  placing: { kind: PlantKind; shape: Cell[] } | null
  onPlace: (anchor: Cell) => void
  onRotate: () => void
  onCancel: () => void
}

/** The hovered cell is the shape's first cell, so the cursor always sits on the bed. */
function anchorFor(cell: Cell, shape: Cell[]): Cell {
  return [cell[0] - shape[0][0], cell[1] - shape[0][1]]
}

function Glyph({ kind, stage, cx, cy }: { kind: PlantKind; stage: number; cx: number; cy: number }) {
  const r = [3, 6, 9, 12][stage]
  if (stage === 0) return <circle cx={cx} cy={cy} r={r} fill={INK} opacity={0.7} />
  switch (kind) {
    case 'oak':
      return <circle cx={cx} cy={cy} r={r} fill={INK} opacity={0.75} />
    case 'vine':
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} transform={`rotate(45 ${cx} ${cy})`} fill={INK} opacity={0.75} />
    case 'moonflower':
      return <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={3} opacity={0.75} />
    case 'fern':
      return <path d={`M${cx} ${cy - r}L${cx + r} ${cy + r * 0.8}L${cx - r} ${cy + r * 0.8}Z`} fill={INK} opacity={0.75} />
    case 'sunflower':
      return (
        <g opacity={0.8}>
          <circle cx={cx} cy={cy} r={stage === 3 ? 6 : r} fill={INK} />
          {stage === 3 &&
            [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1={cx}
                y1={cy - 9}
                x2={cx}
                y2={cy - 14}
                stroke={INK}
                strokeWidth={3}
                strokeLinecap="round"
                transform={`rotate(${deg} ${cx} ${cy})`}
              />
            ))}
        </g>
      )
  }
}

function BedShape({ bed, garden, today, inert }: { bed: Bed; garden: GardenState; today: number; inert: boolean }) {
  const sleeping = isDormant(garden, bed.id, today)
  const stage = stageOf(garden, bed, today)
  const fill = sleeping ? SLEEP : PLANTS[bed.kind].color
  const opacity = sleeping ? 0.6 : STAGE_OPACITY[stage]
  const has = (x: number, y: number) => bed.cells.some(([cx, cy]) => cx === x && cy === y)
  const cx = (bed.cells.reduce((sum, [x]) => sum + x, 0) / bed.cells.length) * C + C / 2
  const cy = (bed.cells.reduce((sum, [, y]) => sum + y, 0) / bed.cells.length) * C + C / 2
  const silhouette = bed.cells.map(([x, y]) => (
    <g key={`${x},${y}`}>
      <rect x={x * C + 3} y={y * C + 3} width={C - 6} height={C - 6} rx={10} />
      {has(x + 1, y) && <rect x={x * C + C - 12} y={y * C + 3} width={24} height={C - 6} />}
      {has(x, y + 1) && <rect x={x * C + 3} y={y * C + C - 12} width={C - 6} height={24} />}
      {has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1) && (
        <rect x={x * C + C - 12} y={y * C + C - 12} width={24} height={24} />
      )}
    </g>
  ))
  const label = `${PLANTS[bed.kind].name}, ${sleeping ? 'sleeping after a drought' : STAGE_NAMES[stage]}, ${tendedDays(garden, bed, today)} tended days`
  // While placing, beds let the pointer through to the soil so the preview follows the cursor everywhere.
  return (
    <g pointerEvents={inert ? 'none' : undefined}>
      <title>{label}</title>
      {/* A solid base hides the soil grid, then one group opacity for the whole bed so joins don't show as seams. */}
      <g fill={GROUND}>{silhouette}</g>
      <g fill={fill} opacity={opacity}>
        {silhouette}
      </g>
      {!sleeping && <Glyph kind={bed.kind} stage={stage} cx={cx} cy={cy} />}
    </g>
  )
}

export default function TendBoard({ garden, today, placing, onPlace, onRotate, onCancel }: Props) {
  const [cursor, setCursor] = useState<Cell | null>(null)
  const [touchMode, setTouchMode] = useState(false)
  const size = garden.size

  const ghost = placing && cursor ? translate(placing.shape, anchorFor(cursor, placing.shape)) : null
  const fits = ghost ? canPlace(garden, ghost) : false

  const tryPlace = (cell: Cell) => {
    if (!placing) return
    const anchor = anchorFor(cell, placing.shape)
    if (canPlace(garden, translate(placing.shape, anchor))) onPlace(anchor)
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
      : `${PLANTS[placing.kind].name} at column ${cursor[0] + 1}, row ${cursor[1] + 1}: ${fits ? 'fits' : 'does not fit'}.`

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
              fill={SOIL}
              className={placing ? 'cursor-pointer' : undefined}
              onPointerEnter={() => !touchMode && setCursor(cell)}
              onClick={() => handleCellClick(cell)}
            />
          )
        })}
        {garden.beds.map((bed) => (
          <BedShape key={bed.id} bed={bed} garden={garden} today={today} inert={placing !== null} />
        ))}
        <TendPets garden={garden} inert={placing !== null} />
        {placing && ghost && (
          <g pointerEvents="none">
            {ghost
              .filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size)
              .map(([x, y]) => (
                <rect
                  key={`${x},${y}`}
                  x={x * C + 5}
                  y={y * C + 5}
                  width={C - 10}
                  height={C - 10}
                  rx={9}
                  fill={fits ? PLANTS[placing.kind].color : INVALID}
                  fillOpacity={0.25}
                  stroke={fits ? PLANTS[placing.kind].color : INVALID}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
              ))}
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
