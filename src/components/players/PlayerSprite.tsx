/**
 * An original, procedurally drawn basketball player: front-facing, built from
 * the player's stats and team (src/lib/players/archetype.ts). No images.
 *
 * Everything on the figure is information: the role's colour, gear, stance and
 * emblem; tier pips for strength; the jersey for the team. The body is one slate
 * tone with no hair for every player, so nobody is told apart by skin or hair.
 *
 * It idles with a small bounce. Bump `play` to run the player's special move
 * once (Splash, Blur, The Wall or Glue), or pass `star` to run the ★★ merge burst.
 * Motion is CSS only and stops under prefers-reduced-motion.
 */
import { useId, type CSSProperties } from 'react'
import { lookFor, specialMove, type PlayerStats } from 'src/lib/players/archetype'
import styles from './PlayerSprite.module.css'

export type SpritePlayer = { id: number | string; team: string; stats: PlayerStats }

type Props = {
  player: SpritePlayer
  /** Height in CSS px; the width follows the body's frame (VIEW_W:VIEW_H). */
  size?: number
  /** Increment to play the special move again. 0 = never played. */
  play?: number
  /** Show the ★★ merge burst (replays when `play` changes). */
  star?: boolean
  /** Dim the figure, e.g. a player you can't afford. */
  muted?: boolean
  className?: string
}

const OUTLINE = '#141019'
// The frame hugs the body; effects (the wall, the shot, the aura) draw past it.
const VIEW_X = 18
const VIEW_Y = 2
const VIEW_W = 44
const VIEW_H = 90

/** The role's emblem, drawn in its colour inside a dark badge. */
function Emblem({ kind, accent }: { kind: string; accent: string }) {
  switch (kind) {
    case 'target':
      return (
        <g>
          <circle cx={24} cy={70} r={3.4} fill="none" stroke={accent} strokeWidth={1.3} />
          <circle cx={24} cy={70} r={1.2} fill={accent} />
        </g>
      )
    case 'chevrons':
      return <path d="M20.6 67 l3 3 l-3 3 M24.4 67 l3 3 l-3 3" fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    case 'shield':
      return <path d="M24 65.6 l3.8 1.4 v2.8 q0 3.4 -3.8 4.8 q-3.8 -1.4 -3.8 -4.8 v-2.8z" fill={accent} />
    default:
      return <path d="M20.5 68.5 h6 l-1.8 -1.8 M27.5 71.5 h-6 l1.8 1.8" fill="none" stroke={accent} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
  }
}

export default function PlayerSprite({ player, size = 72, play = 0, star = false, muted = false, className = '' }: Props) {
  const look = lookFor(player)
  const move = specialMove(player.stats)
  const strength = look.tier
  const tone = look.tone
  const accent = look.accent
  // Anchors stand with their arms out; everyone else lets them hang.
  const reach = look.gear === 'bands' ? 14 : 0
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const bodyId = `pf-body-${uid}`
  const sw = 13 * look.build // half shoulder width
  const running = play > 0
  const style = { '--lean': `${-4 * look.lean}deg`, '--tier': strength } as CSSProperties

  return (
    <svg
      viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
      width={(size * VIEW_W) / VIEW_H}
      height={size}
      role="img"
      aria-label={`${move.role}, tier ${strength} of 3: special move ${move.move}`}
      className={`${styles.sprite} ${styles[move.archetype]} ${muted ? styles.muted : ''} ${className}`}
      style={style}
      data-tier={strength}
    >
      {/* Effects behind the body: the merge aura and the anchor's wall. */}
      <g key={`back-${play}-${star}`} className={running ? styles.run : ''}>
        {star && (
          <g className={styles.aura}>
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={39} y={4} width={2} height={18} rx={1} fill="#FDB927" transform={`rotate(${i * 30} 40 50)`} />
            ))}
            <circle cx={40} cy={50} r={30} fill="#FDB927" opacity={0.18} />
          </g>
        )}
        {move.archetype === 'anchor' && (
          <path
            className={styles.wall}
            d="M40 18 L66 30 L66 62 L40 80 L14 62 L14 30Z"
            fill="#5aa9ff"
            fillOpacity={0.16}
            stroke="#8cc6ff"
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        )}
        {move.archetype === 'twoWay' && (
          <circle className={styles.ring} cx={40} cy={54} r={31} fill="none" stroke="#7ee0b8" strokeWidth={2} strokeDasharray="6 5" />
        )}
      </g>

      <ellipse cx={40} cy={90} rx={18} ry={4} fill="#000" opacity={0.28} className={styles.shadow} />
      {/* The role's ring at the feet, its emblem, and one pip per tier. */}
      <ellipse cx={40} cy={89.5} rx={16} ry={3.4} fill="none" stroke={accent} strokeWidth={1.4} opacity={0.75} />
      <g className={styles.badge} transform="translate(0 -60)">
        <circle cx={24} cy={70} r={5.6} fill={OUTLINE} stroke={accent} strokeWidth={1.2} />
        <Emblem kind={look.emblem} accent={accent} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={20.5 + i * 3.5} cy={79} r={1.25} fill={i < strength ? accent : 'none'} stroke={accent} strokeWidth={0.7} />
        ))}
      </g>

      {/* Slasher afterimages: two ghosts of the body trailing the dash. */}
      {move.archetype === 'slasher' && running && (
        <g key={`ghost-${play}`} className={styles.run}>
          <use href={`#${bodyId}`} className={`${styles.ghost} ${styles.ghost1}`} />
          <use href={`#${bodyId}`} className={`${styles.ghost} ${styles.ghost2}`} />
        </g>
      )}

      <g key={`body-${play}`} className={`${styles.body} ${running ? styles.run : ''}`}>
        <g id={bodyId} className={styles.lean}>
          {/* Legs and sneakers */}
          <rect x={32} y={66} width={6} height={17} rx={3} fill={tone} stroke={OUTLINE} strokeWidth={1} />
          <rect x={42} y={66} width={6} height={17} rx={3} fill={tone} stroke={OUTLINE} strokeWidth={1} />
          <path d="M29 82 h11 v4 q0 2 -2 2 h-9 q-2 0 -2 -2z" fill="#f4f1ea" stroke={OUTLINE} strokeWidth={1} />
          <path d="M40 82 h11 v4 q0 2 -2 2 h-9 q-2 0 -2 -2z" fill="#f4f1ea" stroke={OUTLINE} strokeWidth={1} />
          <rect x={29} y={84} width={11} height={1.6} fill={look.jersey.body} />
          <rect x={40} y={84} width={11} height={1.6} fill={look.jersey.body} />
          {/* Shorts */}
          <path d={`M${40 - sw + 2} 58 h${2 * sw - 4} l1 12 h-${sw - 1} l-1 -3 l-1 3 h-${sw - 1}z`} fill={look.jersey.body} stroke={OUTLINE} strokeWidth={1.2} />
          <rect x={40 - sw + 2.5} y={66} width={3} height={3} fill={look.jersey.trim} opacity={0.8} />
          <rect x={40 + sw - 5.5} y={66} width={3} height={3} fill={look.jersey.trim} opacity={0.8} />
          {look.gear === 'stripe' && (
            <g fill={accent}>
              <rect x={40 - sw + 2} y={58} width={2.2} height={12} />
              <rect x={40 + sw - 4.2} y={58} width={2.2} height={12} />
            </g>
          )}
          {/* Arms: the left one and the shooting (right) one move separately. */}
          <g className={styles.armL}>
            <g transform={`rotate(${reach} ${40 - sw - 1.8} 40)`}>
              <rect x={40 - sw - 5} y={38} width={6.5} height={20} rx={3.2} fill={tone} stroke={OUTLINE} strokeWidth={1} />
              <circle cx={40 - sw - 1.8} cy={58} r={3.4} fill={tone} stroke={OUTLINE} strokeWidth={1} />
              {look.gear === 'bands' && <rect x={40 - sw - 5.2} y={51} width={6.9} height={3.4} rx={1} fill={accent} stroke={OUTLINE} strokeWidth={0.6} />}
            </g>
          </g>
          <g className={styles.armR}>
            <g transform={`rotate(${-reach} ${40 + sw + 1.8} 40)`}>
              <rect x={40 + sw - 1.5} y={38} width={6.5} height={20} rx={3.2} fill={tone} stroke={OUTLINE} strokeWidth={1} />
              {look.gear === 'sleeve' && <rect x={40 + sw - 1.5} y={40} width={6.5} height={16} rx={3} fill={accent} stroke={OUTLINE} strokeWidth={0.8} />}
              <circle cx={40 + sw + 1.8} cy={58} r={3.4} fill={tone} stroke={OUTLINE} strokeWidth={1} />
              {look.gear === 'bands' && <rect x={40 + sw - 1.7} y={51} width={6.9} height={3.4} rx={1} fill={accent} stroke={OUTLINE} strokeWidth={0.6} />}
            </g>
          </g>
          {/* A shooter carries the ball at the hip until the shot. */}
          {look.gear === 'sleeve' && (
            <g className={styles.heldBall}>
              <circle cx={40 - sw - 2} cy={63} r={4.6} fill="#f08a24" stroke={OUTLINE} strokeWidth={1} />
              <path d={`M${40 - sw - 6.6} 63 H${40 - sw + 2.6} M${40 - sw - 2} 58.4 V67.6`} stroke={OUTLINE} strokeWidth={0.6} />
            </g>
          )}
          {/* Jersey: a tank top with trim and the number. */}
          <path
            d={`M${40 - sw} 39 Q${40 - sw} 35 ${40 - sw + 4} 35 L34 35 Q40 42 46 35 L${40 + sw - 4} 35 Q${40 + sw} 35 ${40 + sw} 39 L${40 + sw - 1} 60 L${40 - sw + 1} 60Z`}
            fill={look.jersey.body}
            stroke={OUTLINE}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <path d="M34 35 Q40 42 46 35" fill="none" stroke={look.jersey.trim} strokeWidth={1.6} />
          <text x={40} y={54} textAnchor="middle" fontSize={11} fontWeight={900} fontFamily="ui-sans-serif, system-ui, sans-serif" fill={look.jersey.trim} stroke={OUTLINE} strokeWidth={0.5}>
            {look.number}
          </text>
          {/* Neck and head */}
          <rect x={37} y={30} width={6} height={7} fill={tone} />
          <circle cx={40} cy={24} r={12} fill={tone} stroke={OUTLINE} strokeWidth={1.2} />
          <circle cx={28.5} cy={25} r={2.2} fill={tone} stroke={OUTLINE} strokeWidth={1} />
          <circle cx={51.5} cy={25} r={2.2} fill={tone} stroke={OUTLINE} strokeWidth={1} />
          {look.gear === 'headband' && <rect x={27.6} y={16.5} width={24.8} height={4} rx={2} fill={accent} stroke={OUTLINE} strokeWidth={0.8} />}
          <circle cx={35.5} cy={26} r={1.5} fill={OUTLINE} />
          <circle cx={44.5} cy={26} r={1.5} fill={OUTLINE} />
          <path d="M36.5 30.5 Q40 32.5 43.5 30.5" fill="none" stroke={OUTLINE} strokeWidth={1.1} strokeLinecap="round" />
        </g>
      </g>

      {/* Front effects: the shot, the dash streaks, the glue sparkles, the stars. */}
      <g key={`front-${play}-${star}`} className={running ? styles.run : ''}>
        {move.archetype === 'sharpshooter' && (
          <g className={styles.shot}>
            <g className={styles.ball}>
              <circle cx={0} cy={0} r={5} fill="#f08a24" stroke={OUTLINE} strokeWidth={1} />
              <path d="M-5 0 H5 M0 -5 V5" stroke={OUTLINE} strokeWidth={0.7} />
            </g>
            <circle className={styles.swish} cx={70} cy={10} r={6} fill="none" stroke="#FDB927" strokeWidth={2} />
          </g>
        )}
        {move.archetype === 'slasher' && (
          <g className={styles.streaks} stroke={accent} strokeWidth={2} strokeLinecap="round">
            <path d="M6 40 H22" />
            <path d="M2 52 H20" />
            <path d="M8 64 H22" />
          </g>
        )}
        {move.archetype === 'twoWay' && (
          <g className={styles.sparkles} fill="#7ee0b8">
            <path d="M14 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" />
            <path d="M64 70 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" />
          </g>
        )}
        {star && (
          <text className={styles.stars} x={40} y={10} textAnchor="middle" fontSize={13} fontWeight={900} fill="#FDB927" stroke={OUTLINE} strokeWidth={0.8}>
            ★★
          </text>
        )}
      </g>
    </svg>
  )
}
