import { supabase } from 'src/lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { gameId, playerId, playerName } = req.body
  if (!gameId || !playerId) return res.status(400).json({ error: 'gameId and playerId are required' })

  // Fetch game
  const { data: game, error: fetchErr } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (fetchErr || !game) return res.status(404).json({ error: 'Game not found' })
  if (game.status !== 'waiting') return res.status(400).json({ error: 'Game is not waiting for players' })
  if (game.player_black_id === playerId) return res.status(400).json({ error: 'Cannot join your own game' })

  const { data, error } = await supabase
    .from('games')
    .update({
      player_white_id: playerId,
      player_white: playerName || 'White',
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ game: data })
}
