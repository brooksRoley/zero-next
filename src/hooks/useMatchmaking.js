// src/hooks/useMatchmaking.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from 'src/lib/supabase'

const STALE_MINUTES = 10
const CONFIRM_SECONDS = 15
const POLL_INTERVAL_MS = 3000

export default function useMatchmaking(playerId, playerName, playerElo) {
  const [queueStatus, setQueueStatus] = useState('idle') // idle | queuing | matched | confirming
  const [opponent, setOpponent] = useState(null) // { name, elo }
  const [matchedGameId, setMatchedGameId] = useState(null)
  const [confirmTimer, setConfirmTimer] = useState(0)
  const [queueRowId, setQueueRowId] = useState(null)

  const channelRef = useRef(null)
  const pollRef = useRef(null)
  const timerRef = useRef(null)

  // Clean up realtime subscription
  const cleanupChannel = useCallback(() => {
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  // Clean up polling
  const cleanupPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Clean up confirm timer
  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Enter the matchmaking queue
  const enterQueue = useCallback(async () => {
    if (!supabase || !playerId || queueStatus !== 'idle') return

    // Insert into queue
    const { data, error } = await supabase
      .from('matchmaking_queue')
      .insert({
        player_id: playerId,
        player_name: playerName || 'Anonymous',
        player_elo: playerElo,
        status: 'waiting',
      })
      .select('id')
      .single()

    if (error || !data) return

    const rowId = data.id
    setQueueRowId(rowId)
    setQueueStatus('queuing')

    // Subscribe to realtime changes on our queue row
    const channel = supabase
      .channel(`queue:${rowId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `id=eq.${rowId}`,
      }, (payload) => {
        const row = payload.new
        if (row.status === 'matched' && row.matched_game_id) {
          // We got matched by someone else's claim
          setMatchedGameId(row.matched_game_id)
          setQueueStatus('confirming')
          cleanupPoll()
          // We need opponent info — fetch from the game
          fetchOpponentFromGame(row.matched_game_id)
        }
      })
      .subscribe()

    channelRef.current = channel

    // Poll for waiting opponents to claim
    const poll = async () => {
      if (!supabase) return
      const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()
      const { data: waiters } = await supabase
        .from('matchmaking_queue')
        .select('id, player_id, player_name, player_elo')
        .eq('status', 'waiting')
        .neq('player_id', playerId)
        .gt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(1)

      if (!waiters || waiters.length === 0) return

      const target = waiters[0]
      const { data: gameId } = await supabase.rpc('claim_match', {
        p_claimer_id: playerId,
        p_claimer_name: playerName || 'Anonymous',
        p_claimer_elo: playerElo,
        p_target_queue_id: target.id,
      })

      if (gameId) {
        setOpponent({ name: target.player_name, elo: target.player_elo })
        setMatchedGameId(gameId)
        setQueueStatus('confirming')
        cleanupPoll()
      }
    }

    // First poll immediately, then on interval
    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, playerName, playerElo, queueStatus, cleanupPoll])

  // Fetch opponent info from the game row (when matched by the other player)
  const fetchOpponentFromGame = useCallback(async (gameId) => {
    if (!supabase) return
    const { data: game } = await supabase
      .from('games')
      .select('player_black, player_white, player_black_id, player_white_id')
      .eq('id', gameId)
      .single()

    if (!game) return

    // The opponent is whichever player isn't us
    if (game.player_black_id === playerId) {
      setOpponent({ name: game.player_white, elo: playerElo }) // approx
    } else {
      setOpponent({ name: game.player_black, elo: playerElo })
    }
  }, [playerId, playerElo])

  // Start confirm countdown when entering confirming state
  useEffect(() => {
    if (queueStatus !== 'confirming') {
      cleanupTimer()
      return
    }

    setConfirmTimer(CONFIRM_SECONDS)
    timerRef.current = setInterval(() => {
      setConfirmTimer(prev => {
        if (prev <= 1) {
          // Timeout — treat as decline
          handleDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return cleanupTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueStatus])

  // Accept match — navigate to game
  const acceptMatch = useCallback(() => {
    cleanupTimer()
    cleanupChannel()
    cleanupPoll()
    setQueueStatus('idle')
    // matchedGameId stays set — the page reads it to navigate
  }, [cleanupTimer, cleanupChannel, cleanupPoll])

  // Decline match — back to queuing
  const handleDecline = useCallback(async () => {
    cleanupTimer()

    // Reset match state
    setOpponent(null)
    setMatchedGameId(null)
    setQueueStatus('idle')
    cleanupChannel()
    cleanupPoll()

    // Cancel the old queue row
    if (supabase && queueRowId) {
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueRowId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupTimer, cleanupChannel, cleanupPoll, queueRowId])

  const declineMatch = useCallback(() => {
    handleDecline()
  }, [handleDecline])

  // Leave queue entirely
  const leaveQueue = useCallback(async () => {
    cleanupChannel()
    cleanupPoll()
    cleanupTimer()

    if (supabase && queueRowId) {
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueRowId)
    }

    setQueueStatus('idle')
    setOpponent(null)
    setMatchedGameId(null)
    setQueueRowId(null)
    setConfirmTimer(0)
  }, [cleanupChannel, cleanupPoll, cleanupTimer, queueRowId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannel()
      cleanupPoll()
      cleanupTimer()
    }
  }, [cleanupChannel, cleanupPoll, cleanupTimer])

  return {
    queueStatus,
    opponent,
    matchedGameId,
    confirmTimer,
    enterQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
  }
}
