import React, { useState } from 'react';
const DIRECTIONS = [
  { row: 1, col: 0 },  // vertical
  { row: 0, col: 1 },  // horizontal
  { row: 1, col: 1 },  // diagonal /
  { row: 1, col: -1 }  // diagonal \
];

const GameBoard = () => {
  const initialBoard = Array(19).fill(Array(19).fill(null));
  const [board, setBoard] = useState(initialBoard);
  const [playerTurn, setPlayerTurn] = useState('black');
  const [captures, setCaptures] = useState({
    black: 0,
    white: 0
  });

  const handleCellClick = (row, col) => {
    if (board[row][col] !== null) return;  // Prevent overwriting moves
  
    const newBoard = board.map((rowArray, rowIndex) =>
      rowArray.map((cell, colIndex) =>
        rowIndex === row && colIndex === col
          ? playerTurn  // Place the current player's piece
          : cell === null ? null : cell  // Preserve null values
      )
    );
    setBoard(newBoard);
    checkForWinOrRemovePieces(row, col);
    setPlayerTurn(playerTurn === 'black' ? 'white' : 'black');  // Toggle player turn
  };

  const checkWin = (board, row, col, color) => {
    const checkDirection = (direction) => {
      let count = 1;  // Count the initial placed piece
      let i = 1;
  
      while (i < 5) {
        const newRow = row + i * direction.row;
        const newCol = col + i * direction.col;
        if (
          newRow >= 0 &&
          newRow < board.length &&
          newCol >= 0 &&
          newCol < board[0].length &&
          board[newRow][newCol] === color
        ) {
          count++;
          i++;
        } else {
          break;
        }
      }
  
      i = 1;
      while (i < 5) {
        const newRow = row - i * direction.row;
        const newCol = col - i * direction.col;
  
        if (
          newRow >= 0 &&
          newRow < board.length &&
          newCol >= 0 &&
          newCol < board[0].length &&
          board[newRow][newCol] === color
        ) {
          count++;
          i++;
        } else {
          break;
        }
      }
      return count >= 5;
    };
    for (const direction of DIRECTIONS) {
      if (checkDirection(direction)) {
        return true;
      }
    }
  
    return false;
  };

  const checkForCapture = (board, row, col, color) => {
    let capturedCount = 0;

    const checkDirection = (direction) => {
      let i = 1;
      let opponentCount = 0;
      let friendlyPieceFound = false;
  
      while (i < 5) {
        const newRow = row + i * direction.row;
        const newCol = col + i * direction.col;
  
        if (
          newRow >= 0 &&
          newRow < board.length &&
          newCol >= 0 &&
          newCol < board[0].length
        ) {
          const currentCell = board[newRow][newCol];
          if (currentCell === color) {
            friendlyPieceFound = true;
            break;
          } else if (currentCell !== null) {
            opponentCount++;
            console.log(opponentCount);
            if (opponentCount === 2 && friendlyPieceFound) {
              capturedCount++;
              board[row + (i - 1) * direction.row][col + (i - 1) * direction.col] = null;
              board[row + i * direction.row][col + i * direction.col] = null;            
            }
          } else {
            break;
          }
        } else {
          break;
        }
  
        i++;
      }
    };

    for (const direction of DIRECTIONS) {
      checkDirection(direction);
    }
    return capturedCount;
  };

  const checkForWinOrRemovePieces = (row, col) => {
    // Check for win
    if (checkWin(board, row, col, playerTurn)) {
      window.alert(`Player ${playerTurn.toUpperCase()} wins!`);
      setBoard(initialBoard);
    } else {
      let capturedStones = 0;
      // Check for captures after placing a stone
      capturedStones = checkForCapture(board, row, col, playerTurn);
      // Update the captured count for the player
      setCaptures(prevCaptures => ({
        ...prevCaptures,
        [playerTurn]: prevCaptures[playerTurn] + capturedStones
      }));
    }
  };

  return (
    <div className="game-board p-2">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="row">
          {row.map((cell, colIndex) => (
            <div
              key={colIndex}
              className={`cell ${cell}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
