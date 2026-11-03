import React from 'react'
import { WHITE, PLAYER_COLORS } from 'src/lib/pente/constants'

/**
 * Turn indicator + per-player score/capture row under the header. Pure
 * presentation over already-derived state — no game logic, no callbacks.
 */
export default function TurnStatusBar({
  showLobby,
  gameStatus,
  currentPlayer,
  playerName,
  botEnabled,
  humanColor,
  botThinking,
  moveCount,
  lastBotStats,
  showEngineStats = false,
  activePlayers,
  gameMode,
  captures,
}) {
  if (showLobby || gameStatus === 'error') return null

  return (
    <div className="flex items-center px-3 pb-2 gap-2">
      {/* Turn dot */}
      <div
        className="turn-dot w-3 h-3 rounded-full shrink-0 transition-colors duration-300"
        style={{
          backgroundColor: PLAYER_COLORS[currentPlayer]?.hex || '#1a1a1a',
          boxShadow: currentPlayer === WHITE ? 'none' : '0 0 0 1px rgba(233,227,214,0.35)',
        }}
      />
      <span className="text-[#E9E3D6] text-xs font-medium leading-none">
        {playerName}
        {botEnabled && currentPlayer !== humanColor ? ' (Bot)' : ''}
        {botThinking ? '…' : '’s turn'}
      </span>
      {moveCount > 0 && (
        <span className="text-ink-400 text-xs font-mono">#{moveCount}</span>
      )}
      {/* Search depth and node count are for the curious: shown only with the Tutor on. */}
      {showEngineStats && lastBotStats && botEnabled && !botThinking && (
        <span className="text-ink-400 text-xs font-mono" title="Engine search depth / nodes evaluated">
          d{lastBotStats.depth} {lastBotStats.nodes > 1000 ? `${(lastBotStats.nodes / 1000).toFixed(1)}k` : lastBotStats.nodes}n
        </span>
      )}

      {/* Score + captures — right-aligned */}
      <div className="ml-auto flex items-center gap-2 text-xs font-mono" title="Captured pairs">
        {/* Compact score display for all active players */}
        {activePlayers.map((p, i) => (
          <span key={p} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-ink-400 mx-1" aria-hidden>{i === 1 ? '–' : ':'}</span>}
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: PLAYER_COLORS[p]?.hex }}
            />
            <span style={{ color: currentPlayer === p ? '#E9E3D6' : '#BCB8B3' }}>
              {gameMode?.teams
                ? (captures[`team${gameMode.teams.findIndex(t => t.includes(p))}`] || 0)
                : (captures[p] || 0)
              }
            </span>
            <span className="text-ink-400">/{gameMode?.captureThreshold || 5}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
