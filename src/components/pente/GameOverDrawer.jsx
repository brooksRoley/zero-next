import React from 'react'
import Link from 'next/link'
import { track } from 'src/lib/analytics'
import { PLAYER_COLORS } from 'src/lib/pente/constants'

/**
 * The bottom drawer shown after a local (non-multiplayer) game ends —
 * winner banner, play-again/analyze actions, the move-by-move analysis
 * list, and the consulting CTA. Pure presentation over already-computed
 * game state; every mutation goes back up through the callback props.
 */
export default function GameOverDrawer({
  gameOver,
  isOnline,
  winner,
  gameMode,
  resetLocalBoard,
  moveHistory,
  gameAnalysis,
  handleAnalyze,
  analysisViewTurn,
  setAnalysisViewTurn,
  consultingCtaDismissed,
  setConsultingCtaDismissed,
  botEnabled,
  humanColor,
}) {
  if (!gameOver || isOnline) return null

  return (
    <div className="flex-shrink-0 border-t border-forest-700/40 bg-forest-900/90 px-4 py-3 max-h-56 overflow-y-auto">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: PLAYER_COLORS[winner]?.hex }}
          />
          {PLAYER_COLORS[winner]?.name || 'Unknown'} Wins!
          {gameMode?.teams && (
            <span className="text-xs text-forest-400 font-normal ml-1">
              (Team {gameMode.teams.findIndex(t => t.includes(winner)) + 1})
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={resetLocalBoard}
            className="text-xs px-3 py-1.5 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
          >
            Play Again
          </button>
          {moveHistory.length > 0 && !gameAnalysis && (!gameMode || gameMode.key === 'classic') && (
            <button
              onClick={handleAnalyze}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-800/40 text-cyan-200 border border-cyan-700/40 hover:bg-cyan-700/40 transition-colors"
            >
              Analyze
            </button>
          )}
        </div>
      </div>
      <Link
        href="/funding"
        onClick={() =>
          track('cta_click', {
            page: '/posts/pente',
            metadata: { location: 'pente_ingame_tip' },
            beacon: true,
          })
        }
        className="block mb-2.5 text-sm text-candy-500 hover:text-candy-400 transition-colors"
      >
        Enjoying Pente? Support development →
      </Link>

      {gameAnalysis && (
        <div className="space-y-1">
          {gameAnalysis.map((entry, idx) => {
            const isBlunder = entry.annotation.includes('Blunder');
            const isMistake = entry.annotation.includes('Mistake');
            const isViewing = analysisViewTurn === idx;
            const mover = moveHistory[idx]?.moveMadeBy;
            return (
              <button
                key={idx}
                onClick={() => setAnalysisViewTurn(isViewing ? null : idx)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isViewing
                    ? 'bg-forest-700/60 border border-forest-500'
                    : isBlunder
                      ? 'bg-red-900/30 border border-red-700/30 hover:bg-red-900/50'
                      : isMistake
                        ? 'bg-yellow-900/20 border border-yellow-700/30 hover:bg-yellow-900/40'
                        : 'bg-forest-900/40 border border-forest-700/20 hover:bg-forest-800/40'
                }`}
              >
                <span className="font-mono text-forest-400 mr-2">#{idx + 1}</span>
                <span style={{ color: PLAYER_COLORS[mover]?.hex || '#fff' }}>
                  {PLAYER_COLORS[mover]?.name || '?'}
                </span>
                <span className={`ml-2 ${
                  isBlunder ? 'text-red-400 font-semibold' :
                  isMistake ? 'text-yellow-400' :
                  'text-forest-400'
                }`}>
                  {entry.annotation}
                </span>
                <span className="float-right text-forest-600 font-mono">
                  {(entry.evaluation / 1000).toFixed(1)}k
                </span>
              </button>
            );
          })}
          {analysisViewTurn !== null && (
            <p className="text-xs text-forest-500 pt-1">
              Viewing move #{analysisViewTurn + 1}.{' '}
              <button
                onClick={() => setAnalysisViewTurn(null)}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Back to final
              </button>
            </p>
          )}
        </div>
      )}

      {!consultingCtaDismissed && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-candy-500/30 bg-forest-900/60 px-3 py-2.5">
          <p className="flex-1 text-xs text-forest-200 leading-snug">
            Enjoying the game? I build stuff like this professionally.{' '}
            <Link
              href="/consulting"
              onClick={() => {
                const result = botEnabled
                  ? (winner === humanColor ? 'win' : 'loss')
                  : 'win';
                track('consulting_from_game', {
                  page: '/posts/pente',
                  metadata: { game: 'pente', result },
                  beacon: true,
                });
              }}
              className="font-semibold text-candy-300 hover:text-candy-200 transition-colors whitespace-nowrap"
            >
              Work with me →
            </Link>
          </p>
          <button
            onClick={() => setConsultingCtaDismissed(true)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-forest-500 hover:text-forest-300 transition-colors text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
