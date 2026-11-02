// Server-side bounds for the player profiles the browser syncs to
// /api/pente/player and /api/go/player. Ratings are still computed in the
// browser (puzzles and bot games run client-side), so the server can't verify
// them — but it can refuse nonsense: wrong types, out-of-range ratings,
// unbounded arrays, and display names that aren't plain short text. A field
// that fails its rule is dropped, never written; numbers are clamped.
//
// Threat model. What the server enforces: types, ranges, array lengths, object
// size, and plain-text names. What it cannot: whether a value in range is true.
// A client can still claim any rating from 400 to 2400, a million solved
// puzzles, or a perfect streak, because the games run in the browser. Closing
// that would need the server to recompute ratings from the recorded moves.
// Until then these fields are bragging rights, never a basis for anything paid
// or privileged. Every rule must be bounded; playerFields.test.ts fails if not.

export type FieldRule =
  | { kind: 'int'; min: number; max: number }
  | { kind: 'name' }
  | { kind: 'date' }
  | { kind: 'array'; max: number }
  | { kind: 'object'; maxBytes: number }

const MAX_NAME = 40
const COUNT = { kind: 'int', min: 0, max: 1_000_000 } as const

export const PENTE_PLAYER_FIELDS: Record<string, FieldRule> = {
  name: { kind: 'name' },
  elo: { kind: 'int', min: 400, max: 2400 },
  peak_elo: { kind: 'int', min: 400, max: 2400 },
  game_elo: { kind: 'int', min: 400, max: 2400 },
  game_peak_elo: { kind: 'int', min: 400, max: 2400 },
  puzzles_solved: COUNT,
  games_played: COUNT,
  games_won: COUNT,
  current_streak: COUNT,
  best_streak: COUNT,
  last_solve_date: { kind: 'date' },
  elo_history: { kind: 'array', max: 500 },
  solved_puzzles: { kind: 'array', max: 10_000 },
  attempted_puzzles: { kind: 'array', max: 10_000 },
}

export const GO_PLAYER_FIELDS: Record<string, FieldRule> = {
  name: { kind: 'name' },
  go_elo: { kind: 'int', min: 100, max: 3500 },
  peak_elo: { kind: 'int', min: 100, max: 3500 },
  puzzles_solved: COUNT,
  games_played: COUNT,
  games_won: COUNT,
  lesson_progress: { kind: 'object', maxBytes: 16 * 1024 },
  solved_puzzles: { kind: 'array', max: 10_000 },
}

function clean(value: unknown, rule: FieldRule): unknown {
  switch (rule.kind) {
    case 'int': {
      const n = typeof value === 'number' ? value : Number.NaN
      return Number.isFinite(n) ? Math.min(rule.max, Math.max(rule.min, Math.round(n))) : undefined
    }
    case 'name': {
      if (typeof value !== 'string') return undefined
      // Control and bidi-override characters out, whitespace collapsed.
      const text = value.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
      return text.slice(0, MAX_NAME)
    }
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && value.length <= 40 ? value : value === null ? null : undefined
    case 'array':
      return Array.isArray(value) ? value.slice(-rule.max) : undefined
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= rule.maxBytes
        ? value
        : undefined
  }
}

export function sanitizePlayerFields(
  fields: Record<string, unknown>,
  rules: Record<string, FieldRule>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, rule] of Object.entries(rules)) {
    if (fields[key] === undefined) continue
    const v = clean(fields[key], rule)
    if (v !== undefined) out[key] = v
  }
  return out
}
