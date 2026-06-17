import { supabase } from 'src/lib/supabase'

/**
 * Daily Challenge streak persistence, stored on the players table.
 *
 *   GET  /api/pente/daily?id=<uuid>   → { daily, supported }
 *   POST /api/pente/daily             → { daily, supported }
 *        body: { id, daily: { streak, bestStreak, lastCompletedDate, ... } }
 *
 * Migration (run once in the Supabase SQL editor — idempotent):
 *
 *   ALTER TABLE players
 *     ADD COLUMN IF NOT EXISTS daily_challenge JSONB DEFAULT '{}'::jsonb;
 *
 * Until that column exists this route reports { supported: false } instead of
 * 500-ing, so the client falls back to localStorage and the rest of the player
 * sync (which never touches this column) is unaffected.
 */

// PostgREST raises 42703 ("column ... does not exist") / PGRST204 when the
// migration hasn't been applied. Treat those as "feature not provisioned yet".
function isMissingColumn(error) {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /daily_challenge/.test(error.message || '') && /column|schema/i.test(error.message || '')
}

export default async function handler(req, res) {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  if (req.method === 'GET') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id is required' })

    const { data, error } = await supabase
      .from('players')
      .select('daily_challenge')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Player not found' })
      if (isMissingColumn(error)) return res.status(200).json({ daily: null, supported: false })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ daily: data?.daily_challenge ?? null, supported: true })
  }

  if (req.method === 'POST') {
    const { id, daily } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required' })
    if (!daily || typeof daily !== 'object') {
      return res.status(400).json({ error: 'daily object is required' })
    }

    const { data, error } = await supabase
      .from('players')
      .upsert(
        { id, daily_challenge: daily, last_seen: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select('daily_challenge')
      .single()

    if (error) {
      if (isMissingColumn(error)) return res.status(200).json({ daily, supported: false })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ daily: data?.daily_challenge ?? daily, supported: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
