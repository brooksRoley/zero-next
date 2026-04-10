import React, { useRef, useState, useCallback } from 'react'
import { BLACK, WHITE, RED, BLUE, PLAYER_COLORS } from 'src/lib/pente/constants'

/**
 * Reusable Pente board renderer.
 * Displays a 19x19 board with click handling, highlights, and animations.
 */
export default function PuzzleBoard({
  board,
  onCellClick,
  playerToMove = BLACK,
  lastMove = null,
  hintCell = null,
  highlightCells = [],
  disabled = false,
  wrongCell = null,
}) {
  const boardRef = useRef(null)
  const [rippleCell, setRippleCell] = useState(null)

  const triggerRipple = useCallback((row, col) => {
    setRippleCell(`${row}-${col}`)
    setTimeout(() => setRippleCell(null), 500)
  }, [])

  const triggerShake = useCallback(() => {
    const el = boardRef.current
    if (!el) return
    el.classList.remove('board-shake')
    void el.offsetWidth
    el.classList.add('board-shake')
  }, [])

  const handleClick = (row, col) => {
    if (disabled) return
    if (board[row][col] !== 0) return // EMPTY = 0
    triggerRipple(row, col)
    if (onCellClick) onCellClick(row, col, { triggerShake })
  }

  const hoverCss = `board-hover-${PLAYER_COLORS[playerToMove]?.css || 'black'}`
  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c
  const isHintCell = (r, c) => hintCell && hintCell.row === r && hintCell.col === c
  const isHighlighted = (r, c) => highlightCells.some(h => h.row === r && h.col === c)
  const isWrongCell = (r, c) => wrongCell && wrongCell.row === r && wrongCell.col === c

  return (
    <div
      ref={boardRef}
      className={`game-board rounded-xl shadow-lg ${hoverCss} ${disabled ? 'opacity-90' : ''}`}
      style={disabled ? { pointerEvents: 'none' } : undefined}
    >
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {row.map((cell, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`
            return (
              <button
                key={colIndex}
                className={`flex-1 board-cell ${
                  cell === BLACK ? 'black' : cell === WHITE ? 'white' : cell === RED ? 'red' : cell === BLUE ? 'blue' : ''
                } ${isLastMove(rowIndex, colIndex) ? 'last-move' : ''
                } ${rippleCell === cellKey ? 'ripple' : ''
                } ${isHintCell(rowIndex, colIndex) ? 'hint-glow' : ''
                } ${isHighlighted(rowIndex, colIndex) ? 'solution-glow' : ''
                } ${isWrongCell(rowIndex, colIndex) ? 'wrong-flash' : ''}`}
                onClick={() => handleClick(rowIndex, colIndex)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
