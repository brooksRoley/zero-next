import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'
import { normalizeUuid } from 'src/lib/playerId'
import { sanitizePlayerFields, GO_PLAYER_FIELDS } from 'src/lib/playerFields'

// Every action syncs the profile, so the budget is generous; it only stops scripts.
const readLimiter = createRateLimiter(240, 60 * 60 * 1000)
const writeLimiter = createRateLimiter(600, 60 * 60 * 1000)

/**
 * GET  /api/go/player?id=<uuid>  — Fetch Go player profile
 * POST /api/go/player            — Upsert Go player profile (create or sync)
 *
 * POST body: { id, name?, go_elo?, peak_elo?, puzzles_solved?, games_played?,
 *              games_won?, lesson_progress?, solved_puzzles? }
 */
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
      .from('go_players')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Player not found' })
    }
    if (error) {
      console.error('go player read failed', error)
      return res.status(500).json({ error: 'Could not load player' })
    }
    return res.status(200).json({ player: data })
  }

  if (req.method === 'POST') {
    const { id: rawId, ...fields } = req.body || {}
    const id = normalizeUuid(rawId)
    if (!id) return res.status(400).json({ error: 'id must be a UUID' })

    // Known fields only, each typed and bounded (src/lib/playerFields.ts).
    const updates = { last_seen: new Date().toISOString(), ...sanitizePlayerFields(fields, GO_PLAYER_FIELDS) }

    const { data, error } = await supabase
      .from('go_players')
      .upsert({ id, ...updates }, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('go player write failed', error)
      return res.status(500).json({ error: 'Could not save player' })
    }
    return res.status(200).json({ player: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
