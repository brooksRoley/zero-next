import React, { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
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

  // ── Local move handler ──
  const handleLocalClick = (row, col) => {
    if (localBoard[row][col] !== EMPTY) return;

    const newBoard = localBoard.map(r => [...r]);
    newBoard[row][col] = localCurrentPlayer;
    setLocalBoard(newBoard);
    setLocalLastMove([row, col]);
    setLocalMoveCount(prev => prev + 1);

    playPlace();
    triggerRipple(row, col);

    const { newBoard: boardAfterCaptures, capturedPairs } = computeCaptures(newBoard, row, col, localCurrentPlayer);
    if (capturedPairs > 0) {
      setLocalBoard(boardAfterCaptures);
      setTimeout(() => { playCapture(); triggerShake(); }, 100);
    }

    // Check capture win
    const newBlackCaps = localCurrentPlayer === BLACK ? localBlackCaptures + capturedPairs : localBlackCaptures;
    const newWhiteCaps = localCurrentPlayer === WHITE ? localWhiteCaptures + capturedPairs : localWhiteCaptures;
    if (localCurrentPlayer === BLACK) setLocalBlackCaptures(newBlackCaps);
    else setLocalWhiteCaptures(newWhiteCaps);

    if (newBlackCaps >= 5 || newWhiteCaps >= 5) {
      endLocalGame(`Player ${localCurrentPlayer === BLACK ? 'Black' : 'White'} wins by captures!`);
      return;
    }

    // Check five in a row (use board after captures for accuracy)
    const finalBoard = capturedPairs > 0 ? boardAfterCaptures : newBoard;
    if (checkForFiveInARow(finalBoard, row, col, localCurrentPlayer)) {
      endLocalGame(`Player ${localCurrentPlayer === BLACK ? 'Black' : 'White'} wins with five in a row!`);
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

  const endLocalGame = (message) => {
    playWin();
    confetti({
      particleCount: 150, spread: 90, origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
    });
    alert(message);
    if (localCurrentPlayer === BLACK) setLocalBlackScore(prev => prev + 1);
    else setLocalWhiteScore(prev => prev + 1);
    setGameCount(prev => prev + 1);
    resetLocalBoard();
  };

  const resetLocalBoard = () => {
    setLocalBoard(createEmptyBoard());
    setLocalCurrentPlayer(BLACK);
    setLocalBlackCaptures(0);
    setLocalWhiteCaptures(0);
    setLocalLastMove(null);
    setLocalMoveCount(0);
    setRippleCell(null);
  };

  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c;
  const isBlackTurn = currentPlayer === BLACK;

  // Show lobby if online mode but no game ID
  const showLobby = mode === 'online' && !gameId;

  // Disable board when it's not your turn in online mode
  const boardDisabled = isOnline && !mp.isMyTurn;

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
          <button
            onClick={() => { setMode('local'); if (gameId) router.push('/posts/pente', undefined, { shallow: true }); }}
            className={`px-4 py-1.5 text-sm rounded-l-lg border transition-colors ${
              mode === 'local'
                ? 'bg-forest-700/60 text-white border-forest-600'
                : 'bg-forest-900/60 text-forest-400 border-forest-700/40 hover:text-forest-200'
            }`}
          >
            Local
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
            {/* Turn indicator */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-0">
              <div className="flex items-center gap-3">
                <div
                  className={`turn-dot w-5 h-5 rounded-full border-2 transition-colors duration-300 ${
                    isBlackTurn
                      ? 'bg-gray-900 border-gray-600 text-gray-600'
                      : 'bg-white border-forest-300 text-forest-300'
                  }`}
                />
                <p className="text-sm font-medium text-forest-200">
                  <span className="font-semibold text-white">{isBlackTurn ? 'Black' : 'White'}</span>&apos;s turn
                </p>
                {moveCount > 0 && (
                  <span className="text-xs text-forest-500 ml-1">
                    Move {moveCount + 1}
                  </span>
                )}
              </div>
              {!isOnline && (
                <button
                  onClick={resetLocalBoard}
                  className="text-xs text-forest-400 hover:text-candy-400 transition-colors px-3 py-1.5 rounded-md border border-forest-700/40 hover:border-candy-400/30"
                >
                  New Game
                </button>
              )}
            </div>

            {/* Board + Scoreboard */}
            <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-4 sm:gap-6">
              <div
                ref={boardRef}
                className={`game-board rounded-xl shadow-lg ${isBlackTurn ? 'board-hover-black' : 'board-hover-white'} ${boardDisabled ? 'opacity-90' : ''}`}
                style={boardDisabled ? { pointerEvents: 'none' } : undefined}
              >
                {board.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((cell, colIndex) => {
                      const cellKey = `${rowIndex}-${colIndex}`;
                      return (
                        <button
                          key={colIndex}
                          className={`flex-1 board-cell ${
                            cell === BLACK ? 'black' : cell === WHITE ? 'white' : ''
                          } ${isLastMove(rowIndex, colIndex) ? 'last-move' : ''
                          } ${rippleCell === cellKey ? 'ripple' : ''}`}
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
