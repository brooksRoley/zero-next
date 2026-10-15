import type { KeyboardEvent } from 'react'
import { PHASE_TINT, type Phase } from 'src/lib/games/tend/daylight'
import { SEA_LEVEL_INDEX, TIERS, type Tier } from 'src/lib/games/tend/watershed'
import { Sprite } from './Sprites'
import styles from './Watershed.module.css'

const W = 400
const BAND = 96
const SPRITE = 42
const DARKNESS = { full: 0, dim: 0.18, none: 0.38 }

type Props = {
  /** Tiers the player's garden has reached. Every tier is drawn and readable either way. */
  collected: Set<string>
  selected: string
  stepsLeft: (tier: Tier) => number
  onSelect: (id: string) => void
  /** The real time of day, so the sky over the land matches the garden's. */
  phase?: Phase
}

/** Where the bioluminescent sparks sit in a dark band. */
const SPARKS = [[210, 30], [262, 64], [318, 40], [366, 72], [238, 82]] as const
/** Sun rays below the surface: how strongly they reach each sunlit ocean tier. */
const RAYS: Record<string, number> = { coast: 0.16, kelp: 0.1, open: 0.05 }

const STARS = [[40, 14], [96, 30], [150, 10], [214, 24], [262, 8], [318, 34], [356, 16], [120, 52], [300, 58]] as const

/** Particles that drift down through a band: snow up top, marine snow in the deep. */
function Falling({ y, color, count, seed }: { y: number; color: string; count: number; seed: number }) {
  return (
    <g pointerEvents="none">
      {Array.from({ length: count }, (_, i) => {
        const x = 30 + ((i * 97 + seed * 53) % (W - 60))
        return (
          <circle
            key={i}
            className={styles.fall}
            style={{ animationDelay: `${-((i * 1.7 + seed) % 9)}s` }}
            cx={x}
            cy={y + 6}
            r={1.4 + (i % 3) * 0.5}
            fill={color}
          />
        )
      })}
    </g>
  )
}

/**
 * California from the peaks to the sea floor, one band per tier. Tiers the
 * garden hasn't reached yet sit under a light veil with a count of what's left.
 */
export default function CrossSection({ collected, selected, stepsLeft, onSelect, phase = 'day' }: Props) {
  const height = TIERS.length * BAND
  const seaY = SEA_LEVEL_INDEX * BAND

  const keyed = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full" role="group" aria-label="The watershed, from the peaks to the sea floor">
      <defs>
        {TIERS.map((tier) => (
          <linearGradient key={tier.id} id={`band-${tier.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tier.colors[0]} />
            <stop offset="1" stopColor={tier.colors[1]} />
          </linearGradient>
        ))}
        {/* Soft edges: each boundary blends one band's bottom colour into the next band's top. */}
        {TIERS.slice(1).map((tier, i) => (
          <linearGradient key={tier.id} id={`edge-${tier.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={TIERS[i].colors[1]} stopOpacity={0} />
            <stop offset="0.5" stopColor={TIERS[i].colors[1]} stopOpacity={0.55} />
            <stop offset="1" stopColor={tier.colors[0]} stopOpacity={0} />
          </linearGradient>
        ))}
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe6" stopOpacity={0.9} />
          <stop offset="1" stopColor="#fffbe6" stopOpacity={0} />
        </linearGradient>
      </defs>

      {TIERS.map((tier, i) => {
        const y = i * BAND
        const have = collected.has(tier.id)
        const living = tier.residents.filter((r) => r.role !== 'energy')
        const isSelected = tier.id === selected
        return (
          <g
            key={tier.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${tier.name}, ${tier.span}${have ? '' : ', not collected yet'}`}
            onClick={() => onSelect(tier.id)}
            onKeyDown={keyed(tier.id)}
            className="cursor-pointer outline-none [&:focus-visible>rect.focus]:opacity-100"
          >
            <rect x={0} y={y} width={W} height={BAND} fill={`url(#band-${tier.id})`} />
            <rect x={0} y={y} width={W} height={BAND} fill="#000" opacity={DARKNESS[tier.light]} />

            {tier.id === 'alpine' && <Falling y={y} color="#ffffff" count={10} seed={1} />}
            {(tier.id === 'twilight' || tier.id === 'deep') && <Falling y={y} color="#dfe9f2" count={14} seed={i} />}

            {living.map((r, j) => (
              <svg key={r.id} x={196 + j * 48} y={y + BAND - SPRITE - 8} width={SPRITE} height={SPRITE} viewBox="0 0 40 40" overflow="visible">
                <Sprite id={r.sprite} delay={i * 0.7 + j * 1.3} />
              </svg>
            ))}
            {tier.light !== 'full' &&
              SPARKS.map(([sx, sy], k) => (
                <circle
                  key={k}
                  className={styles.spark}
                  style={{ animationDelay: `${-(k * 0.9 + i)}s` }}
                  cx={sx}
                  cy={y + sy}
                  r={1.6}
                  fill={tier.light === 'none' ? '#6fe3e0' : '#9fd8ff'}
                  pointerEvents="none"
                />
              ))}
            {tier.residents.some((r) => r.sprite === 'sun') && i === 0 && phase !== 'night' && (
              <svg x={W - 52} y={y + (phase === 'day' ? 8 : 30)} width={40} height={40} viewBox="0 0 40 40" overflow="visible">
                <Sprite id="sun" />
              </svg>
            )}
            {tier.id === 'deep' && (
              <svg x={W - 56} y={y + BAND - 46} width={44} height={44} viewBox="0 0 40 40" overflow="visible">
                <Sprite id="seep" />
              </svg>
            )}

            <rect x={12} y={y + 12} width={172} height={44} rx={10} fill="#04120c" opacity={0.62} />
            <text x={24} y={y + 31} fontSize={13} fontWeight={600} fill="#f3f1ea">
              {tier.name}
            </text>
            <text x={24} y={y + 47} fontSize={10.5} fill="#cfd8d2">
              {tier.span.length > 28 ? `${tier.span.slice(0, 27)}…` : tier.span}
            </text>

            {!have && (
              <g pointerEvents="none">
                <rect x={0} y={y} width={W} height={BAND} fill="#04120c" opacity={0.28} />
                <rect x={12} y={y + 62} width={112} height={20} rx={10} fill="#04120c" opacity={0.62} />
                <text x={24} y={y + 76} fontSize={10.5} fill="#cfd8d2">
                  {stepsLeft(tier)} {stepsLeft(tier) === 1 ? 'milestone' : 'milestones'} to go
                </text>
              </g>
            )}

            <rect
              className="focus"
              x={2}
              y={y + 2}
              width={W - 4}
              height={BAND - 4}
              rx={6}
              fill="none"
              stroke="#f3f1ea"
              strokeWidth={2}
              opacity={isSelected ? 1 : 0}
              pointerEvents="none"
            />
          </g>
        )
      })}

      {/* Soft tier edges. */}
      <g pointerEvents="none" aria-hidden>
        {TIERS.slice(1).map((tier, i) => (
          <rect key={tier.id} x={0} y={(i + 1) * BAND - 10} width={W} height={20} fill={`url(#edge-${tier.id})`} />
        ))}
      </g>

      {/* Sun rays slant down from the surface and fade by the open ocean. */}
      {phase !== 'night' && (
        <g pointerEvents="none" aria-hidden className={styles.rays}>
          {TIERS.map((tier, i) =>
            RAYS[tier.id]
              ? [40, 130, 230, 320].map((rx, k) => (
                  <polygon
                    key={`${tier.id}-${k}`}
                    points={`${rx},${i * BAND} ${rx + 26},${i * BAND} ${rx + 6},${(i + 1) * BAND} ${rx - 14},${(i + 1) * BAND}`}
                    fill="url(#ray)"
                    opacity={RAYS[tier.id]}
                  />
                ))
              : null,
          )}
        </g>
      )}

      {/* The sky over the land keeps the real clock, like the garden. */}
      {PHASE_TINT[phase].opacity > 0 && (
        <rect x={0} y={0} width={W} height={seaY} fill={PHASE_TINT[phase].color} opacity={PHASE_TINT[phase].opacity} pointerEvents="none" />
      )}
      {phase === 'night' && (
        <g pointerEvents="none" aria-hidden>
          {STARS.map(([sx, sy], i) => (
            <circle key={i} cx={sx} cy={sy} r={1 + (i % 2) * 0.5} fill="#f3f1ea" opacity={0.8} />
          ))}
          <path d={`M${W - 36} 14a12 12 0 1 0 10 18 9 9 0 1 1-10-18Z`} fill="#f3eccf" stroke="#1d2a24" strokeWidth={1} />
        </g>
      )}

      {/* The sea surface: everything below runs on the ocean's food webs. */}
      <g pointerEvents="none">
        <path
          className={styles.wave}
          d={`M-20 ${seaY} q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0`}
          fill="none"
          stroke="#e6f6ff"
          strokeWidth={2}
          opacity={0.8}
        />
        <text x={W - 12} y={seaY - 6} fontSize={10.5} textAnchor="end" fill="#f3f1ea">
          sea level
        </text>
      </g>
    </svg>
  )
}
