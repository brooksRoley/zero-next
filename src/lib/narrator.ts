import type { Snapshot } from 'src/lib/welcomeBack'

/**
 * The house narrator: one short, authored line per Theater visit, chosen from
 * what this browser has actually played.
 *
 * The technique is Hades-style reactive writing — many small lines, each gated
 * on one condition, ranked, and never repeated back to back — rather than
 * generated text. Rules for adding a line:
 * - It must be true of the snapshot it fires on. No flattery the data can't back.
 * - It speaks as the house (warm, a little wry), never as a coach scolding.
 * - It never mentions a lapse as a failure: absence and losses are weather.
 * - Higher `priority` = more specific. Generic lines sit at 0 as the fallback.
 */

export type NarratorContext = Snapshot & { daysAway: number | null }

export type Line = {
  id: string
  priority: number
  when: (c: NarratorContext) => boolean
  say: (c: NarratorContext) => string
}

const plays = (c: NarratorContext, game: string) => c.journal?.games[game]
const triedCount = (c: NarratorContext) => {
  const games = new Set(Object.keys(c.journal?.games ?? {}).map((g) => (g.startsWith('tend') ? 'tend' : g)))
  if (c.td.cleared > 0) games.add('nanu-pika-td')
  if (c.readReact.completed > 0) games.add('read-and-react')
  if (c.passCut.completed > 0) games.add('pass-and-cut')
  if (c.go.solved > 0) games.add('go')
  if (c.pente.puzzlesSolved > 0) games.add('pente')
  if (c.tend && c.tend.checkins > 0) games.add('tend')
  return games.size
}

export const LINES: Line[] = [
  // ── Nanu & Pika ──
  {
    id: 'td-all-clear', priority: 30,
    when: (c) => c.td.next === null && c.td.cleared > 0,
    say: () => 'Every road held. Nanu and Pika have started napping on the job.',
  },
  {
    id: 'td-perfect', priority: 32,
    when: (c) => c.td.next === null && c.td.stars === c.td.total * 3,
    say: (c) => `Three stars on all ${c.td.total} levels. The ants have filed a complaint.`,
  },
  {
    id: 'td-last-two', priority: 22,
    when: (c) => c.td.next !== null && c.td.next.number >= c.td.total - 1,
    say: (c) => `${c.td.next!.name} is where greedy builds go to die. Slow the ants first, then burn them.`,
  },
  {
    id: 'td-lost-last', priority: 18,
    when: (c) => plays(c, 'nanu-pika-td')?.last?.meta.result === 'loss',
    say: () => 'The ants got through last time. Retry Wave keeps your towers — it is not cheating, it is rehearsal.',
  },
  {
    id: 'td-midway', priority: 10,
    when: (c) => c.td.next !== null && c.td.cleared >= 3,
    say: (c) => `${c.td.cleared} roads held so far. ${c.td.next!.name} is shorter, and the night is longer.`,
  },

  // ── Read & React ──
  {
    id: 'rr-predictable', priority: 24,
    when: (c) => (c.readReact.read?.share ?? 0) >= 0.8,
    say: (c) => `The defense has stopped guessing about you: ${c.readReact.read!.label}, ${Math.round(c.readReact.read!.share * 100)}% of the time. That is a compliment and a problem.`,
  },
  {
    id: 'rr-unreadable', priority: 16,
    when: (c) => c.readReact.read !== null && c.readReact.read.share <= 0.6 && c.readReact.completed >= 2,
    say: () => 'Your play calls are hard to read. In Read & React, that is the whole game.',
  },
  {
    id: 'rr-playbook', priority: 20,
    when: (c) => c.readReact.completed === c.readReact.total && c.readReact.total > 0,
    say: () => 'You have run the whole playbook. Now run it again without a favorite.',
  },

  // ── Pass & Cut ──
  {
    id: 'pc-all', priority: 20,
    when: (c) => c.passCut.completed === c.passCut.total && c.passCut.total > 0,
    say: () => 'Every lane secured. Claude Shannon would have liked your passing.',
  },

  // ── Go ──
  {
    id: 'go-patient', priority: 19,
    when: (c) => c.go.due >= 3,
    say: (c) => `${c.go.due} Go puzzles you missed have been waiting. Go puzzles are good at waiting.`,
  },
  {
    id: 'go-all', priority: 21,
    when: (c) => c.go.total > 0 && c.go.solved >= c.go.total,
    say: () => 'Every tsumego on the shelf is solved. The board has no secrets left — try a whole game.',
  },

  // ── Pente ──
  {
    id: 'pente-streak', priority: 17,
    when: (c) => c.pente.streak >= 3,
    say: (c) => `${c.pente.streak} days of Pente puzzles in a row. The mountain notices.`,
  },
  {
    id: 'pente-review', priority: 14,
    when: (c) => c.pente.due >= 2,
    say: (c) => `${c.pente.due} Pente puzzles came back around. The second time is where they stick.`,
  },

  // ── Tend ──
  {
    id: 'tend-weather', priority: 23,
    when: (c) => (c.tend?.droughtsWhileAway ?? 0) > 0,
    say: () => 'Gardens keep their own calendar. Yours had weather while you were out.',
  },
  {
    id: 'tend-bloom', priority: 15,
    when: (c) => (c.tend?.inBloom ?? 0) >= 5,
    say: (c) => `${c.tend!.inBloom} beds in bloom. That is a garden now, not a project.`,
  },
  {
    id: 'tend-forecast', priority: 13,
    when: (c) => c.tend !== null && c.tend.droughtInDays !== null && c.tend.droughtInDays <= 2,
    say: () => 'Dry weather is coming to the garden. The house would water today.',
  },

  // ── Moments ──
  {
    id: 'moments-reader', priority: 12,
    when: (c) => (plays(c, 'moments')?.solved ?? 0) >= 3,
    say: (c) => `You have read ${plays(c, 'moments')!.solved} playoff moments right. Somebody hire this assistant coach.`,
  },

  // ── The house ──
  {
    id: 'house-long-absence', priority: 25,
    when: (c) => (c.daysAway ?? 0) >= 14,
    say: (c) => `${c.daysAway} days. Everything is where you left it; the dust is decorative.`,
  },
  {
    id: 'house-regular', priority: 8,
    when: (c) => c.daysAway === 0,
    say: () => 'Back the same day. The house is starting to save you a seat.',
  },
  {
    id: 'house-explorer', priority: 9,
    when: (c) => triedCount(c) >= 5,
    say: (c) => `You have sat in ${triedCount(c)} different seats. Few visitors see this much of the house.`,
  },
  {
    id: 'house-one-seat', priority: 6,
    when: (c) => triedCount(c) === 1,
    say: () => 'One production so far. The others are good too — the house is biased, but honest.',
  },
  {
    id: 'house-lights', priority: 0,
    when: () => true,
    say: () => 'The lights are on and the seats are free. Stay as long as you like.',
  },
  {
    id: 'house-curtain', priority: 0,
    when: () => true,
    say: () => 'Every production here is still in rehearsal. Come back and it will have changed a little.',
  },
]

/** Remembered recently spoken lines, so a regular does not hear the same one twice running. */
export const NARRATOR_KEY = 'zero_narrator_v1'
export const RECENT_LIMIT = 6

/**
 * The line for this visit: the highest-priority line whose condition holds and
 * which was not spoken in the last RECENT_LIMIT visits. If everything eligible
 * was spoken recently, the one spoken longest ago comes back.
 */
export function pickLine(c: NarratorContext, recent: string[], lines: Line[] = LINES): { id: string; text: string } {
  const eligible = lines.filter((l) => l.when(c)).sort((a, b) => b.priority - a.priority)
  const fresh = eligible.find((l) => !recent.includes(l.id))
  // `recent` is newest first, so the line spoken longest ago has the largest index.
  const line = fresh ?? [...eligible].sort((a, b) => recent.indexOf(b.id) - recent.indexOf(a.id))[0]
  return { id: line.id, text: line.say(c) }
}

/** Newest first, capped. */
export function remember(recent: string[], id: string): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT)
}

export function loadRecent(storage: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(NARRATOR_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function saveRecent(storage: Pick<Storage, 'setItem'> | null, recent: string[]): void {
  try {
    storage?.setItem(NARRATOR_KEY, JSON.stringify(recent))
  } catch {
    /* the narrator may repeat itself; nothing else is lost */
  }
}
