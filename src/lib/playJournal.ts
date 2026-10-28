/**
 * The play journal: one small, local record of what this browser has played.
 *
 * Every game already reports through `trackGame()` (src/lib/analytics.ts) with a
 * shared vocabulary — game_start, game_end, puzzle_solved, puzzle_failed,
 * tutorial_stage_complete. That call also writes here, so cross-game features
 * (the Theater's welcome back, see src/lib/welcomeBack.ts) read one schema
 * instead of each game's private save.
 *
 * It never leaves the browser. It holds counts and the last result per game,
 * not a move history, and a malformed save starts fresh.
 */

export const JOURNAL_KEY = 'zero_play_journal_v1'

export type GameEntry = {
  plays: number
  wins: number
  losses: number
  solved: number
  failed: number
  stages: number
  /** ISO time of the last event from this game. */
  lastPlayed: string
  /** The last game_end or puzzle result, with a few scalar fields from its metadata. */
  last: { event: string; at: string; meta: Record<string, string | number | boolean> } | null
}

export type Journal = {
  version: 1
  firstSeen: string
  /** ISO time of the last game event or Theater visit. */
  lastActive: string
  games: Record<string, GameEntry>
}

export const emptyJournal = (now: Date): Journal => ({
  version: 1,
  firstSeen: now.toISOString(),
  lastActive: now.toISOString(),
  games: {},
})

const emptyEntry = (at: string): GameEntry => ({
  plays: 0, wins: 0, losses: 0, solved: 0, failed: 0, stages: 0, lastPlayed: at, last: null,
})

/** Keeps only short scalar metadata (level ids, results, scores) — never free text or arrays. */
function scalars(meta: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (k === 'game') continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && v.length <= 64) out[k] = v
    if (Object.keys(out).length >= 8) break
  }
  return out
}

export function recordGameEvent(
  journal: Journal,
  event: string,
  game: string,
  metadata: Record<string, unknown>,
  now: Date,
): Journal {
  const at = now.toISOString()
  const prev = journal.games[game] ?? emptyEntry(at)
  const entry: GameEntry = { ...prev, lastPlayed: at }
  if (event === 'game_start') entry.plays += 1
  if (event === 'game_end') {
    if (metadata.result === 'win') entry.wins += 1
    if (metadata.result === 'loss') entry.losses += 1
  }
  if (event === 'puzzle_solved') entry.solved += 1
  if (event === 'puzzle_failed') entry.failed += 1
  if (event === 'tutorial_stage_complete') entry.stages += 1
  if (event !== 'game_start' && event !== 'puzzle_start') entry.last = { event, at, meta: scalars(metadata) }
  return { ...journal, lastActive: at, games: { ...journal.games, [game]: entry } }
}

/** Marks a visit with no play (opening the Theater), so "days away" counts from it. */
export function touch(journal: Journal, now: Date): Journal {
  return { ...journal, lastActive: now.toISOString() }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

function parseEntry(v: unknown): GameEntry | null {
  if (!isRecord(v) || !isIso(v.lastPlayed)) return null
  const counts = ['plays', 'wins', 'losses', 'solved', 'failed', 'stages'] as const
  if (!counts.every((k) => isCount(v[k]))) return null
  let last: GameEntry['last'] = null
  if (isRecord(v.last) && typeof v.last.event === 'string' && isIso(v.last.at) && isRecord(v.last.meta)) {
    last = { event: v.last.event, at: v.last.at, meta: scalars(v.last.meta) }
  }
  return {
    plays: v.plays as number, wins: v.wins as number, losses: v.losses as number,
    solved: v.solved as number, failed: v.failed as number, stages: v.stages as number,
    lastPlayed: v.lastPlayed, last,
  }
}

export function parseJournal(v: unknown): Journal | null {
  if (!isRecord(v) || v.version !== 1 || !isIso(v.firstSeen) || !isIso(v.lastActive) || !isRecord(v.games)) return null
  const games: Record<string, GameEntry> = {}
  for (const [game, entry] of Object.entries(v.games)) {
    const parsed = parseEntry(entry)
    if (parsed && game.length <= 40) games[game] = parsed
  }
  return { version: 1, firstSeen: v.firstSeen, lastActive: v.lastActive, games }
}

export function loadJournal(storage: Pick<Storage, 'getItem'> | null): Journal | null {
  try {
    const raw = storage?.getItem(JOURNAL_KEY)
    return raw ? parseJournal(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function saveJournal(storage: Pick<Storage, 'setItem'> | null, journal: Journal): void {
  try {
    storage?.setItem(JOURNAL_KEY, JSON.stringify(journal))
  } catch {
    /* storage full or blocked — the journal is a convenience, play goes on */
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Browser entry point used by trackGame(): load, record, save. Never throws. */
export function noteGameEvent(event: string, game: string, metadata: Record<string, unknown>, now = new Date()): void {
  const storage = browserStorage()
  if (!storage) return
  const journal = loadJournal(storage) ?? emptyJournal(now)
  saveJournal(storage, recordGameEvent(journal, event, game, metadata, now))
}
