import { supabase } from 'src/lib/supabase'

/**
 * POST /api/pente/puzzle-bank — persist a generated puzzle; returns its new id.
 *   body: { board, solutions, player_to_move, category, difficulty, rating,
 *           title?, description?, hint?, explanation?, generated_by? }
 *
 * GET /api/pente/puzzle-bank?rating=1200&window=200&limit=5 — sample puzzles
 *   near a target rating. If no matches, returns the closest available.
 */
export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'POST') {
    const {
      board, solutions, player_to_move, category, difficulty, rating,
      title, description, hint, explanation, generated_by,
    } = req.body || {}

    if (!board || !solutions || !player_to_move || !category || !difficulty || rating == null) {
      return res.status(400).json({ error: 'board, solutions, player_to_move, category, difficulty, rating required' })
    }

    const { data, error } = await supabase
      .from('puzzle_bank')
      .insert({
        board, solutions, player_to_move, category, difficulty, rating,
        title: title || '',
        description: description || '',
        hint: hint || '',
        explanation: explanation || '',
        generated_by: generated_by || 'worker',
      })
      .select('id')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ id: data.id })
  }

  if (req.method === 'GET') {
    // `parseInt(x, 10) || fallback` is NaN-safe: a non-numeric query value like
    // ?window=abc parses to NaN, which is falsy, so the fallback applies. The
    // earlier `req.query.window || '200'` form let 'abc' through and produced a
    // NaN bound that silently broke the Supabase range query.
    const rating = parseInt(req.query.rating, 10)
    const window = parseInt(req.query.window, 10) || 200
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 25)

    if (Number.isNaN(rating)) return res.status(400).json({ error: 'rating query param required' })

    const { data, error } = await supabase
      .from('puzzle_bank')
      .select('*')
      .gte('rating', rating - window)
      .lte('rating', rating + window)
      .order('times_served', { ascending: true })
      .limit(limit)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ puzzles: data || [] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
