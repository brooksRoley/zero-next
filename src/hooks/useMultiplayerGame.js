import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from 'src/lib/supabase'
import { BLACK, WHITE } from 'src/lib/pente/constants'
import { createEmptyBoard } from 'src/lib/pente/gameLogic'

export default function useMultiplayerGame(gameId, playerId, playerName) {
  const [board, setBoard] = useState(createEmptyBoard)
  const [currentPlayer, setCurrentPlayer] = useState(BLACK)
  const [blackScore, setBlackScore] = useState(0)
  const [whiteScore, setWhiteScore] = useState(0)
  const [blackCaptures, setBlackCaptures] = useState(0)
  const [whiteCaptures, setWhiteCaptures] = useState(0)
  const [lastMove, setLastMove] = useState(null)
  const [moveCount, setMoveCount] = useState(0)
  const [gameStatus, setGameStatus] = useState('loading')
  const [myColor, setMyColor] = useState(null)
  const [winner, setWinner] = useState(null)
  const [winReason, setWinReason] = useState(null)
  const [playerBlack, setPlayerBlack] = useState('')
  const [playerWhite, setPlayerWhite] = useState('')
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [error, setError] = useState(null)
  const [opponentJustJoined, setOpponentJustJoined] = useState(false)

  const channelRef = useRef(null)
  const presenceRef = useRef(null)
  const prevStatusRef = useRef(null)

  const syncGameState = useCallback((game) => {
    // Detect opponent joining: status went from waiting to in_progress
    if (prevStatusRef.current === 'waiting' && game.status === 'in_progress') {
      setOpponentJustJoined(true)
      setTimeout(() => setOpponentJustJoined(false), 4000)
    }
    prevStatusRef.current = game.status

    setBoard(game.board)
    setCurrentPlayer(game.current_player)
    setBlackScore(game.black_score)
    setWhiteScore(game.white_score)
    setBlackCaptures(game.black_captures)
    setWhiteCaptures(game.white_captures)
    setLastMove(game.last_move)
    setMoveCount(game.move_count)
    setGameStatus(game.status)
    setWinner(game.winner)
    setWinReason(game.win_reason)
    setPlayerBlack(game.player_black || 'Black')
    setPlayerWhite(game.player_white || 'White')

    // Determine my color
    if (playerId) {
      if (game.player_black_id === playerId) setMyColor(BLACK)
      else if (game.player_white_id === playerId) setMyColor(WHITE)
      else setMyColor(null) // spectator
    }
  }, [playerId])

  // Fetch initial state + subscribe
  useEffect(() => {
    if (!gameId || !playerId || !supabase) return

    let cancelled = false

    async function init() {
      const { data, error: fetchErr } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (cancelled) return
      if (fetchErr || !data) {
        setError('Game not found')
        setGameStatus('error')
        return
      }
      syncGameState(data)

      // Auto-join if game is waiting and we're not the creator
      if (data.status === 'waiting' && data.player_black_id !== playerId) {
        try {
          const resp = await fetch('/api/pente/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId,
              playerId,
              playerName: playerName || 'White',
            }),
          })
          if (cancelled) return
          const result = await resp.json()
          if (result.game) syncGameState(result.game)
        } catch (e) {
          // Join failed — they'll stay as spectator
        }
      }
    }

    init()

    // Realtime subscription for game state changes
    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        syncGameState(payload.new)
      })
      .subscribe()

    channelRef.current = channel

    // Presence for connection tracking
    const presence = supabase
      .channel(`presence:${gameId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState()
        const users = Object.values(state).flat()
        const otherOnline = users.some(u => u.playerId !== playerId)
        setOpponentConnected(otherOnline)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ playerId })
        }
      })

    presenceRef.current = presence

    return () => {
      cancelled = true
      if (supabase && channelRef.current) supabase.removeChannel(channelRef.current)
      if (supabase && presenceRef.current) supabase.removeChannel(presenceRef.current)
    }
  }, [gameId, playerId, playerName, syncGameState])

  const isMyTurn = myColor === currentPlayer && gameStatus === 'in_progress'

  const makeMove = useCallback(async (row, col) => {
    if (!isMyTurn) return { success: false, error: 'Not your turn' }

    try {
      const resp = await fetch('/api/pente/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, row, col }),
      })
      const data = await resp.json()
      if (!resp.ok) return { success: false, error: data.error }
      return { success: true, winner: data.winner, winReason: data.winReason }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [gameId, playerId, isMyTurn])

  const rematch = useCallback(async () => {
    if (gameStatus !== 'finished' || !supabase) return
    await supabase
      .from('games')
      .update({
        board: createEmptyBoard(),
        current_player: BLACK,
        black_captures: 0,
        white_captures: 0,
        last_move: null,
        move_count: 0,
        winner: null,
        win_reason: null,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
  }, [gameId, gameStatus])

  return {
    board, currentPlayer, blackScore, whiteScore,
    blackCaptures, whiteCaptures, lastMove, moveCount,
    gameStatus, myColor, isMyTurn, winner, winReason,
    playerBlack, playerWhite, opponentConnected,
    opponentJustJoined, error, makeMove, rematch,
  }
}
