import { useState } from 'react'
import { BLACK } from 'src/lib/pente/constants'

export default function MultiplayerStatus({
  gameStatus, myColor, isMyTurn, winner, winReason,
  playerBlack, playerWhite, opponentConnected, opponentJustJoined, rematch, gameId,
}) {
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    const url = `${window.location.origin}/posts/pente?game=${gameId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const myColorName = myColor === BLACK ? 'Black' : myColor ? 'White' : 'Spectator'
  const myStoneClass = myColor === BLACK
    ? 'bg-gray-900 border-gray-600'
    : myColor
    ? 'bg-white border-ink-300'
    : 'bg-ink-600 border-ink-400'

  return (
    <div className="rounded-xl bg-ink-900/80 border border-ink-700/40 px-4 py-3 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* My color */}
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full border-2 ${myStoneClass}`} />
          <span className="text-sm text-ink-200">
            You are <span className="text-white font-semibold">{myColorName}</span>
          </span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${opponentConnected ? 'bg-green-400' : 'bg-ink-600'}`} />
          <span className="text-xs text-ink-400">
            {gameStatus === 'waiting'
              ? 'Waiting for opponent'
              : opponentConnected
              ? 'Opponent connected'
              : 'Opponent disconnected'}
          </span>
        </div>
      </div>

      {/* Opponent joined notification */}
      {opponentJustJoined && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-sm text-green-300 font-medium animate-pulse">
          {playerWhite} has joined the game!
        </div>
      )}

      {/* Share link when waiting */}
      {gameStatus === 'waiting' && (
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={typeof window !== 'undefined' ? `${window.location.origin}/posts/pente?game=${gameId}` : ''}
            className="flex-1 px-2 py-1.5 rounded-md bg-ink-950 border border-ink-700/30 text-xs text-ink-300 font-mono truncate"
          />
          <button
            onClick={copyLink}
            className="text-xs px-3 py-1.5 rounded-md bg-ink-700/40 text-brass-300 hover:bg-brass-500/20 transition-colors whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}

      {/* Turn indicator */}
      {gameStatus === 'in_progress' && myColor && (
        <div className={`mt-2 text-sm font-medium ${isMyTurn ? 'text-brass-300' : 'text-ink-400'}`}>
          {isMyTurn ? 'Your turn' : `Waiting for ${myColor === BLACK ? playerWhite : playerBlack}...`}
        </div>
      )}

      {/* Game over */}
      {gameStatus === 'finished' && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-white font-semibold">
            {winner === 'black' ? playerBlack : playerWhite} wins
            {winReason === 'five_in_a_row' ? ' with five in a row!' : ' by captures!'}
          </span>
          {myColor && (
            <button
              onClick={rematch}
              className="text-xs px-3 py-1.5 rounded-md bg-brass-500/20 text-brass-300 hover:bg-brass-500/30 transition-colors"
            >
              Rematch
            </button>
          )}
        </div>
      )}
    </div>
  )
}
