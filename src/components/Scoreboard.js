import React from 'react';
import { BLACK, WHITE, RED, BLUE, PLAYER_COLORS, getTeamIndex } from 'src/lib/pente/constants';

/**
 * Dynamic N-player scoreboard.
 * In classic mode, renders the familiar 2-panel layout.
 * In multi-player modes, renders a card per player (grouped by team in 2v2).
 */
const ScoreBoard = ({
  players = [BLACK, WHITE],
  captures = {},
  currentPlayer,
  gameMode = null,
  scores = {},
}) => {
  const isTeamMode = !!gameMode?.teams;

  // Background/text styles per player color
  const cardStyle = (player) => {
    switch (player) {
      case BLACK: return { bg: 'bg-forest-950', text: 'text-white', score: 'text-white', capText: 'text-forest-400', accent: 'text-candy-400' };
      case WHITE: return { bg: 'bg-forest-100', text: 'text-forest-900', score: 'text-forest-900', capText: 'text-forest-500', accent: 'text-candy-600' };
      case RED:   return { bg: 'bg-red-950', text: 'text-red-100', score: 'text-red-100', capText: 'text-red-300', accent: 'text-candy-400' };
      case BLUE:  return { bg: 'bg-blue-950', text: 'text-blue-100', score: 'text-blue-100', capText: 'text-blue-300', accent: 'text-candy-400' };
      default:    return { bg: 'bg-forest-900', text: 'text-white', score: 'text-white', capText: 'text-forest-400', accent: 'text-candy-400' };
    }
  };

  const isTurn = (player) => player === currentPlayer;

  // Get capture count for a player
  const getCaptures = (player) => {
    if (isTeamMode) {
      const teamIdx = getTeamIndex(player, gameMode);
      return captures[`team${teamIdx}`] || 0;
    }
    return captures[player] || 0;
  };

  const threshold = gameMode?.captureThreshold || 5;

  // Classic 2-player layout
  if (players.length === 2 && !gameMode) {
    return (
      <div className="rounded-xl bg-forest-900/80 backdrop-blur-sm shadow-lg border border-forest-700/40 p-4 sm:p-5 w-full md:w-56">
        <div className="flex md:flex-col gap-4 sm:gap-0">
          {/* Score */}
          <div className="flex-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3 sm:mb-4">Score</h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:mb-6">
              {players.map(player => {
                const s = cardStyle(player);
                const turn = isTurn(player);
                return (
                  <div key={player} className={`rounded-lg ${s.bg} p-2 sm:p-3 text-center transition-all duration-300 ${
                    turn ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10' : 'border border-forest-700/30'
                  }`}>
                    <p className={`text-xl sm:text-2xl font-bold ${s.score}`}>{scores[player] || 0}</p>
                    <p className={`text-xs ${s.capText} mt-1 flex items-center justify-center gap-1`}>
                      {turn && <span className="w-1.5 h-1.5 rounded-full bg-candy-400 inline-block" />}
                      {PLAYER_COLORS[player]?.name || `P${player}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Captures */}
          <div className="flex-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3 sm:mb-4">Captures</h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {players.map(player => {
                const s = cardStyle(player);
                const turn = isTurn(player);
                return (
                  <div key={player} className={`rounded-lg ${s.bg} p-2 sm:p-3 text-center transition-all duration-300 ${
                    turn ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10' : 'border border-forest-700/30'
                  }`}>
                    <p className={`text-xl sm:text-2xl font-bold ${s.score}`}>
                      {getCaptures(player)}<span className={`text-xs sm:text-sm ${s.accent}`}>/{threshold}</span>
                    </p>
                    <p className={`text-xs ${s.capText} mt-1`}>{PLAYER_COLORS[player]?.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-player layout (FFA or teams)
  if (isTeamMode) {
    // Group players by team
    const teams = gameMode.teams.map((team, idx) => ({
      idx,
      players: team,
      captures: captures[`team${idx}`] || 0,
    }));

    return (
      <div className="rounded-xl bg-forest-900/80 backdrop-blur-sm shadow-lg border border-forest-700/40 p-3 sm:p-4 w-full md:w-64">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3">Teams</h2>
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.idx} className="rounded-lg bg-forest-950/60 border border-forest-700/30 p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-forest-500 uppercase tracking-wider">Team {team.idx + 1}</span>
                <span className="ml-auto text-xs font-mono text-forest-300">
                  Captures: {team.captures}/{threshold}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {team.players.map(player => {
                  const s = cardStyle(player);
                  const turn = isTurn(player);
                  return (
                    <div key={player} className={`rounded-md ${s.bg} p-2 text-center transition-all duration-300 ${
                      turn ? 'border-2 border-candy-400/50 shadow-sm shadow-candy-400/10' : 'border border-forest-700/20'
                    }`}>
                      <div className="flex items-center justify-center gap-1">
                        {turn && <span className="w-1.5 h-1.5 rounded-full bg-candy-400 shrink-0" />}
                        <span className={`text-xs font-medium ${s.text}`}>{PLAYER_COLORS[player]?.name}</span>
                      </div>
                      <p className={`text-sm font-bold ${s.score} mt-1`}>{scores[player] || 0}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // FFA layout
  return (
    <div className="rounded-xl bg-forest-900/80 backdrop-blur-sm shadow-lg border border-forest-700/40 p-3 sm:p-4 w-full md:w-64">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3">Players</h2>
      <div className="grid grid-cols-2 gap-2">
        {players.map(player => {
          const s = cardStyle(player);
          const turn = isTurn(player);
          return (
            <div key={player} className={`rounded-lg ${s.bg} p-2.5 text-center transition-all duration-300 ${
              turn ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10' : 'border border-forest-700/30'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                {turn && <span className="w-1.5 h-1.5 rounded-full bg-candy-400 shrink-0" />}
                <span className={`text-xs font-medium ${s.text}`}>{PLAYER_COLORS[player]?.name}</span>
              </div>
              <p className={`text-lg font-bold ${s.score}`}>{scores[player] || 0}</p>
              <p className={`text-xs ${s.capText} mt-1`}>
                Captures: {getCaptures(player)}/{threshold}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreBoard;
