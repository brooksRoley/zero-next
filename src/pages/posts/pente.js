import React, { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import ScoreBoard from 'src/components/Scoreboard.js';
import confetti from 'canvas-confetti';
import useGameSounds from 'src/hooks/useGameSounds';

const BOARD_SIZE = 19;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const GameBoard = () => {
  const [board, setBoard] = useState(Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY)));
  const [currentPlayer, setCurrentPlayer] = useState(BLACK);
  const [blackScore, setBlackScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [blackCaptures, setBlackCaptures] = useState(0);
  const [whiteCaptures, setWhiteCaptures] = useState(0);
  const [, setGameCount] = useState(0);
  const [lastMove, setLastMove] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [rippleCell, setRippleCell] = useState(null);

  const boardRef = useRef(null);
  const { playPlace, playCapture, playWin } = useGameSounds();

  const triggerShake = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    el.classList.remove('board-shake');
    void el.offsetWidth; // force reflow
    el.classList.add('board-shake');
  }, []);

  const triggerRipple = useCallback((row, col) => {
    setRippleCell(`${row}-${col}`);
    setTimeout(() => setRippleCell(null), 500);
  }, []);

  const handleClick = (row, col) => {
    if (board[row][col] !== EMPTY) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setLastMove([row, col]);
    setMoveCount(prev => prev + 1);

    playPlace();
    triggerRipple(row, col);

    const capturedPairs = checkForCaptures(newBoard, row, col, currentPlayer);
    if (capturedPairs > 0) {
      setTimeout(() => {
        playCapture();
        triggerShake();
      }, 100);
    }
    updateCaptures(capturedPairs);

    if (checkForFiveInARow(newBoard, row, col)) {
      endGame(`Player ${currentPlayer === BLACK ? 'Black' : 'White'} wins with five in a row!`);
      return;
    }

    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
  };

  const checkForFiveInARow = (board, row, col) => {
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let [dx, dy] of directions) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const r = row + i * dx, c = col + i * dy;
        if (!isValidPosition(r, c) || board[r][c] !== currentPlayer) break;
        count++;
      }
      for (let i = 1; i < 5; i++) {
        const r = row - i * dx, c = col - i * dy;
        if (!isValidPosition(r, c) || board[r][c] !== currentPlayer) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  };

  const checkForCaptures = (board, row, col, player) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let capturedPairs = 0;
    for (let [dx, dy] of directions) {
      if (checkCaptureInDirection(board, row, col, dx, dy, player)) capturedPairs++;
      if (checkCaptureInDirection(board, row, col, -dx, -dy, player)) capturedPairs++;
    }
    return capturedPairs;
  };

  const checkCaptureInDirection = (board, row, col, dx, dy, player) => {
    const opponent = player === BLACK ? WHITE : BLACK;
    if (isValidPosition(row + dx, col + dy) &&
        isValidPosition(row + 2*dx, col + 2*dy) &&
        isValidPosition(row + 3*dx, col + 3*dy) &&
        board[row + dx][col + dy] === opponent &&
        board[row + 2*dx][col + 2*dy] === opponent &&
        board[row + 3*dx][col + 3*dy] === player) {
      board[row + dx][col + dy] = EMPTY;
      board[row + 2*dx][col + 2*dy] = EMPTY;
      return true;
    }
    return false;
  };

  const isValidPosition = (row, col) => {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  };

  const updateCaptures = (capturedPairs) => {
    if (currentPlayer === BLACK) {
      if (blackCaptures + capturedPairs >= 5) {
        endGame(`Player ${currentPlayer === BLACK ? 'Black' : 'White'} wins by captures!`);
        return;
      } else {
        setBlackCaptures(prev => prev + capturedPairs);
      }
    } else {
      if (whiteCaptures + capturedPairs >= 5) {
        endGame(`Player ${currentPlayer === BLACK ? 'Black' : 'White'} wins by captures!`);
        return;
      } else {
        setWhiteCaptures(prev => prev + capturedPairs);
      }
    }
  };

  const endGame = (message) => {
    playWin();
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
    });
    alert(message);
    if (currentPlayer === BLACK) {
      setBlackScore(prev => prev + 1);
    } else {
      setWhiteScore(prev => prev + 1);
    }
    setGameCount(prev => prev + 1);
    resetBoard();
  };

  const resetBoard = () => {
    setBoard(Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY)));
    setCurrentPlayer(BLACK);
    setBlackCaptures(0);
    setWhiteCaptures(0);
    setLastMove(null);
    setMoveCount(0);
    setRippleCell(null);
  };

  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c;
  const isBlackTurn = currentPlayer === BLACK;

  return (
    <div className="min-h-screen bg-forest-950">
      <Head>
        <title>Pente | Brooks Roley</title>
        <meta property="og:title" content="Pente | Brooks Roley" />
        <meta name="description" content="Play Pente — a classic 2-player strategy board game with captures and five-in-a-row." />
      </Head>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
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
          <button
            onClick={resetBoard}
            className="text-xs text-forest-400 hover:text-candy-400 transition-colors px-3 py-1.5 rounded-md border border-forest-700/40 hover:border-candy-400/30"
          >
            New Game
          </button>
        </div>

        {/* Board + Scoreboard */}
        <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-4 sm:gap-6">
          <div
            ref={boardRef}
            className={`game-board rounded-xl shadow-lg ${isBlackTurn ? 'board-hover-black' : 'board-hover-white'}`}
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
      </div>
    </div>
  );
};

export default GameBoard;
