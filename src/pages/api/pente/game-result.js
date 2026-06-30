import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'

const limiter = createRateLimiter(30, 60 * 1000) // 30 writes per minute per IP

// PostgREST raises 42P01 ("relation does not exist") / PGRST205 ("Could not
// find the table in the schema cache") when migration 0004 hasn't been applied.
// Treat those as "feature not provisioned yet" rather than a 500.
function isMissingTable(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /game_results/.test(error.message || '') &&
    /(relation|table|schema cache)/i.test(error.message || '')
}

/**
 * POST /api/pente/game-result
 *   body: { player_id, opponent_id?, opponent_type?, bot_level?, game_mode?,
 *           winner?, elo_before?, elo_after?, moves? }
 *
 * Records one completed game for history / replay. Best-effort from the client —
 * a failure never blocks play. Until migration 0004 is applied this returns
 * { supported: false } instead of 500-ing.
 *
 * Migration: supabase/migrations/0004_game_results.sql
 */
export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = limiter.getClientIp(req)
  if (limiter.isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  const {
    player_id, opponent_id, opponent_type, bot_level, game_mode,
    winner, elo_before, elo_after, moves,
  } = req.body || {}

  if (!player_id) return res.status(400).json({ error: 'player_id is required' })

  const row = {
    player_id,
    opponent_id: opponent_id || null,
    opponent_type: opponent_type === 'human' ? 'human' : 'bot',
    bot_level: bot_level || null,
    game_mode: game_mode || null,
    winner: winner || null,
    elo_before: Number.isFinite(elo_before) ? elo_before : null,
    elo_after: Number.isFinite(elo_after) ? elo_after : null,
    moves: Array.isArray(moves) ? moves : null,
  }

  const { data, error } = await supabase
    .from('game_results')
    .insert(row)
    .select()
    .single()

  if (error) {
    if (isMissingTable(error)) return res.status(200).json({ supported: false })
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ result: data, supported: true })
}
