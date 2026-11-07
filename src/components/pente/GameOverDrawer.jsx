// @ts-check
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
    <div className="flex-shrink-0 bg-[#141F30]/80 backdrop-blur px-4 py-3 max-h-56 overflow-y-auto">
      <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold text-[#E9E3D6] flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: PLAYER_COLORS[winner]?.hex }}
          />
          {PLAYER_COLORS[winner]?.name || 'Unknown'} Wins!
          {gameMode?.teams && (
            <span className="text-xs text-ink-400 font-normal ml-1">
              (Team {gameMode.teams.findIndex(t => t.includes(winner)) + 1})
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={resetLocalBoard}
            className="text-xs px-4 py-2 rounded-full bg-[#966F2F]/80 text-white font-semibold hover:bg-[#966F2F] transition-colors"
          >
            Play Again
          </button>
          {moveHistory.length > 0 && !gameAnalysis && (!gameMode || gameMode.key === 'classic') && (
            <button
              onClick={handleAnalyze}
              className="text-xs px-4 py-2 rounded-full bg-[#E9E3D6]/[0.08] text-[#E9E3D6] hover:bg-[#E9E3D6]/[0.14] transition-colors"
            >
              Analyze
            </button>
          )}
        </div>
      </div>

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
                    ? 'bg-[#E9E3D6]/[0.12]'
                    : isBlunder
                      ? 'bg-red-900/25 hover:bg-red-900/40'
                      : isMistake
                        ? 'bg-yellow-900/20 hover:bg-yellow-900/35'
                        : 'hover:bg-[#E9E3D6]/[0.06]'
                }`}
              >
                <span className="font-mono text-ink-400 mr-2">#{idx + 1}</span>
                <span style={{ color: PLAYER_COLORS[mover]?.hex || '#fff' }}>
                  {PLAYER_COLORS[mover]?.name || '?'}
                </span>
                <span className={`ml-2 ${
                  isBlunder ? 'text-red-400 font-semibold' :
                  isMistake ? 'text-yellow-400' :
                  'text-ink-400'
                }`}>
                  {entry.annotation}
                </span>
                <span className="float-right text-ink-400 font-mono">
                  {(entry.evaluation / 1000).toFixed(1)}k
                </span>
              </button>
            );
          })}
          {analysisViewTurn !== null && (
            <p className="text-xs text-ink-400 pt-1">
              Viewing move #{analysisViewTurn + 1}.{' '}
              <button
                onClick={() => setAnalysisViewTurn(null)}
                className="text-brass-300 hover:text-brass-200"
              >
                Back to final
              </button>
            </p>
          )}
        </div>
      )}

      {!consultingCtaDismissed && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#E9E3D6]/[0.05] px-4 py-2.5">
          <p className="flex-1 text-xs text-ink-200 leading-snug">
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
              className="font-semibold text-brass-300 hover:text-brass-200 transition-colors whitespace-nowrap"
            >
              Work with me →
            </Link>
          </p>
          <button
            onClick={() => setConsultingCtaDismissed(true)}
            aria-label="Dismiss"
            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-300 hover:text-[#E9E3D6] transition-colors text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
