import type { Journal } from 'src/lib/playJournal'

/**
 * What the Theater says to someone coming back. Pure: it takes a snapshot of
 * this browser's play (src/lib/returningSnapshot.ts reads it) and returns a
 * greeting, up to three notes, and a progress line for each production.
 *
 * Design rules:
 * - The first visit is sacred: no history, no welcome — the Theater renders
 *   exactly as it does for a recruiter seeing it cold.
 * - Absence changes the world, never scolds: "a drought passed through your
 *   garden", not "you broke your streak".
 * - Lead with the player's own unfinished business, then what moved while they
 *   were away, then one thing they have not tried.
 */

export type Snapshot = {
  now: Date
  /** The journal as it stood before this visit touched it. */
  journal: Journal | null
  td: { cleared: number; total: number; stars: number; next: { number: number; name: string } | null }
  readReact: { completed: number; total: number; next: string | null; read: { label: string; share: number } | null }
  passCut: { completed: number; total: number; next: string | null }
  /** `due`: missed puzzles whose spaced review has come round (src/lib/review.ts). */
  go: { rating: number | null; solved: number; total: number; due: number }
  pente: { gameRating: number | null; puzzlesSolved: number; dailyDoneToday: boolean; streak: number; due: number }
  tend: { checkins: number; inBloom: number; checkedInToday: boolean; droughtsWhileAway: number; droughtInDays: number | null } | null
}

export type Note = { kind: 'continue' | 'away' | 'new'; text: string; href: string; cta: string }

export type Welcome = {
  greeting: string
  /** Whole days since the last visit or game, or null when the journal predates it. */
  daysAway: number | null
  notes: Note[]
  /** Production id → one line of the player's own progress there. */
  progress: Record<string, string>
}

/** A Theater production, as much as the welcome needs to know about it. */
export type Billing = { id: string; title: string; logline: string; href: string }

/** Which journal game slugs belong to which Theater production. */
export const PRODUCTION_GAMES: Record<string, string[]> = {
  pente: ['pente'],
  go: ['go'],
  pente_puzzles: ['pente'],
  go_puzzles: ['go'],
  pass_and_cut: ['pass-and-cut'],
  read_and_react: ['read-and-react'],
  moments: ['moments'],
  nanu_pika: ['nanu-pika-td'],
  tend: ['tend', 'tend-watershed', 'tend-journal'],
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Calendar days between two instants in local time (yesterday 11pm → today 1am is one day). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY_MS))
}

/** Has this browser played anything, by the journal or by any game's own save? */
export function hasHistory(s: Snapshot): boolean {
  return (
    (s.journal !== null && Object.keys(s.journal.games).length > 0) ||
    s.td.cleared > 0 || s.readReact.completed > 0 || s.passCut.completed > 0 ||
    s.go.solved > 0 || s.go.due > 0 || s.pente.puzzlesSolved > 0 || s.pente.streak > 0 || s.pente.due > 0 ||
    (s.tend !== null && s.tend.checkins > 0)
  )
}

function playedProduction(s: Snapshot, id: string): boolean {
  const slugs = PRODUCTION_GAMES[id] ?? []
  if (s.journal && slugs.some((g) => s.journal!.games[g])) return true
  switch (id) {
    case 'nanu_pika': return s.td.cleared > 0
    case 'read_and_react': return s.readReact.completed > 0
    case 'pass_and_cut': return s.passCut.completed > 0
    case 'go': return s.go.rating !== null
    case 'go_puzzles': return s.go.solved > 0 || s.go.due > 0
    case 'pente_puzzles': return s.pente.puzzlesSolved > 0 || s.pente.due > 0
    case 'pente': return s.pente.gameRating !== null || s.pente.streak > 0
    case 'tend': return s.tend !== null && s.tend.checkins > 0
    default: return false
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function progressLines(s: Snapshot): Record<string, string> {
  const out: Record<string, string> = {}
  if (s.pente.gameRating !== null) out.pente = `Rating ${s.pente.gameRating}`
  if (s.pente.puzzlesSolved > 0) out.pente_puzzles = `${plural(s.pente.puzzlesSolved, 'puzzle')} solved`
  if (s.go.rating !== null) out.go = `Rating ${s.go.rating}`
  if (s.go.solved > 0) out.go_puzzles = `${s.go.solved} of ${s.go.total} solved`
  if (s.passCut.completed > 0) out.pass_and_cut = `${s.passCut.completed} of ${s.passCut.total} levels`
  if (s.readReact.completed > 0) out.read_and_react = `${s.readReact.completed} of ${s.readReact.total} levels`
  if (s.td.cleared > 0) {
    out.nanu_pika = s.td.next
      ? `Level ${s.td.next.number} of ${s.td.total} · ${s.td.stars}★`
      : `All ${s.td.total} cleared · ${s.td.stars}★`
  }
  if (s.tend && s.tend.checkins > 0) out.tend = `${plural(s.tend.checkins, 'day')} tended · ${s.tend.inBloom} in bloom`
  const moments = s.journal?.games.moments
  if (moments && moments.solved + moments.failed > 0) out.moments = `${plural(moments.solved, 'moment')} read right`
  return out
}

function reviewNote(due: number, game: string, href: string): Note {
  return {
    kind: 'continue',
    text: `${plural(due, `${game} puzzle`)} you missed ${due === 1 ? 'is' : 'are'} due for review.`,
    href,
    cta: 'Review',
  }
}

/** The player's own unfinished business in one game, or null if there is none to point at. */
function continueNote(s: Snapshot, slug: string, href: (id: string) => string): Note | null {
  switch (slug) {
    case 'nanu-pika-td':
      return s.td.next
        ? { kind: 'continue', text: `${s.td.next.name} is waiting — Level ${s.td.next.number} of ${s.td.total}.`, href: href('nanu_pika'), cta: 'Hold the road' }
        : null
    case 'read-and-react':
      if (s.readReact.read) {
        return {
          kind: 'continue',
          text: `The defense kept a file on you: ${s.readReact.read.label}, ${Math.round(s.readReact.read.share * 100)}% of your calls.`,
          href: href('read_and_react'),
          cta: 'Make them guess',
        }
      }
      return s.readReact.next
        ? { kind: 'continue', text: `Next up in Read & React: ${s.readReact.next}.`, href: href('read_and_react'), cta: 'Call the play' }
        : null
    case 'pass-and-cut':
      return s.passCut.next
        ? { kind: 'continue', text: `Next up in Pass & Cut: ${s.passCut.next}.`, href: href('pass_and_cut'), cta: 'Secure a lane' }
        : null
    case 'go':
      return s.go.due > 0 ? reviewNote(s.go.due, 'Go', href('go_puzzles')) : null
    case 'pente':
      if (s.pente.due > 0) return reviewNote(s.pente.due, 'Pente', href('pente_puzzles'))
      return s.pente.gameRating !== null
        ? { kind: 'continue', text: `Your Pente rating is ${s.pente.gameRating}. The bot adapts to it.`, href: href('pente'), cta: 'Play a game' }
        : null
    default:
      return null
  }
}

export function welcomeBack(s: Snapshot, billings: Billing[]): Welcome | null {
  if (!hasHistory(s)) return null
  const href = (id: string) => billings.find((b) => b.id === id)?.href ?? '/theater'
  const daysAway = s.journal ? daysBetween(new Date(s.journal.lastActive), s.now) : null

  const greeting =
    daysAway === null ? 'Welcome back.'
      : daysAway === 0 ? 'Back again today.'
        : daysAway === 1 ? 'Welcome back — it’s been a day.'
          : `Welcome back — it’s been ${daysAway} days.`

  const notes: Note[] = []

  // 1. Their own unfinished business, most recently played first.
  const recent = Object.entries(s.journal?.games ?? {})
    .sort(([, a], [, b]) => b.lastPlayed.localeCompare(a.lastPlayed))
    .map(([slug]) => slug)
  // Saves made before the journal existed have no dates, so fall back to a fixed order.
  const order = recent.length > 0 ? recent : ['nanu-pika-td', 'read-and-react', 'pass-and-cut', 'go', 'pente']
  for (const slug of order) {
    const note = continueNote(s, slug, href)
    if (note) {
      notes.push(note)
      break
    }
  }

  // 2. What moved while they were away. Absence changes the world; it never scolds.
  if (s.tend && s.tend.checkins > 0) {
    if (s.tend.droughtsWhileAway > 0) {
      notes.push({
        kind: 'away',
        text: s.tend.droughtsWhileAway === 1
          ? 'A drought passed through your garden while you were away. See what held.'
          : `${s.tend.droughtsWhileAway} droughts passed through your garden while you were away. See what held.`,
        href: href('tend'),
        cta: 'Visit the garden',
      })
    } else if (!s.tend.checkedInToday) {
      const forecast = s.tend.droughtInDays !== null && s.tend.droughtInDays <= 3
        ? ` A drought is forecast in ${plural(s.tend.droughtInDays, 'day')}.`
        : ''
      notes.push({ kind: 'away', text: `Your garden is open for today’s check-in.${forecast}`, href: href('tend'), cta: 'Check in' })
    }
  }
  if (playedProduction(s, 'pente_puzzles') && !s.pente.dailyDoneToday && notes.length < 2) {
    notes.push({
      kind: 'away',
      text: s.pente.streak > 0 ? `Today’s Pente puzzle is new. Your streak stands at ${s.pente.streak}.` : 'Today’s Pente puzzle is new.',
      href: href('pente_puzzles'),
      cta: 'Solve today’s',
    })
  }

  // 3. One thing they have not tried, in the Theater's own order.
  const untried = billings.find((b) => PRODUCTION_GAMES[b.id] && !playedProduction(s, b.id))
  if (untried) {
    notes.push({ kind: 'new', text: `Not tried yet: ${untried.title}. ${untried.logline}`, href: untried.href, cta: 'Take your seat' })
  }

  return { greeting, daysAway, notes: notes.slice(0, 3), progress: progressLines(s) }
}
