import { supabase } from 'src/lib/supabase'
import { calculateEloChange, MIN_ELO, MAX_ELO } from 'src/lib/pente/elo'

// Slow K-factor for puzzle-side rating so a single attempt barely nudges it;
// ratings converge over many attempts rather than swinging on one solve.
const PUZZLE_K = 10

/**
 * POST /api/pente/puzzle-attempts
 *   body: { player_id, puzzle_id?, puzzle_external_id?, rating?, solved,
 *           attempts?, used_hint?, elo_before?, elo_after?, solve_time_ms? }
 *
 * Records one puzzle attempt (solved or abandoned). If a puzzle_id is provided
 * it bumps puzzle_bank counters and recalibrates puzzle_bank.rating, treating
 * the puzzle as a player: a solve pulls its rating down toward the solver, a
 * miss pushes it up.
 */
export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    player_id, puzzle_id, puzzle_external_id, rating,
    solved, attempts, used_hint, elo_before, elo_after, solve_time_ms,
  } = req.body || {}

  if (!player_id) return res.status(400).json({ error: 'player_id is required' })
  if (typeof solved !== 'boolean') return res.status(400).json({ error: 'solved is required' })

  const row = {
    player_id,
    puzzle_id: puzzle_id || null,
    puzzle_external_id: puzzle_external_id || null,
    rating: rating ?? null,
    solved,
    attempts: attempts ?? 1,
    used_hint: used_hint ?? false,
    elo_before: elo_before ?? null,
    elo_after: elo_after ?? null,
    solve_time_ms: solve_time_ms ?? null,
  }

  const { data, error } = await supabase
    .from('puzzle_attempts')
    .insert(row)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  if (puzzle_id) {
    const { data: cur } = await supabase
      .from('puzzle_bank')
      .select('times_served, times_solved, avg_solve_time_ms, rating, rating_count')
      .eq('id', puzzle_id)
      .single()
    if (cur) {
      const served = (cur.times_served || 0) + 1
      const solvedCount = (cur.times_solved || 0) + (solved ? 1 : 0)
      let avg = cur.avg_solve_time_ms
      if (solved && solve_time_ms) {
        const prevCount = cur.times_solved || 0
        avg = prevCount === 0
          ? solve_time_ms
          : Math.round(((avg || 0) * prevCount + solve_time_ms) / (prevCount + 1))
      }

      const update = {
        times_served: served,
        times_solved: solvedCount,
        avg_solve_time_ms: avg,
      }

      // Recalibrate the puzzle's rating against the solver's rating. We can only
      // do this when we know the solver's ELO (elo_before). The puzzle is the
      // "player" here: it scores 0 when solved (it lost) and 1 when missed.
      const puzzleRating = cur.rating ?? rating
      const solverElo = typeof elo_before === 'number' ? elo_before : null
      if (puzzleRating != null && solverElo != null) {
        const puzzleScore = solved ? 0 : 1
        const delta = calculateEloChange(puzzleRating, solverElo, puzzleScore, PUZZLE_K)
        const next = Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(puzzleRating + delta)))
        update.rating = next
        update.rating_count = (cur.rating_count || 0) + 1
      }

      await supabase
        .from('puzzle_bank')
        .update(update)
        .eq('id', puzzle_id)
    }
  }

  return res.status(200).json({ attempt: data })
}
