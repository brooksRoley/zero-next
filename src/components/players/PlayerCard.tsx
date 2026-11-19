/**
 * The inside of a player card: the drawn figure, the name, the archetype and its
 * special move, and three stat bars. The caller owns the button around it, so the
 * same card works for picking, signing, or just looking.
 *
 * `useSpecialMove()` gives a counter and a trigger: hover, focus or a pick bumps
 * the counter and the figure plays its move once.
 */
import { useCallback, useRef, useState } from 'react'
import { ROLE_STYLE, specialMove, type PlayerStats } from 'src/lib/players/archetype'
import PlayerSprite, { type SpritePlayer } from './PlayerSprite'

/** Minimum time between two plays of the same card's move, so hovering doesn't stutter. */
const REPLAY_MS = 900

export function useSpecialMove(): [number, () => void] {
  const [play, setPlay] = useState(0)
  const last = useRef(0)
  const trigger = useCallback(() => {
    const now = Date.now()
    if (now - last.current < REPLAY_MS) return
    last.current = now
    setPlay((n) => n + 1)
  }, [])
  return [play, trigger]
}

const BARS: { key: keyof PlayerStats; label: string; color: string }[] = [
  { key: 'shooting', label: 'SHT', color: '#f08a24' },
  { key: 'speed', label: 'SPD', color: '#ffd36b' },
  { key: 'defense', label: 'DEF', color: '#8cc6ff' },
]


type Props = {
  player: SpritePlayer & { name: string; cost?: number }
  play: number
  star?: boolean
  muted?: boolean
  /** 'full' shows stat bars; 'compact' is the figure, name and move only. */
  variant?: 'full' | 'compact'
  /** Extra line under the name, e.g. "rating 52". */
  aside?: string
}

export default function PlayerCard({ player, play, star = false, muted = false, variant = 'full', aside }: Props) {
  const move = specialMove(player.stats)
  const compact = variant === 'compact'
  return (
    <span className="flex w-full items-center gap-3 pl-1">
      <PlayerSprite player={player} size={compact ? 64 : 80} play={play} star={star} muted={muted} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight text-white">{player.name}</span>
        <span className="mt-0.5 block font-mono text-[11px] leading-tight text-ink-400">
          {player.team}
          {player.cost !== undefined && ` · ${player.cost}G`}
          {aside && ` · ${aside}`}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold leading-tight" style={{ color: ROLE_STYLE[move.archetype].accent }}>
          {move.role} · {move.move}
        </span>
        {!compact && (
          <span className="mt-1 block space-y-0.5" aria-label={`Shooting ${player.stats.shooting}, speed ${player.stats.speed}, defense ${player.stats.defense}`}>
            {BARS.map((b) => (
              <span key={b.key} className="flex items-center gap-1.5" aria-hidden="true">
                <span className="w-7 font-mono text-[9px] text-ink-400">{b.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${player.stats[b.key]}%`, background: b.color }} />
                </span>
                <span className="w-5 text-right font-mono text-[9px] tabular-nums text-ink-300">{player.stats[b.key]}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </span>
  )
}
