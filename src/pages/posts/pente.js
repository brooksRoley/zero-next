import React, { useState } from 'react';
import ScoreBoard from 'src/components/Scoreboard.js';
import confetti from 'canvas-confetti';

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
  const [gameCount, setGameCount] = useState(0);

  const handleClick = (row, col) => {
    if (board[row][col] !== EMPTY) return;

    const newBoard = board.map(row => [...row]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    const capturedPairs = checkForCaptures(newBoard, row, col, currentPlayer);
    updateCaptures(capturedPairs);
    if (checkForFiveInARow(newBoard, row, col)) {
      endGame(`Player ${currentPlayer === BLACK ? 'Black' : 'White'} wins with five in a row!`);
      return;
    }

    setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
  };
  const checkForFiveInARow = (board, row, col) => {
    const directions = [
      [1, 0],  // vertical
      [0, 1],  // horizontal
      [1, 1],  // diagonal \
      [1, -1]  // diagonal /
    ];

    for (let [dx, dy] of directions) {
      let count = 1;  // Start at 1 to count the stone just placed
      
      // Check in positive direction
      for (let i = 1; i < 5; i++) {
        const newRow = row + i * dx;
        const newCol = col + i * dy;
        if (!isValidPosition(newRow, newCol) || board[newRow][newCol] !== currentPlayer) break;
        count++;
      }
      
      // Check in negative direction
      for (let i = 1; i < 5; i++) {
        const newRow = row - i * dx;
        const newCol = col - i * dy;
        if (!isValidPosition(newRow, newCol) || board[newRow][newCol] !== currentPlayer) break;
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
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
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
  };

  return (
    <div className='p-2 bg-blue-100'>
      <div className="flex justify-center items-start gap-5">
        <div className="game-board">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => (
                <button
                  key={colIndex}
                  className={`flex-1 ${ currentPlayer === WHITE ? 'hover:bg-white' : 'hover:bg-black' } board-cell ${cell === BLACK ? 'black' : cell === WHITE ? 'white' : ''}`}
                  onClick={() => handleClick(rowIndex, colIndex)}
                />
              ))}
            </div>
          ))}
        </div>
        <ScoreBoard
          blackScore={blackScore}
          whiteScore={whiteScore}
          blackCaptures={blackCaptures}
          whiteCaptures={whiteCaptures}
        />
      </div>
      <footer className="block m-2 align bg-gray-200 p-4">
        <h1 className='font-bold text-2xl text-blue-600'>Pente Rules</h1>
        <p>
          Pente is a board game played on a 19x19 grid.
          The objective is to be the first player to either align five stones in a row or capture five pairs of your opponent's stones.
        </p>
          <p>Here are the basic rules:</p>
        <ul>
            <li><strong>Setup:</strong> Players choose colors and place stones on the intersections of the grid. The center point is the starting position.</li>
            <li><strong>Turns:</strong> Players take turns placing one stone on an empty intersection.</li>
            <li><strong>Winning:</strong> A player wins by achieving one of two conditions:
                <ul>
                    <li>Aligning five stones in a row (horizontally, vertically, or diagonally).</li>
                    <li>Capturing five pairs of the opponent's stones.</li>
                </ul>
            </li>
            <li><strong>Capturing Stones:</strong> Stones are captured by flanking a pair of the opponent's stones with your stones in a straight line.</li>
            <li><strong>Pro Rules:</strong> For advanced play, the first player's second move must be at least three intersections away from the center.</li>
        </ul>
      </footer>
    </div>
  );
};

export default GameBoard;