/**
 * Player art, as data: what a player looks like and what their special move is,
 * derived only from their id and their three Hardwood stats. No photos, no team
 * marks — every figure is drawn from these numbers (src/components/players/PlayerSprite.tsx).
 *
 * Kept free of React and of TypeScript-only runtime features so the same rules can
 * be carried into Hardwood (BballTactics) as plain JavaScript.
 */

export type PlayerStats = { shooting: number; speed: number; defense: number }

export type Archetype = 'sharpshooter' | 'slasher' | 'anchor' | 'twoWay'

export type SpecialMove = {
  archetype: Archetype
  /** The archetype's name on a card. */
  role: string
  /** The special move's name. */
  move: string
  /** One line: what the move is, in basketball terms. */
  blurb: string
  /** The stat that powers it, and its value. */
  stat: keyof PlayerStats | 'all'
  power: number
}

/** A top stat must beat the next one by this much to define the player; closer is a Two-Way. */
export const SIGNATURE_GAP = 6

const MOVES: Record<Archetype, Omit<SpecialMove, 'power' | 'stat'>> = {
  sharpshooter: { archetype: 'sharpshooter', role: 'Sharpshooter', move: 'Splash', blurb: 'A high-arc three that drops through clean.' },
  slasher: { archetype: 'slasher', role: 'Slasher', move: 'Blur', blurb: 'A first step so quick it leaves an afterimage.' },
  anchor: { archetype: 'anchor', role: 'Anchor', move: 'The Wall', blurb: 'Arms up at the rim; nothing gets through.' },
  twoWay: { archetype: 'twoWay', role: 'Two-Way', move: 'Glue', blurb: 'Does a bit of everything and holds the five together.' },
}

const STAT_ARCHETYPE: Record<keyof PlayerStats, Archetype> = {
  shooting: 'sharpshooter',
  speed: 'slasher',
  defense: 'anchor',
}

/** Which archetype a stat line makes, and the special move that comes with it. */
export function specialMove(stats: PlayerStats): SpecialMove {
  const ranked = (Object.keys(STAT_ARCHETYPE) as (keyof PlayerStats)[])
    .map((k) => [k, stats[k]] as const)
    .sort((a, b) => b[1] - a[1])
  const [[topStat, top], [, second]] = ranked
  if (top - second < SIGNATURE_GAP) {
    const mean = Math.round((stats.shooting + stats.speed + stats.defense) / 3)
    return { ...MOVES.twoWay, stat: 'all', power: mean }
  }
  return { ...MOVES[STAT_ARCHETYPE[topStat]], stat: topStat, power: top }
}

/** Ability tier for a stat value: 1 (role player) to 3 (elite). Drives how big the effect is. */
export function tier(power: number): 1 | 2 | 3 {
  if (power >= 75) return 3
  if (power >= 60) return 2
  return 1
}

// ── Appearance ────────────────────────────────────────────────────
//
// Every visual difference on a figure means something in the game. The body is
// one stylised slate tone for every player, with no hair: we don't sort people
// by skin or hair, and a random tone would read as exactly that. What varies is
// the role (colour, gear, stance, emblem), the strength (tier pips), the team
// (jersey) and a jersey number.

/** One figure tone for everyone. Deliberately not a human skin colour. */
export const FIGURE_TONE = '#8b93a7'

export type Gear = 'sleeve' | 'headband' | 'bands' | 'stripe'

/** What each role looks like: its colour, what it wears, and its emblem. */
export const ROLE_STYLE: Record<Archetype, { accent: string; gear: Gear; emblem: string }> = {
  sharpshooter: { accent: '#FDB927', gear: 'sleeve', emblem: 'target' },
  slasher: { accent: '#ff8a3d', gear: 'headband', emblem: 'chevrons' },
  anchor: { accent: '#5aa9ff', gear: 'bands', emblem: 'shield' },
  twoWay: { accent: '#7ee0b8', gear: 'stripe', emblem: 'swap' },
}

/**
 * Jersey colours are a fixed, original palette chosen by hashing the team code:
 * team-coded but not team-branded, so no franchise colours or marks are copied.
 */
export const JERSEYS = [
  { body: '#2f6fde', trim: '#bcd4ff' },
  { body: '#d9483b', trim: '#ffd1c8' },
  { body: '#1f9e74', trim: '#c4f2df' },
  { body: '#7a4fd6', trim: '#e2d4ff' },
  { body: '#e08a1e', trim: '#ffe2b8' },
  { body: '#22323f', trim: '#9fb6c8' },
  { body: '#c23b7a', trim: '#ffd0e6' },
  { body: '#0f8aa3', trim: '#bdeef8' },
] as const

export type Look = {
  tone: string
  archetype: Archetype
  accent: string
  gear: Gear
  emblem: string
  tier: 1 | 2 | 3
  jersey: { body: string; trim: string }
  number: number
  /** Shoulder width multiplier, 0.88–1.14: defenders are broader. */
  build: number
  /** Stride lean, 0–1: faster players lean forward more. */
  lean: number
}

/** A small, stable string hash (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function lookFor(player: { id: number | string; team: string; stats: PlayerStats }): Look {
  const h = hash(`player:${player.id}`)
  const move = specialMove(player.stats)
  return {
    tone: FIGURE_TONE,
    archetype: move.archetype,
    ...ROLE_STYLE[move.archetype],
    tier: tier(move.power),
    jersey: JERSEYS[hash(`team:${player.team}`) % JERSEYS.length],
    number: (h >>> 9) % 100,
    build: 0.88 + 0.26 * clamp01((player.stats.defense - 20) / 70),
    lean: clamp01((player.stats.speed - 30) / 60),
  }
}
