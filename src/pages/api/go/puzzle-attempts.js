import { supabase } from 'src/lib/supabase'

/**
 * POST /api/go/puzzle-attempts
 *   body: { player_id, puzzle_id, puzzle_rating?, solved,
 *           used_hint?, elo_before?, elo_after?, solve_time_ms? }
 *
 * Records one Go puzzle attempt (solved or abandoned) to go_puzzle_attempts.
 * Fire-and-forget from the client — failures here never block local progress.
 */
export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    player_id, puzzle_id, puzzle_rating,
    solved, used_hint, elo_before, elo_after, solve_time_ms,
  } = req.body || {}

  if (!player_id) return res.status(400).json({ error: 'player_id is required' })
  if (!puzzle_id) return res.status(400).json({ error: 'puzzle_id is required' })
  if (typeof solved !== 'boolean') return res.status(400).json({ error: 'solved is required' })

  const row = {
    player_id,
    puzzle_id,
    puzzle_rating: puzzle_rating ?? null,
    solved,
    used_hint: used_hint ?? false,
    elo_before: elo_before ?? null,
    elo_after: elo_after ?? null,
    solve_time_ms: Number.isFinite(solve_time_ms) && solve_time_ms >= 0
      ? Math.round(solve_time_ms)
      : null,
  }

  const { data, error } = await supabase
    .from('go_puzzle_attempts')
    .insert(row)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ attempt: data })
}
