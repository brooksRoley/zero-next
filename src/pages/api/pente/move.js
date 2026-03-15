import { supabase } from 'src/lib/supabase'
import { applyMove } from 'src/lib/pente/gameLogic'
import { BLACK, WHITE } from 'src/lib/pente/constants'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { gameId, playerId, row, col } = req.body
  if (!gameId || !playerId || row == null || col == null) {
    return res.status(400).json({ error: 'gameId, playerId, row, and col are required' })
  }

  // Fetch current game state
  const { data: game, error: fetchErr } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (fetchErr || !game) return res.status(404).json({ error: 'Game not found' })
  if (game.status !== 'in_progress') return res.status(400).json({ error: 'Game is not in progress' })

  // Validate it's this player's turn
  const isBlackTurn = game.current_player === BLACK
  const expectedPlayerId = isBlackTurn ? game.player_black_id : game.player_white_id
  if (playerId !== expectedPlayerId) return res.status(403).json({ error: 'Not your turn' })

  // Apply move using shared game logic
  let result
  try {
    result = applyMove(
      game.board, row, col, game.current_player,
      game.black_captures, game.white_captures
    )
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  // Update game state
  const update = {
    board: result.newBoard,
    current_player: result.nextPlayer,
    black_captures: result.blackCaptures,
    white_captures: result.whiteCaptures,
    last_move: [row, col],
    move_count: game.move_count + 1,
    updated_at: new Date().toISOString(),
  }

  if (result.winner) {
    update.winner = result.winner
    update.win_reason = result.winReason
    update.status = 'finished'
    // Increment winner's score
    if (result.winner === 'black') update.black_score = game.black_score + 1
    else update.white_score = game.white_score + 1
  }

  const { error: updateErr } = await supabase
    .from('games')
    .update(update)
    .eq('id', gameId)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // Record move in audit log
  await supabase.from('moves').insert({
    game_id: gameId,
    move_number: game.move_count + 1,
    player: game.current_player,
    row,
    col,
    captures: result.captured.length > 0 ? result.captured : null,
  })

  return res.status(200).json({ success: true, winner: result.winner, winReason: result.winReason })
}
