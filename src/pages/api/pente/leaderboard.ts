import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from 'src/lib/supabase'
import { getZone } from 'src/lib/pente/elo'

/**
 * GET /api/pente/leaderboard — Top puzzle solvers by ELO.
 *
 * Ranks the Supabase `players` table by elo DESC. Scoped to players who've
 * actually solved at least one puzzle so the board reflects demonstrated skill
 * rather than a wall of default-state (800 ELO, "Anonymous") rows. Zone is
 * derived from elo via the shared altitude-zone map, so the client doesn't have
 * to duplicate the ELO→zone thresholds.
 */

const LIMIT = 20

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  const { data, error } = await supabase
    .from('players')
    .select('id, name, elo, peak_elo, puzzles_solved')
    .gt('puzzles_solved', 0)
    .order('elo', { ascending: false })
    .order('puzzles_solved', { ascending: false })
    .limit(LIMIT)

  if (error) return res.status(500).json({ error: error.message })

  const leaderboard = (data ?? []).map((p, i) => {
    const elo = Number(p.elo) || 0
    const zone = getZone(elo)
    return {
      rank: i + 1,
      id: p.id,
      name: (p.name && String(p.name).trim()) || 'Anonymous',
      elo,
      peak_elo: Number(p.peak_elo) || elo,
      puzzles_solved: Number(p.puzzles_solved) || 0,
      zone: { name: zone.name, color: zone.color },
    }
  })

  // Read-heavy, updates lazily — let the CDN serve it and refresh in the
  // background. Per-player profiles stay live via /api/pente/player.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  return res.status(200).json({ leaderboard })
}
