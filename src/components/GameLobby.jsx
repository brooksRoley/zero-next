import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from 'src/lib/supabase'

export default function GameLobby({ playerId, playerName, setPlayerName }) {
  const router = useRouter()
  const [name, setName] = useState(playerName)
  const [creating, setCreating] = useState(false)
  const [openGames, setOpenGames] = useState([])
  const [joining, setJoining] = useState(null)

  useEffect(() => {
    async function fetchOpen() {
      const { data } = await supabase
        .from('games')
        .select('id, player_black, created_at')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setOpenGames(data)
    }
    fetchOpen()
    const interval = setInterval(fetchOpen, 5000)
    return () => clearInterval(interval)
  }, [])

  const createGame = async () => {
    if (!playerId) return
    const displayName = name.trim() || 'Black'
    setPlayerName(displayName)
    setCreating(true)
    try {
      const resp = await fetch('/api/pente/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName: displayName }),
      })
      const data = await resp.json()
      if (data.gameId) router.push(`/posts/pente?game=${data.gameId}`)
    } catch (e) {
      setCreating(false)
    }
  }

  const joinGame = async (gameId) => {
    if (!playerId) return
    const displayName = name.trim() || 'White'
    setPlayerName(displayName)
    setJoining(gameId)
    try {
      const resp = await fetch('/api/pente/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, playerName: displayName }),
      })
      const data = await resp.json()
      if (data.game) router.push(`/posts/pente?game=${gameId}`)
      else setJoining(null)
    } catch (e) {
      setJoining(null)
    }
  }

  return (
    <div className="rounded-xl bg-forest-900/80 border border-forest-700/40 p-5 max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-white mb-4">Play Online</h2>

      {/* Name input */}
      <div className="mb-4">
        <label className="text-xs text-forest-400 uppercase tracking-wider mb-1 block">Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name..."
          maxLength={20}
          className="w-full px-3 py-2 rounded-lg bg-forest-950 border border-forest-700/40 text-white text-sm focus:outline-none focus:border-candy-400/50"
        />
      </div>

      {/* Create */}
      <button
        onClick={createGame}
        disabled={creating}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold text-sm hover:from-candy-400 hover:to-candy-500 transition-all disabled:opacity-50"
      >
        {creating ? 'Creating...' : 'Create Game'}
      </button>

      {/* Open games */}
      {openGames.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs text-forest-400 uppercase tracking-wider mb-2">Open Games</h3>
          <div className="space-y-2">
            {openGames.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-forest-950 border border-forest-700/30"
              >
                <div>
                  <span className="text-sm text-white">{g.player_black}</span>
                  <span className="text-xs text-forest-500 ml-2">
                    {new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button
                  onClick={() => joinGame(g.id)}
                  disabled={joining === g.id}
                  className="text-xs px-3 py-1 rounded-md bg-forest-700/40 text-candy-300 hover:bg-candy-500/20 transition-colors disabled:opacity-50"
                >
                  {joining === g.id ? 'Joining...' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
