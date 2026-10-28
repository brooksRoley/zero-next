import { loadJournal } from 'src/lib/playJournal'
import type { Snapshot } from 'src/lib/welcomeBack'
import { LEVELS as TD_LEVELS, currentLevelIndex, loadProgress, totalStars } from 'src/lib/games/nanupika/campaign'
import { LEVELS as RR_LEVELS } from 'src/lib/games/readreact/levels'
import { headlineRead, loadScouting } from 'src/lib/games/readreact/scouting'
import { LEVELS as PC_LEVELS } from 'src/lib/games/passcut/levels'
import { PUZZLES as GO_PUZZLES, PUZZLE_BY_ID as GO_BY_ID } from 'src/lib/go/puzzles'
import { getPuzzleById as pentePuzzle } from 'src/lib/pente/puzzles'
import { dueForReview, goAttempts, penteAttempts } from 'src/lib/review'
import { getDailyStamp, isCompletedOn } from 'src/lib/pente/dailyChallenge'
import { loadGarden } from 'src/lib/games/tend/storage'
import { bloomCount, forecast, hasCheckedIn, resolveSeasons } from 'src/lib/games/tend/engine'
import { dayIndex } from 'src/lib/games/tend/time'

/**
 * Reads everything the Theater's welcome back needs from this browser, through
 * each game's own save and parser. Every reader fails soft: a missing or
 * corrupted save reads as "never played", so one broken game cannot blank the
 * Theater. Nothing here writes or leaves the browser.
 */

type Store = Pick<Storage, 'getItem'>

function json(storage: Store, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)

function readTd(storage: Store): Snapshot['td'] {
  const progress = loadProgress(storage)
  const i = currentLevelIndex(progress)
  return {
    cleared: Object.keys(progress.cleared).length,
    total: TD_LEVELS.length,
    stars: totalStars(progress),
    next: i < TD_LEVELS.length ? { number: i + 1, name: TD_LEVELS[i].name } : null,
  }
}

function readReadReact(storage: Store): Snapshot['readReact'] {
  const done = new Set(strings(json(storage, 'readreact_progress')))
  const nextLevel = RR_LEVELS.find((l) => !done.has(l.id)) ?? null
  const read = headlineRead(loadScouting(storage), nextLevel ?? RR_LEVELS[RR_LEVELS.length - 1])
  return {
    completed: RR_LEVELS.filter((l) => done.has(l.id)).length,
    total: RR_LEVELS.length,
    next: nextLevel?.title ?? null,
    read: read ? { label: read.label, share: read.share } : null,
  }
}

function readPassCut(storage: Store): Snapshot['passCut'] {
  const done = new Set(strings(json(storage, 'passcut_progress')))
  return {
    completed: PC_LEVELS.filter((l) => done.has(l.id)).length,
    total: PC_LEVELS.length,
    next: PC_LEVELS.find((l) => !done.has(l.id))?.title ?? null,
  }
}

function readGo(storage: Store, now: Date): Snapshot['go'] {
  const profile = json(storage, 'go.profile.v2')
  if (!isRecord(profile)) return { rating: null, solved: 0, total: GO_PUZZLES.length, due: 0 }
  const solved = new Set(strings(profile.solved))
  const attempts = goAttempts(profile.attempts).filter((a) => GO_BY_ID[a.puzzleId])
  const played = (num(profile.gamesPlayed) ?? 0) > 0 || solved.size > 0 || attempts.length > 0
  return {
    rating: played ? num(profile.goElo) : null,
    solved: solved.size,
    total: GO_PUZZLES.length,
    due: dueForReview(attempts, now.getTime()).length,
  }
}

function readPente(storage: Store, now: Date): Snapshot['pente'] {
  const progress = json(storage, 'pente_puzzle_progress')
  const daily = json(storage, 'pente_daily_challenge')
  const today = getDailyStamp(now)
  const yesterday = getDailyStamp(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12))
  const last = isRecord(daily) && typeof daily.lastCompletedDate === 'string' ? daily.lastCompletedDate : null
  // A streak only stands if it was kept up yesterday or today.
  const streak = isRecord(daily) && (last === today || last === yesterday) ? (num(daily.streak) ?? 0) : 0
  const gamesPlayed = isRecord(progress) ? (num(progress.gamesPlayed) ?? 0) : 0
  const isCatalog = (id: string) => Boolean(pentePuzzle(id))
  const history = isRecord(progress)
    ? [...penteAttempts(progress.eloHistory, isCatalog), ...penteAttempts(progress.reviewLog, isCatalog)]
    : []
  return {
    gameRating: isRecord(progress) && gamesPlayed > 0 ? num(progress.gameElo ?? progress.elo) : null,
    puzzlesSolved: isRecord(progress) ? strings(progress.solved).length : 0,
    dailyDoneToday: isCompletedOn(daily, today),
    streak,
    due: dueForReview(history, now.getTime()).length,
  }
}

function readTend(storage: Store, now: Date): Snapshot['tend'] {
  const garden = loadGarden(storage)
  if (!garden) return null
  const today = dayIndex(now)
  const resolved = resolveSeasons(garden, today)
  const coming = forecast(resolved, today)
  return {
    checkins: Object.keys(garden.checkins).length,
    inBloom: bloomCount(resolved, today),
    checkedInToday: hasCheckedIn(garden, today),
    droughtsWhileAway: resolved.seasons.length - garden.seasons.length,
    droughtInDays: coming ? coming.inDays : null,
  }
}

export function readSnapshot(storage: Store, now = new Date()): Snapshot {
  const safe = <T>(read: () => T, fallback: T): T => {
    try {
      return read()
    } catch {
      return fallback
    }
  }
  return {
    now,
    journal: safe(() => loadJournal(storage), null),
    td: safe(() => readTd(storage), { cleared: 0, total: TD_LEVELS.length, stars: 0, next: null }),
    readReact: safe(() => readReadReact(storage), { completed: 0, total: RR_LEVELS.length, next: null, read: null }),
    passCut: safe(() => readPassCut(storage), { completed: 0, total: PC_LEVELS.length, next: null }),
    go: safe(() => readGo(storage, now), { rating: null, solved: 0, total: GO_PUZZLES.length, due: 0 }),
    pente: safe(() => readPente(storage, now), { gameRating: null, puzzlesSolved: 0, dailyDoneToday: false, streak: 0, due: 0 }),
    tend: safe(() => readTend(storage, now), null),
  }
}
