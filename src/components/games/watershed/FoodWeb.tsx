import { ROLE_LABEL, ROLE_LEVEL, type Tier } from 'src/lib/games/tend/watershed'
import { Sprite } from './Sprites'

const COLS = [60, 158, 256, 336]
/** Sunlight gold is the one accent; energy from seafloor chemistry, not sunlight, is drawn cyan. */
export const SUN_DOT = '#ffd166'
export const CHEM_DOT = '#6fe3e0'
const CHEMICAL = new Set(['seep'])
const ROW = 74
const NODE = 40

/**
 * One tier's food web. Energy moves left to right, from the energy source to
 * the top predator; each link carries fewer dots than the one before it, the
 * 10% rule drawn as traffic.
 */
export default function FoodWeb({ tier, still }: { tier: Tier; still: boolean }) {
  const byLevel = new Map<number, string[]>()
  for (const r of tier.residents) {
    const level = ROLE_LEVEL[r.role]
    byLevel.set(level, [...(byLevel.get(level) ?? []), r.id])
  }
  const rows = Math.max(...[...byLevel.values()].map((ids) => ids.length))
  const height = rows * ROW + 28
  const pos = new Map<string, { x: number; y: number }>()
  for (const [level, ids] of byLevel) {
    const top = (height - 28 - ids.length * ROW) / 2
    ids.forEach((id, i) => pos.set(id, { x: COLS[level], y: top + i * ROW + ROW / 2 }))
  }
  const levelOf = (id: string) => ROLE_LEVEL[tier.residents.find((r) => r.id === id)!.role]

  return (
    <svg viewBox={`0 0 388 ${height}`} className="block h-auto w-full" role="img" aria-label={`${tier.name} food web`}>
      <defs>
        <marker id="web-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#8fa89a" />
        </marker>
      </defs>

      {tier.eats.map(([eater, eaten]) => {
        const a = pos.get(eaten)!
        const b = pos.get(eater)!
        const x1 = a.x + NODE / 2 + 2
        const x2 = b.x - NODE / 2 - 4
        const mid = (x1 + x2) / 2
        const d = `M${x1} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${x2} ${b.y}`
        const dots = [4, 2, 1][levelOf(eaten)] ?? 1
        return (
          <g key={`${eaten}-${eater}`}>
            <path d={d} fill="none" stroke="#8fa89a" strokeWidth={1.4} markerEnd="url(#web-arrow)" opacity={0.7} />
            {Array.from({ length: dots }, (_, i) => {
              const fill = CHEMICAL.has(eaten) ? CHEM_DOT : SUN_DOT
              // With reduced motion the dots stand still, spaced along the link, so the picture still reads.
              if (still) {
                const t = (i + 1) / (dots + 1)
                const cx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * mid + 3 * (1 - t) * t ** 2 * mid + t ** 3 * x2
                const cy = (1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * a.y + 3 * (1 - t) * t ** 2 * b.y + t ** 3 * b.y
                return <circle key={i} cx={cx} cy={cy} r={2.6} fill={fill} />
              }
              return (
                <circle key={i} r={2.6} fill={fill}>
                  <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${(-2.6 * i) / dots}s`} path={d} />
                </circle>
              )
            })}
          </g>
        )
      })}

      {tier.residents.map((r) => {
        const p = pos.get(r.id)!
        return (
          <g key={r.id}>
            <title>{`${r.name} (${ROLE_LABEL[r.role].toLowerCase()})`}</title>
            <circle cx={p.x} cy={p.y} r={NODE / 2 + 4} fill="#0b1d15" stroke="#2a4636" />
            <svg x={p.x - NODE / 2} y={p.y - NODE / 2} width={NODE} height={NODE} viewBox="0 0 40 40" overflow="visible">
              <Sprite id={r.sprite} />
            </svg>
            <text x={p.x} y={p.y + NODE / 2 + 19} fontSize={12} textAnchor="middle" fill="#cfd8d2">
              {r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
