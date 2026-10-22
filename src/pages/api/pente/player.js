import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'
import { normalizeUuid } from 'src/lib/playerId'
import { sanitizePlayerFields, PENTE_PLAYER_FIELDS } from 'src/lib/playerFields'

// Every action syncs the profile, so the budget is generous; it only stops scripts.
const readLimiter = createRateLimiter(240, 60 * 60 * 1000)
const writeLimiter = createRateLimiter(600, 60 * 60 * 1000)

/**
 * GET /api/pente/player?id=<uuid>  — Fetch player profile
 * POST /api/pente/player           — Upsert player profile (create or sync)
 *
 * POST body: { id, name?, elo?, peak_elo?, game_elo?, game_peak_elo?,
 *              puzzles_solved?, games_played?, games_won?, current_streak?,
 *              best_streak?, last_solve_date?, elo_history?, solved_puzzles?,
 *              attempted_puzzles? }
 *
 * `elo`/`peak_elo` are the puzzle rating; `game_elo`/`game_peak_elo` (added by
 * migration 0005) are the game rating used for matchmaking.
 */

// Columns added by migration 0005. Until it's applied, PostgREST rejects
// upserts containing them (PGRST204 "Could not find the '<col>' column") —
// detect that and retry without them so play keeps working pre-migration.
const GAME_ELO_COLUMNS = ['game_elo', 'game_peak_elo']

function isMissingGameEloColumn(error) {
  if (!error) return false
  if (error.code !== 'PGRST204' && !/could not find/i.test(error.message || '')) return false
  return GAME_ELO_COLUMNS.some(col => (error.message || '').includes(col))
}
export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  const limiter = req.method === 'POST' ? writeLimiter : readLimiter
  if (limiter.isRateLimited(limiter.getClientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  if (req.method === 'GET') {
    const id = normalizeUuid(req.query.id)
    if (!id) return res.status(400).json({ error: 'id must be a UUID' })

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Not found — that's fine, client will create on first sync
      return res.status(404).json({ error: 'Player not found' })
    }
    if (error) {
      console.error('pente player read failed', error)
      return res.status(500).json({ error: 'Could not load player' })
    }
    return res.status(200).json({ player: data })
  }

  if (req.method === 'POST') {
    const { id: rawId, ...fields } = req.body || {}
    const id = normalizeUuid(rawId)
    if (!id) return res.status(400).json({ error: 'id must be a UUID' })

    // Known fields only, each typed and bounded (src/lib/playerFields.ts).
    const updates = { last_seen: new Date().toISOString(), ...sanitizePlayerFields(fields, PENTE_PLAYER_FIELDS) }

    let { data, error } = await supabase
      .from('players')
      .upsert({ id, ...updates }, { onConflict: 'id' })
      .select()
      .single()

    if (error && isMissingGameEloColumn(error)) {
      for (const col of GAME_ELO_COLUMNS) delete updates[col]
      ;({ data, error } = await supabase
        .from('players')
        .upsert({ id, ...updates }, { onConflict: 'id' })
        .select()
        .single())
    }

    if (error) {
      console.error('pente player write failed', error)
      return res.status(500).json({ error: 'Could not save player' })
    }
    return res.status(200).json({ player: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
