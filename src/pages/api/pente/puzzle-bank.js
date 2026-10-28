import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'

// Puzzles are generated in the browser and shown to every other player, so a
// stored puzzle is public content: bound its size and its text.
const writeLimiter = createRateLimiter(60, 60 * 60 * 1000)
const TEXT_LIMITS = { title: 120, description: 600, hint: 300, explanation: 600, category: 40, difficulty: 40, generated_by: 40 }
const MAX_JSON_BYTES = { board: 8 * 1024, solutions: 4 * 1024 }

const plain = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max) : ''
const jsonWithin = (v, max) => v != null && typeof v === 'object' && JSON.stringify(v).length <= max

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

    if (writeLimiter.isRateLimited(writeLimiter.getClientIp(req))) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    if (!board || !solutions || !player_to_move || !category || !difficulty || rating == null) {
      return res.status(400).json({ error: 'board, solutions, player_to_move, category, difficulty, rating required' })
    }
    if (!jsonWithin(board, MAX_JSON_BYTES.board) || !jsonWithin(solutions, MAX_JSON_BYTES.solutions)) {
      return res.status(400).json({ error: 'board and solutions must be small JSON values' })
    }
    if (!Number.isFinite(rating) || !['number', 'string'].includes(typeof player_to_move)) {
      return res.status(400).json({ error: 'rating must be a number' })
    }

    const { data, error } = await supabase
      .from('puzzle_bank')
      .insert({
        board, solutions, player_to_move,
        category: plain(category, TEXT_LIMITS.category),
        difficulty: plain(difficulty, TEXT_LIMITS.difficulty),
        rating: Math.min(2400, Math.max(400, Math.round(rating))),
        title: plain(title, TEXT_LIMITS.title),
        description: plain(description, TEXT_LIMITS.description),
        hint: plain(hint, TEXT_LIMITS.hint),
        explanation: plain(explanation, TEXT_LIMITS.explanation),
        generated_by: plain(generated_by, TEXT_LIMITS.generated_by) || 'worker',
      })
      .select('id')
      .single()

    if (error) {
      console.error('puzzle bank failed', error)
      return res.status(500).json({ error: 'Puzzle bank unavailable' })
    }
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

    if (error) {
      console.error('puzzle bank failed', error)
      return res.status(500).json({ error: 'Puzzle bank unavailable' })
    }
    return res.status(200).json({ puzzles: data || [] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
