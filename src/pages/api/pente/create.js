import { supabase } from 'src/lib/supabase'
import { createEmptyBoard } from 'src/lib/pente/gameLogic'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { playerId, playerName } = req.body
  if (!playerId) return res.status(400).json({ error: 'playerId is required' })

  const { data, error } = await supabase
    .from('games')
    .insert({
      board: createEmptyBoard(),
      player_black_id: playerId,
      player_black: playerName || 'Black',
      status: 'waiting',
      current_player: 1,
      black_captures: 0,
      white_captures: 0,
      black_score: 0,
      white_score: 0,
      move_count: 0,
    })
    .select('id')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ gameId: data.id })
}
