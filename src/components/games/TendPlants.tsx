import type { ReactElement } from 'react'
import type { PlantKind } from 'src/lib/games/tend/plants'
import styles from './TendPlants.module.css'

/**
 * The garden's plants, hand-drawn in the same soft, outlined picture-book
 * style as the pets and the Watershed. Each drawing fills one 48×48 cell,
 * standing on a ground line at y = 40, and grows through four stages:
 * seed, sprout, grown, in bloom. A bed sleeping after a drought turns straw
 * coloured and droops, instead of going grey (grey reads as "disabled").
 */

const LINE = '#1d2a24'
/** Sunlight gold: the garden's one bright accent (poppies, and the sun in the Watershed). */
export const GOLD = '#ffd166'

type Palette = { leaf: string; dark: string; light: string; stem: string }
const GREEN: Palette = { leaf: '#6ea85e', dark: '#4f7a4a', light: '#9cc98a', stem: '#5b7f45' }
const STRAW: Palette = { leaf: '#cdb67c', dark: '#a8915a', light: '#e2d29f', stem: '#9c8550' }

type Draw = (p: Palette) => ReactElement

function Seed() {
  return (
    <g>
      <ellipse cx={24} cy={40} rx={9} ry={3.6} fill="#3a2a1e" stroke={LINE} strokeWidth={1} />
      <ellipse cx={24} cy={38.4} rx={2.4} ry={1.7} fill="#c9a36b" stroke={LINE} strokeWidth={0.8} />
    </g>
  )
}

/** Two seed leaves on a short stem: every plant's first stage, tinted by its family. */
function Sprout({ p, curl = false }: { p: Palette; curl?: boolean }) {
  if (curl) {
    // A fern's fiddlehead, still rolled up.
    return (
      <g>
        <path d="M24 40V30q0-6 5-6 4 0 4 4 0 3-3 3-2 0-2-2" fill="none" stroke={p.leaf} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M24 40V30q0-6 5-6 4 0 4 4 0 3-3 3-2 0-2-2" fill="none" stroke={LINE} strokeWidth={0.6} strokeLinecap="round" opacity={0.5} />
      </g>
    )
  }
  return (
    <g>
      <path d="M24 40V29" stroke={p.stem} strokeWidth={2} strokeLinecap="round" />
      <path d="M24 31q-8-1-9-7 7-1 9 7Z" fill={p.leaf} stroke={LINE} strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M24 30q7-2 9-8-8 0-9 8Z" fill={p.light} stroke={LINE} strokeWidth={0.9} strokeLinejoin="round" />
    </g>
  )
}

const OAK: Draw[] = [
  () => <Seed />,
  (p) => (
    <g>
      <path d="M24 40V26" stroke="#7a5a3c" strokeWidth={2} strokeLinecap="round" />
      <circle cx={20} cy={27} r={4} fill={p.leaf} stroke={LINE} strokeWidth={0.9} />
      <circle cx={28} cy={25} r={4} fill={p.dark} stroke={LINE} strokeWidth={0.9} />
      <circle cx={24} cy={22} r={4.5} fill={p.leaf} stroke={LINE} strokeWidth={0.9} />
    </g>
  ),
  (p) => (
    <g>
      <path d="M22 40h4l-.5-14h-3Z" fill="#7a5a3c" stroke={LINE} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={15} cy={23} r={8.5} fill={p.dark} stroke={LINE} strokeWidth={1.1} />
      <circle cx={33} cy={23} r={8.5} fill={p.dark} stroke={LINE} strokeWidth={1.1} />
      <circle cx={24} cy={15} r={11} fill={p.leaf} stroke={LINE} strokeWidth={1.1} />
      <circle cx={20} cy={12} r={3} fill={p.light} opacity={0.7} />
    </g>
  ),
  (p) => (
    <g>
      {OAK[2](p)}
      {[[14, 26], [31, 25], [24, 21], [19, 15]].map(([x, y]) => (
        <g key={`${x},${y}`}>
          <ellipse cx={x} cy={y + 1.6} rx={1.9} ry={2.4} fill="#b48a55" stroke={LINE} strokeWidth={0.7} />
          <path d={`M${x - 2.3} ${y + 0.4}q2.3-2.4 4.6 0Z`} fill="#7a5a3c" stroke={LINE} strokeWidth={0.7} />
        </g>
      ))}
    </g>
  ),
]

/** A grape leaf: five rounded lobes. */
const grapeLeaf = (x: number, y: number, r: number, fill: string) => (
  <g key={`${x},${y}`}>
    {[-60, -25, 0, 25, 60].map((deg) => (
      <circle key={deg} cx={x} cy={y - r * 0.55} r={r * 0.48} fill={fill} transform={`rotate(${deg} ${x} ${y})`} />
    ))}
    <circle cx={x} cy={y} r={r * 0.5} fill={fill} stroke={LINE} strokeWidth={0.8} />
  </g>
)

const VINE: Draw[] = [
  () => <Seed />,
  (p) => <Sprout p={p} />,
  (p) => (
    <g>
      {/* The vine runs edge to edge, so a bed of three cells reads as one climbing vine. */}
      <path d="M0 33q12-10 24-2t24-2" fill="none" stroke={p.stem} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M30 28q4-6 0-9" fill="none" stroke={p.stem} strokeWidth={1.1} strokeLinecap="round" />
      {grapeLeaf(13, 27, 9, p.leaf)}
      {grapeLeaf(35, 26, 8, p.dark)}
    </g>
  ),
  (p) => (
    <g>
      {VINE[2](p)}
      {[[22, 36], [26, 36], [24, 39.5], [20, 32.5], [24, 32.5], [28, 32.5]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={2.3} fill="#7a6a9a" stroke={LINE} strokeWidth={0.6} />
      ))}
    </g>
  ),
]

/** Datura's trumpet flower: a long white funnel that flares open at the top, rotated by `deg`. */
const trumpet = (x: number, y: number, deg: number) => (
  <g key={`${x},${y}`} transform={`rotate(${deg} ${x} ${y})`}>
    <path d={`M${x - 1.6} ${y}L${x - 6.5} ${y - 12}h13L${x + 1.6} ${y}Z`} fill="#f3f1ea" stroke={LINE} strokeWidth={0.9} strokeLinejoin="round" />
    <ellipse cx={x} cy={y - 12} rx={7} ry={2.6} fill="#fbfaf6" stroke={LINE} strokeWidth={0.9} />
    <ellipse cx={x} cy={y - 12} rx={2.6} ry={1} fill="#b9a8e6" />
  </g>
)

const MOONFLOWER: Draw[] = [
  () => <Seed />,
  (p) => <Sprout p={p} />,
  (p) => (
    <g>
      <ellipse cx={15} cy={33} rx={9} ry={6} fill={p.dark} stroke={LINE} strokeWidth={1} transform="rotate(-18 15 33)" />
      <ellipse cx={33} cy={33} rx={9} ry={6} fill={p.dark} stroke={LINE} strokeWidth={1} transform="rotate(18 33 33)" />
      <ellipse cx={24} cy={28} rx={10} ry={7} fill={p.leaf} stroke={LINE} strokeWidth={1} />
      <path d="M24 22v12" stroke={p.light} strokeWidth={0.9} opacity={0.8} />
    </g>
  ),
  (p) => (
    <g>
      {MOONFLOWER[2](p)}
      {trumpet(19, 27, -28)}
      {trumpet(30, 27, 24)}
    </g>
  ),
]

const POPPY: Draw[] = [
  () => <Seed />,
  (p) => <Sprout p={p} />,
  (p) => (
    <g>
      {/* Feathery, blue-green leaves and a closed bud. */}
      {[-50, -25, 0, 25, 50].map((deg) => (
        <path key={deg} d="M24 40q-1-7 0-11" fill="none" stroke="#8fb3a0" strokeWidth={2.4} strokeLinecap="round" transform={`rotate(${deg} 24 40)`} />
      ))}
      <path d="M24 40q1-10 0-18" fill="none" stroke={p.stem} strokeWidth={1.6} />
      <ellipse cx={24} cy={20} rx={2.6} ry={4} fill={p.leaf} stroke={LINE} strokeWidth={0.9} />
    </g>
  ),
  (p) => (
    <g>
      {[-50, -25, 0, 25, 50].map((deg) => (
        <path key={deg} d="M24 40q-1-7 0-11" fill="none" stroke="#8fb3a0" strokeWidth={2.4} strokeLinecap="round" transform={`rotate(${deg} 24 40)`} />
      ))}
      <path d="M24 40q1-10 0-17" fill="none" stroke={p.stem} strokeWidth={1.6} />
      {/* A four-petal cup, open to the sun. */}
      <path d="M24 24q-9-2-8-10 5-1 8 4 3-5 8-4 1 8-8 10Z" fill={GOLD} stroke={LINE} strokeWidth={1} strokeLinejoin="round" />
      <path d="M24 24q-3-5 0-10 3 5 0 10Z" fill="#f6b23f" stroke={LINE} strokeWidth={0.8} />
    </g>
  ),
]

/** A sword-fern frond: a tapered blade with notched leaflets. */
const frond = (deg: number, length: number, fill: string) => (
  <g key={deg} transform={`rotate(${deg} 24 40)`}>
    <path d={`M24 40q-4 ${-length / 2} 0 ${-length}q4 ${length / 2} 0 ${length}Z`} fill={fill} stroke={LINE} strokeWidth={0.9} />
    <path d={`M24 40v${-length + 2}`} stroke={LINE} strokeWidth={0.6} opacity={0.45} strokeDasharray="1.6 2.2" />
  </g>
)

const FERN: Draw[] = [
  () => <Seed />,
  (p) => <Sprout p={p} curl />,
  (p) => <g>{[-55, -28, 0, 28, 55].map((deg, i) => frond(deg, i === 2 ? 26 : 21, i % 2 ? p.dark : p.leaf))}</g>,
  (p) => (
    <g>
      {[-62, -40, -18, 4, 24, 44, 64].map((deg, i) => frond(deg, 24 + (i % 3) * 3, i % 2 ? p.dark : p.leaf))}
      <path d="M33 40v-8q0-4 3-4t2 3-2 1" fill="none" stroke={p.light} strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
]

const ART: Record<PlantKind, Draw[]> = { oak: OAK, vine: VINE, moonflower: MOONFLOWER, sunflower: POPPY, fern: FERN }

type Props = {
  kind: PlantKind
  stage: number
  /** Sleeping after a drought: straw coloured and drooping. */
  dry?: boolean
  /** Idle sway, offset per plant so a bed never moves in perfect step. Off for icons. */
  sway?: number | null
}

/** One plant, drawn into a 48×48 box. Place it with an outer `<g transform>` or `<svg>`. */
export default function TendPlant({ kind, stage, dry = false, sway = null }: Props) {
  const palette = dry ? STRAW : GREEN
  const drawing = ART[kind][Math.max(0, Math.min(3, stage))](palette)
  const swaying = sway !== null && !dry && stage > 0
  return (
    <g
      className={swaying ? styles.sway : undefined}
      style={swaying ? { animationDelay: `${-(sway % 7) * 0.53}s` } : undefined}
      transform={dry && stage > 0 ? 'rotate(7 24 40) translate(0 1.5)' : undefined}
    >
      {drawing}
    </g>
  )
}

/** A small plant icon for lists and buttons: the plant in bloom. */
export function PlantIcon({ kind, size = 16 }: { kind: PlantKind; size?: number }) {
  return (
    <svg viewBox="4 6 40 38" width={size} height={size} aria-hidden className="shrink-0" overflow="visible">
      <TendPlant kind={kind} stage={3} />
    </svg>
  )
}
