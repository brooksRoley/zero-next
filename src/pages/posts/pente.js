import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ScoreBoard from 'src/components/Scoreboard.js';
import GameLobby from 'src/components/GameLobby';
import MultiplayerStatus from 'src/components/MultiplayerStatus';
import confetti from 'canvas-confetti';
import useGameSounds from 'src/hooks/useGameSounds';
import usePlayerId from 'src/hooks/usePlayerId';
import useMultiplayerGame from 'src/hooks/useMultiplayerGame';
import { EMPTY, BLACK, WHITE } from 'src/lib/pente/constants';
import { createEmptyBoard, checkForFiveInARow, computeCaptures } from 'src/lib/pente/gameLogic';
import { PenteBot } from 'src/components/PentePlayerbot';
import { PenteTutor } from 'src/components/PenteTutor';
import PreText from 'src/components/PreText';

const GameBoard = () => {
  const router = useRouter();
  const gameId = router.query.game;
  const [mode, setMode] = useState(gameId ? 'online' : 'local');

  // Player identity
  const { playerId, playerName, setPlayerName } = usePlayerId();

  // ── Local state ──
  const [localBoard, setLocalBoard] = useState(() => createEmptyBoard());
  const [localCurrentPlayer, setLocalCurrentPlayer] = useState(BLACK);
  const [localBlackScore, setLocalBlackScore] = useState(0);
  const [localWhiteScore, setLocalWhiteScore] = useState(0);
  const [localBlackCaptures, setLocalBlackCaptures] = useState(0);
  const [localWhiteCaptures, setLocalWhiteCaptures] = useState(0);
  const [, setGameCount] = useState(0);
  const [localLastMove, setLocalLastMove] = useState(null);
  const [localMoveCount, setLocalMoveCount] = useState(0);
  const [rippleCell, setRippleCell] = useState(null);

  // ── Bot state ──
  const [botEnabled, setBotEnabled] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [botColor, setBotColor] = useState(WHITE);
  const bot = useMemo(() => new PenteBot(botColor), [botColor]);
  const tutor = useMemo(() => new PenteTutor(), []);

  // ── Tutor state ──
  const [tutorEnabled, setTutorEnabled] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [hintCell, setHintCell] = useState(null);
  const [hintExplanation, setHintExplanation] = useState(null);

  // ── Move history (for post-game analysis) ──
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameAnalysis, setGameAnalysis] = useState(null);
  const [analysisViewTurn, setAnalysisViewTurn] = useState(null);
  const [winner, setWinner] = useState(null);

  // ── Multiplayer state ──
  const mp = useMultiplayerGame(
    mode === 'online' ? gameId : null,
    playerId,
    playerName
  );

  // ── Derived state: pick source based on mode ──
  const isOnline = mode === 'online' && gameId;
  const board = isOnline ? mp.board : localBoard;
  const currentPlayer = isOnline ? mp.currentPlayer : localCurrentPlayer;
  const blackScore = isOnline ? mp.blackScore : localBlackScore;
  const whiteScore = isOnline ? mp.whiteScore : localWhiteScore;
  const blackCaptures = isOnline ? mp.blackCaptures : localBlackCaptures;
  const whiteCaptures = isOnline ? mp.whiteCaptures : localWhiteCaptures;
  const lastMove = isOnline ? mp.lastMove : localLastMove;
  const moveCount = isOnline ? mp.moveCount : localMoveCount;

  const boardRef = useRef(null);
  const { playPlace, playCapture, playWin } = useGameSounds();

  const triggerShake = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    el.classList.remove('board-shake');
    void el.offsetWidth;
    el.classList.add('board-shake');
  }, []);

  const triggerRipple = useCallback((row, col) => {
    setRippleCell(`${row}-${col}`);
    setTimeout(() => setRippleCell(null), 500);
  }, []);

  // ── Update evaluation bar after each move ──
  useEffect(() => {
    if (!isOnline && !gameOver) {
      const score = tutor.evaluateBoardState(localBoard, localWhiteCaptures, localBlackCaptures);
      setEvalScore(score);
    }
  }, [localBoard, localWhiteCaptures, localBlackCaptures, isOnline, gameOver, tutor]);

  // ── Auto-hint when tutor is enabled ──
  useEffect(() => {
    if (!tutorEnabled || gameOver || isOnline) return;
    if (botEnabled && localCurrentPlayer === botColor) return;

    const playerCaps = localCurrentPlayer === BLACK ? localBlackCaptures : localWhiteCaptures;
    const oppCaps = localCurrentPlayer === BLACK ? localWhiteCaptures : localBlackCaptures;
    const hint = tutor.getHint(
      localBoard.map(r => [...r]),
      localCurrentPlayer,
      playerCaps,
      oppCaps
    );
    setHintCell(hint.suggestedMove);
    setHintExplanation(hint.explanation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorEnabled, localCurrentPlayer, localBoard, localBlackCaptures, localWhiteCaptures, gameOver, isOnline, botEnabled, botColor, tutor]);

  // ── Bot auto-play when it's the bot's turn ──
  const botCaptures = botColor === BLACK ? localBlackCaptures : localWhiteCaptures;
  const humanCaptures = botColor === BLACK ? localWhiteCaptures : localBlackCaptures;
  useEffect(() => {
    if (!botEnabled || isOnline || gameOver) return;
    if (localCurrentPlayer !== botColor) return;

    setBotThinking(true);
    // Small delay so the UI updates before the bot "thinks"
    const timer = setTimeout(() => {
      const move = bot.getBestMove(
        localBoard.map(r => [...r]),
        botCaptures,
        humanCaptures
      );
      if (move) {
        handleLocalClick(move.row, move.col, true);
      }
      setBotThinking(false);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCurrentPlayer, botEnabled, botColor, isOnline, gameOver]);

  // ── Record move history ──
  const recordMove = useCallback((boardState, wCaps, bCaps, mover, row, col) => {
    setMoveHistory(prev => [...prev, {
      board: boardState.map(r => [...r]),
      whiteCaptures: wCaps,
      blackCaptures: bCaps,
      moveMadeBy: mover,
      row,
      col,
    }]);
  }, []);

  // ── Local move handler ──
  const handleLocalClick = (row, col, isBotMove = false) => {
    if (localBoard[row][col] !== EMPTY) return;
    if (gameOver) return;
    // If bot is enabled and it's bot's turn, block human clicks (but not the bot itself)
    if (botEnabled && localCurrentPlayer === botColor && !isBotMove) return;

    const newBoard = localBoard.map(r => [...r]);
    newBoard[row][col] = localCurrentPlayer;
    setLocalBoard(newBoard);
    setLocalLastMove([row, col]);
    setLocalMoveCount(prev => prev + 1);

    // Clear hint on move
    setHintCell(null);
    setHintExplanation(null);

    playPlace();
    triggerRipple(row, col);

    const { newBoard: boardAfterCaptures, capturedPairs } = computeCaptures(newBoard, row, col, localCurrentPlayer);
    if (capturedPairs > 0) {
      setLocalBoard(boardAfterCaptures);
      setTimeout(() => { playCapture(); triggerShake(); }, 100);
    }

    const newBlackCaps = localCurrentPlayer === BLACK ? localBlackCaptures + capturedPairs : localBlackCaptures;
    const newWhiteCaps = localCurrentPlayer === WHITE ? localWhiteCaptures + capturedPairs : localWhiteCaptures;
    if (localCurrentPlayer === BLACK) setLocalBlackCaptures(newBlackCaps);
    else setLocalWhiteCaptures(newWhiteCaps);

    const finalBoard = capturedPairs > 0 ? boardAfterCaptures : newBoard;

    // Record history
    recordMove(finalBoard, newWhiteCaps, newBlackCaps, localCurrentPlayer, row, col);

    if (newBlackCaps >= 5 || newWhiteCaps >= 5) {
      endLocalGame(`Player ${localCurrentPlayer === BLACK ? 'Black' : 'White'} wins by captures!`, localCurrentPlayer);
      return;
    }

    if (checkForFiveInARow(finalBoard, row, col, localCurrentPlayer)) {
      endLocalGame(`Player ${localCurrentPlayer === BLACK ? 'Black' : 'White'} wins with five in a row!`, localCurrentPlayer);
      return;
    }

    setLocalCurrentPlayer(localCurrentPlayer === BLACK ? WHITE : BLACK);
  };

  // ── Online move handler ──
  const handleOnlineClick = async (row, col) => {
    if (!mp.isMyTurn || board[row][col] !== EMPTY) return;

    playPlace();
    triggerRipple(row, col);

    const result = await mp.makeMove(row, col);
    if (result.winner) {
      playWin();
      confetti({
        particleCount: 150, spread: 90, origin: { y: 0.6 },
        colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
      });
    }
  };

  const handleClick = (row, col) => {
    if (isOnline) handleOnlineClick(row, col);
    else handleLocalClick(row, col);
  };

  const endLocalGame = (message, winningPlayer) => {
    playWin();
    confetti({
      particleCount: 150, spread: 90, origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
    });
    setGameOver(true);
    setWinner(winningPlayer);

    if (winningPlayer === BLACK) setLocalBlackScore(prev => prev + 1);
    else setLocalWhiteScore(prev => prev + 1);
    setGameCount(prev => prev + 1);
  };

  const resetLocalBoard = () => {
    setLocalBoard(createEmptyBoard());
    setLocalCurrentPlayer(BLACK);
    setLocalBlackCaptures(0);
    setLocalWhiteCaptures(0);
    setLocalLastMove(null);
    setLocalMoveCount(0);
    setRippleCell(null);
    setTutorEnabled(false);
    setHintCell(null);
    setHintExplanation(null);
    setEvalScore(0);
    setMoveHistory([]);
    setGameOver(false);
    setGameAnalysis(null);
    setAnalysisViewTurn(null);
    setWinner(null);
  };

  const handleAnalyze = () => {
    const humanColor = botEnabled ? (botColor === BLACK ? WHITE : BLACK) : BLACK;
    const analysis = tutor.analyzeGameHistory(moveHistory, humanColor);
    setGameAnalysis(analysis);
  };

  const handleToggleTutor = () => {
    const newVal = !tutorEnabled;
    setTutorEnabled(newVal);
    if (!newVal) {
      setHintCell(null);
      setHintExplanation(null);
    }
  };

  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c;
  const isHintCell = (r, c) => hintCell && hintCell.row === r && hintCell.col === c;
  const isBlackTurn = currentPlayer === BLACK;

  const showLobby = mode === 'online' && !gameId;
  const boardDisabled = isOnline && !mp.isMyTurn;

  // ── Evaluation bar ──
  const evalClamped = Math.max(-20000, Math.min(20000, evalScore));
  const evalPercent = ((evalClamped + 20000) / 40000) * 100; // 0% = Black winning, 100% = White winning

  // Board to display (analysis replay or live)
  const displayBoard = analysisViewTurn !== null && moveHistory[analysisViewTurn]
    ? moveHistory[analysisViewTurn].board
    : board;

  return (
    <div className="min-h-screen bg-forest-950">
      <Head>
        <title>Pente | Brooks Roley</title>
        <meta name="description" content="Play Pente — a classic 2-player strategy board game with captures and five-in-a-row." />
        <meta property="og:title" content="Pente | Brooks Roley" />
        <meta property="og:description" content="Play Pente — a classic 2-player strategy board game with captures and five-in-a-row." />
        <meta property="og:image" content="/marathon.png" />
      </Head>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Mode toggle */}
        <div className="flex items-center justify-center gap-1 mb-4 sm:mb-6">
          <Link
            href="/posts/pente-puzzles"
            className="px-4 py-1.5 text-sm rounded-l-lg border transition-colors bg-forest-900/60 text-candy-400 border-forest-700/40 hover:text-candy-300 hover:border-candy-400/30"
          >
            Puzzles
          </Link>
          <button
            onClick={() => { setMode('local'); setBotEnabled(false); resetLocalBoard(); if (gameId) router.push('/posts/pente', undefined, { shallow: true }); }}
            className={`px-4 py-1.5 text-sm border transition-colors ${
              mode === 'local' && !botEnabled
                ? 'bg-forest-700/60 text-white border-forest-600'
                : 'bg-forest-900/60 text-forest-400 border-forest-700/40 hover:text-forest-200'
            }`}
          >
            Local
          </button>
          <button
            onClick={() => { setMode('local'); setBotEnabled(true); resetLocalBoard(); }}
            className={`px-4 py-1.5 text-sm border transition-colors ${
              mode === 'local' && botEnabled
                ? 'bg-forest-700/60 text-white border-forest-600'
                : 'bg-forest-900/60 text-forest-400 border-forest-700/40 hover:text-forest-200'
            }`}
          >
            vs Bot
          </button>
          <button
            onClick={() => setMode('online')}
            className={`px-4 py-1.5 text-sm rounded-r-lg border transition-colors ${
              mode === 'online'
                ? 'bg-forest-700/60 text-white border-forest-600'
                : 'bg-forest-900/60 text-forest-400 border-forest-700/40 hover:text-forest-200'
            }`}
          >
            Online
          </button>
        </div>

        {/* Lobby (online, no game) */}
        {showLobby && (
          <GameLobby
            playerId={playerId}
            playerName={playerName}
            setPlayerName={setPlayerName}
          />
        )}

        {/* Multiplayer status bar */}
        {isOnline && mp.gameStatus !== 'loading' && mp.gameStatus !== 'error' && (
          <MultiplayerStatus
            gameStatus={mp.gameStatus}
            myColor={mp.myColor}
            isMyTurn={mp.isMyTurn}
            winner={mp.winner}
            winReason={mp.winReason}
            playerBlack={mp.playerBlack}
            playerWhite={mp.playerWhite}
            opponentConnected={mp.opponentConnected}
            opponentJustJoined={mp.opponentJustJoined}
            rematch={mp.rematch}
            gameId={gameId}
          />
        )}

        {isOnline && mp.gameStatus === 'error' && (
          <div className="rounded-xl bg-red-900/20 border border-red-700/40 p-4 text-center text-red-300 text-sm mb-4">
            {mp.error || 'Failed to load game'}
          </div>
        )}

        {/* Game board (hidden when showing lobby) */}
        {!showLobby && mp.gameStatus !== 'error' && (
          <>
            {/* Turn indicator + controls */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-0">
              <div className="flex items-center gap-3">
                <div
                  className={`turn-dot w-5 h-5 rounded-full border-2 transition-colors duration-300 ${
                    isBlackTurn
                      ? 'bg-gray-900 border-gray-600 text-gray-600'
                      : 'bg-white border-forest-300 text-forest-300'
                  }`}
                />
                <div className="flex items-center gap-2">
                  <PreText
                    text={`${isBlackTurn ? 'Black' : 'White'}'s turn`}
                    mode="pulse"
                    color={isBlackTurn ? '#d1d5db' : '#ffffff'}
                    fontSize="0.875rem"
                    fontWeight="600"
                  />
                  {botEnabled && currentPlayer === botColor && (
                    <span className="text-forest-500 text-sm">(Bot)</span>
                  )}
                  {botThinking && (
                    <PreText text="thinking..." mode="flow" color="#22d3ee" fontSize="0.875rem" />
                  )}
                </div>
                {moveCount > 0 && (
                  <span className="text-xs text-forest-500 ml-1">
                    Move {moveCount + 1}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Tutor Me toggle */}
                {!isOnline && !gameOver && (
                  <button
                    onClick={handleToggleTutor}
                    disabled={botEnabled && localCurrentPlayer === botColor}
                    className={`text-xs transition-colors px-3 py-1.5 rounded-md border disabled:opacity-40 disabled:cursor-not-allowed ${
                      tutorEnabled
                        ? 'text-cyan-300 bg-cyan-900/40 border-cyan-500/50'
                        : 'text-cyan-400 hover:text-cyan-300 border-cyan-700/40 hover:border-cyan-400/30'
                    }`}
                  >
                    {tutorEnabled ? 'Tutor On' : 'Tutor Me'}
                  </button>
                )}
                {!isOnline && (
                  <button
                    onClick={resetLocalBoard}
                    className="text-xs text-forest-400 hover:text-candy-400 transition-colors px-3 py-1.5 rounded-md border border-forest-700/40 hover:border-candy-400/30"
                  >
                    New Game
                  </button>
                )}
              </div>
            </div>

            {/* Hint explanation toast */}
            {hintExplanation && (
              <div className="mb-4 mx-2 sm:mx-0 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-4 py-3 text-sm flex items-start gap-3">
                <PreText
                  text="✦ Hint"
                  mode="pulse"
                  color="#22d3ee"
                  fontSize="0.75rem"
                  fontWeight="700"
                  className="shrink-0 mt-0.5"
                />
                <span className="text-cyan-200 flex-1">{hintExplanation}</span>
                <button
                  onClick={() => { setHintCell(null); setHintExplanation(null); }}
                  className="ml-auto text-cyan-500 hover:text-cyan-300 text-xs shrink-0"
                >
                  dismiss
                </button>
              </div>
            )}

            {/* Board + Eval Bar + Scoreboard */}
            <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-4 sm:gap-6">
              {/* Evaluation Bar */}
              {!isOnline && (
                <div className="hidden md:flex flex-col items-center gap-1">
                  <span className="text-[10px] text-forest-500 uppercase tracking-wider">Eval</span>
                  <div className="w-5 h-64 rounded-full bg-gray-900 border border-forest-700/40 overflow-hidden relative">
                    {/* White portion (bottom up) */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white to-gray-300 transition-all duration-500"
                      style={{ height: `${evalPercent}%` }}
                    />
                    {/* Black portion (top down) */}
                    <div
                      className="absolute top-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-700 transition-all duration-500"
                      style={{ height: `${100 - evalPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-forest-500">
                    {evalClamped > 0 ? '+' : ''}{(evalClamped / 1000).toFixed(1)}k
                  </span>
                </div>
              )}

              <div
                ref={boardRef}
                className={`game-board rounded-xl shadow-lg ${isBlackTurn ? 'board-hover-black' : 'board-hover-white'} ${boardDisabled ? 'opacity-90' : ''}`}
                style={boardDisabled ? { pointerEvents: 'none' } : undefined}
              >
                {displayBoard.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((cell, colIndex) => {
                      const cellKey = `${rowIndex}-${colIndex}`;
                      return (
                        <button
                          key={colIndex}
                          className={`flex-1 board-cell ${
                            cell === BLACK ? 'black' : cell === WHITE ? 'white' : ''
                          } ${isLastMove(rowIndex, colIndex) ? 'last-move' : ''
                          } ${rippleCell === cellKey ? 'ripple' : ''
                          } ${isHintCell(rowIndex, colIndex) ? 'hint-glow' : ''}`}
                          onClick={() => handleClick(rowIndex, colIndex)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <ScoreBoard
                blackScore={blackScore}
                whiteScore={whiteScore}
                blackCaptures={blackCaptures}
                whiteCaptures={whiteCaptures}
                currentPlayer={currentPlayer}
              />
            </div>

            {/* Mobile eval bar */}
            {!isOnline && (
              <div className="md:hidden flex items-center gap-2 mt-4 px-2">
                <span className="text-[10px] text-forest-500 w-6">B</span>
                <div className="flex-1 h-3 rounded-full bg-gray-900 border border-forest-700/40 overflow-hidden relative">
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-gray-700 to-gray-500 transition-all duration-500"
                    style={{ width: `${100 - evalPercent}%` }}
                  />
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-white to-gray-300 transition-all duration-500"
                    style={{ width: `${evalPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-forest-500 w-6 text-right">W</span>
              </div>
            )}

            {/* Game Over / Post-Game Analysis */}
            {gameOver && (
              <div className="mt-6 sm:mt-8 rounded-xl bg-forest-900/80 shadow-md border border-forest-700/40 p-4 sm:p-6 max-w-2xl mx-auto md:mx-0">
                <h2 className="text-lg font-semibold text-white mb-3">
                  {winner === BLACK ? 'Black' : 'White'} Wins!
                </h2>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={resetLocalBoard}
                    className="text-sm px-4 py-2 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
                  >
                    Play Again
                  </button>
                  {moveHistory.length > 0 && !gameAnalysis && (
                    <button
                      onClick={handleAnalyze}
                      className="text-sm px-4 py-2 rounded-lg bg-cyan-800/40 text-cyan-200 border border-cyan-700/40 hover:bg-cyan-700/40 transition-colors"
                    >
                      Analyze Game
                    </button>
                  )}
                </div>

                {/* Analysis results */}
                {gameAnalysis && (
                  <div>
                    <h3 className="text-sm font-semibold text-forest-200 mb-2">Move-by-Move Analysis</h3>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                      {gameAnalysis.map((entry, idx) => {
                        const isBlunder = entry.annotation.includes('Blunder');
                        const isMistake = entry.annotation.includes('Mistake');
                        const isViewing = analysisViewTurn === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setAnalysisViewTurn(isViewing ? null : idx)}
                            className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
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
                            <span className={`mr-2 ${
                              moveHistory[idx]?.moveMadeBy === BLACK ? 'text-gray-300' : 'text-white'
                            }`}>
                              {moveHistory[idx]?.moveMadeBy === BLACK ? 'Black' : 'White'}
                            </span>
                            <span className={
                              isBlunder ? 'text-red-400 font-semibold' :
                              isMistake ? 'text-yellow-400' :
                              'text-forest-400'
                            }>
                              {entry.annotation}
                            </span>
                            <span className="float-right text-forest-600">
                              eval: {(entry.evaluation / 1000).toFixed(1)}k
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {analysisViewTurn !== null && (
                      <p className="text-xs text-forest-500 mt-2">
                        Viewing board state after move #{analysisViewTurn + 1}.{' '}
                        <button
                          onClick={() => setAnalysisViewTurn(null)}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          Back to final board
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rules */}
            <div className="mt-6 sm:mt-10 rounded-xl bg-forest-900/80 shadow-md border border-forest-700/40 p-4 sm:p-6 max-w-2xl mx-auto md:mx-0">
              <h2 className="text-lg font-semibold text-white mb-3">Pente Rules</h2>
              <p className="text-sm text-forest-300 mb-3">
                Pente is a board game played on a 19x19 grid.
                The objective is to be the first player to either align five stones in a row or capture five pairs of your opponent&apos;s stones.
              </p>
              <ul className="text-sm text-forest-300 space-y-2 list-disc list-inside">
                <li><strong className="text-forest-100">Setup:</strong> Players choose colors and place stones on the intersections of the grid.</li>
                <li><strong className="text-forest-100">Turns:</strong> Players take turns placing one stone on an empty intersection.</li>
                <li><strong className="text-forest-100">Winning:</strong> Align five in a row (any direction) or capture five pairs.</li>
                <li><strong className="text-forest-100">Capturing:</strong> Flank a pair of opponent stones with yours in a straight line.</li>
                <li><strong className="text-forest-100">Pro Rules:</strong> First player&apos;s second move must be 3+ intersections from center.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
