import type { Difficulty } from './engine'

/**
 * The campaign: eight levels, each harder than the last, played in order.
 *
 * Difficulty is measured, not guessed. `bot.ts` plays every level and finds its
 * headroom — how much tougher the ants could be before a fixed greedy player
 * loses. Measured 2026-10-20 (seeds 1–3):
 *
 *   level     1     2     3     4     5     6     7     8
 *   headroom  3.81  2.14  1.96  1.61  1.39  1.15  0.98  0.73
 *
 * Level 1 is deliberately soft and short: it must also be won by a player who
 * places five towers and never spends again (a scripted run of exactly that
 * lost the first draft). Early maps have long roads that double back past the same towers; later maps
 * are shorter roads through open forest with more waves and tougher ants. The
 * last two are past what the bot can win: they need splash, slow and placement.
 * `__tests__/campaign.test.ts` fails if a change breaks the ordering.
 *
 * Sizes are landscape; on a phone held upright the same map is transposed.
 */

export type Level = Difficulty & {
  id: string
  name: string
  blurb: string
  template: string
  cols: number
  rows: number
}

export const LEVELS: Level[] = [
  { id: 'long-way-round', name: 'The Long Way Round', blurb: 'Three long lanes. A tower between two lanes guards both.', template: 'serpentine', cols: 12, rows: 8, waves: 5, startGold: 120, lives: 15, hpMult: 0.4, speedMult: 0.9 },
  { id: 'den', name: 'The Den', blurb: 'The road coils inward to the den. Plenty of road, plenty of time.', template: 'spiral', cols: 12, rows: 8, waves: 8, startGold: 110, lives: 15, hpMult: 0.6, speedMult: 0.95 },
  { id: 'zigzag-run', name: 'Zigzag Run', blurb: 'Tight turns bunch the ants up. Splash towers love a corner.', template: 'zigzag', cols: 14, rows: 8, waves: 9, startGold: 110, lives: 14, hpMult: 0.5, speedMult: 1 },
  { id: 'switchback-pass', name: 'Switchback Pass', blurb: 'Rocks wall off the turns. Pick your corners carefully.', template: 'switchback', cols: 14, rows: 8, waves: 10, startGold: 100, lives: 13, hpMult: 0.55, speedMult: 1 },
  { id: 'creek-bend', name: 'Creek Bend', blurb: 'A shorter road and a longer night. Upgrades start to matter.', template: 's-curve', cols: 16, rows: 8, waves: 12, startGold: 100, lives: 12, hpMult: 0.6, speedMult: 1 },
  { id: 'open-meadow', name: 'Open Meadow', blurb: 'Room to build everywhere, and little road to shoot at.', template: 'diamond', cols: 16, rows: 8, waves: 14, startGold: 100, lives: 12, hpMult: 0.7, speedMult: 1 },
  { id: 'high-switchbacks', name: 'High Switchbacks', blurb: 'A long climb with tougher ants. Slow them, then burn them.', template: 'switchback', cols: 18, rows: 9, waves: 16, startGold: 110, lives: 12, hpMult: 0.85, speedMult: 1 },
  { id: 'last-stand', name: 'Last Stand', blurb: 'Twenty waves at full strength across the open meadow.', template: 'diamond', cols: 20, rows: 8, waves: 20, startGold: 120, lives: 12, hpMult: 1, speedMult: 1 },
]

// ─── Progress ────────────────────────────────────────────────────────────────

/** Progress stays in this browser; nothing is sent to the server. */
export const PROGRESS_KEY = 'nanupika_campaign_v1'

export type LevelRecord = { stars: number; bestScore: number }
export type Progress = { version: 1; cleared: Record<string, LevelRecord> }

export const emptyProgress = (): Progress => ({ version: 1, cleared: {} })

/** 3 stars for keeping at least 80% of your lives, 2 for 40%, 1 for any win. */
export function starsFor(livesLeft: number, lives: number) {
  const share = livesLeft / lives
  return share >= 0.8 ? 3 : share >= 0.4 ? 2 : 1
}

/** The first level not yet cleared — where "Continue" goes. LEVELS.length when all are. */
export function currentLevelIndex(progress: Progress) {
  const i = LEVELS.findIndex((l) => !progress.cleared[l.id])
  return i === -1 ? LEVELS.length : i
}

/** A level is open once the one before it is cleared. */
export function isUnlocked(progress: Progress, index: number) {
  return index === 0 || !!progress.cleared[LEVELS[index - 1]?.id]
}

export function totalStars(progress: Progress) {
  return Object.values(progress.cleared).reduce((sum, r) => sum + r.stars, 0)
}

/** Records a win, keeping the best stars and score seen for that level. */
export function recordVictory(progress: Progress, levelId: string, livesLeft: number, lives: number, score: number): Progress {
  const prev = progress.cleared[levelId]
  const stars = starsFor(livesLeft, lives)
  return {
    ...progress,
    cleared: {
      ...progress.cleared,
      [levelId]: { stars: Math.max(stars, prev?.stars ?? 0), bestScore: Math.max(score, prev?.bestScore ?? 0) },
    },
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const LEVEL_IDS = new Set(LEVELS.map((l) => l.id))

/** Shape-checks a parsed save; unknown level ids are dropped, anything malformed starts fresh. */
export function parseProgress(v: unknown): Progress {
  if (!isRecord(v) || v.version !== 1 || !isRecord(v.cleared)) return emptyProgress()
  const cleared: Record<string, LevelRecord> = {}
  for (const [id, r] of Object.entries(v.cleared)) {
    if (!LEVEL_IDS.has(id) || !isRecord(r)) continue
    const { stars, bestScore } = r
    if (Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= 3 && Number.isFinite(bestScore)) {
      cleared[id] = { stars: stars as number, bestScore: bestScore as number }
    }
  }
  return { version: 1, cleared }
}

export function loadProgress(storage: Pick<Storage, 'getItem'> | null): Progress {
  try {
    const raw = storage?.getItem(PROGRESS_KEY)
    return raw ? parseProgress(JSON.parse(raw)) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(storage: Pick<Storage, 'setItem'> | null, progress: Progress): void {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* storage full or blocked — progress lasts for this visit */
  }
}
