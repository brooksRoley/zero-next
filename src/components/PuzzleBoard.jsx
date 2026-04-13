import React, { useRef, useState, useCallback } from 'react'
import { BLACK, WHITE, RED, BLUE, EMPTY, PLAYER_COLORS } from 'src/lib/pente/constants'
import useTactileFeedback from 'src/hooks/useTactileFeedback'

/**
 * Reusable Pente board renderer.
 * Displays a 19x19 board with click handling, highlights, animations,
 * and mobile touch-preview with haptic feedback.
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
  candidateCells = [],
}) {
  const boardRef = useRef(null)
  const [rippleCell, setRippleCell] = useState(null)
  const [touchPreviewCell, setTouchPreviewCell] = useState(null)
  const feedback = useTactileFeedback()

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
    if (board[row][col] !== EMPTY) return
    // Fire tactile feedback synchronously with the click — audio + haptic
    // land before React commits, keeping perceived latency under 100ms.
    feedback.onPlace()
    triggerRipple(row, col)
    if (onCellClick) onCellClick(row, col, { triggerShake })
  }

  // Touch handlers for drag-to-preview
  const cellFromTouch = useCallback((touch) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!el || !el.classList.contains('board-cell')) return null
    const row = el.dataset.row
    const col = el.dataset.col
    if (row == null || col == null) return null
    return { row: parseInt(row, 10), col: parseInt(col, 10) }
  }, [])

  const handleTouchStart = useCallback((e) => {
    if (disabled) return
    const cell = cellFromTouch(e.touches[0])
    if (cell && board[cell.row][cell.col] === EMPTY) {
      setTouchPreviewCell(`${cell.row}-${cell.col}`)
    }
  }, [cellFromTouch, disabled, board])

  const handleTouchMove = useCallback((e) => {
    if (disabled) return
    const cell = cellFromTouch(e.touches[0])
    if (!cell) { setTouchPreviewCell(null); return }
    const key = `${cell.row}-${cell.col}`
    if (board[cell.row][cell.col] === EMPTY) {
      setTouchPreviewCell(prev => prev !== key ? key : prev)
    } else {
      setTouchPreviewCell(null)
    }
  }, [cellFromTouch, disabled, board])

  const handleTouchEnd = useCallback((e) => {
    if (!touchPreviewCell || disabled) return
    const [row, col] = touchPreviewCell.split('-').map(Number)
    setTouchPreviewCell(null)
    handleClick(row, col)
    e.preventDefault()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchPreviewCell, disabled])

  const hoverCss = `board-hover-${PLAYER_COLORS[playerToMove]?.css || 'black'}`
  const isLastMove = (r, c) => lastMove && lastMove[0] === r && lastMove[1] === c
  const isHintCell = (r, c) => hintCell && hintCell.row === r && hintCell.col === c
  const isHighlighted = (r, c) => highlightCells.some(h => h.row === r && h.col === c)
  const isWrongCell = (r, c) => wrongCell && wrongCell.row === r && wrongCell.col === c
  const candidateAt = (r, c) => candidateCells.find(k => k.row === r && k.col === c)

  return (
    <div
      ref={boardRef}
      className={`game-board rounded-xl shadow-lg ${hoverCss} ${disabled ? 'opacity-90' : ''}`}
      style={disabled ? { pointerEvents: 'none' } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {row.map((cell, colIndex) => {
            const cellKey = `${rowIndex}-${colIndex}`
            const candidate = candidateAt(rowIndex, colIndex)
            return (
              <button
                key={colIndex}
                data-row={rowIndex}
                data-col={colIndex}
                className={[
                  'flex-1 board-cell',
                  cell === BLACK ? 'black' : cell === WHITE ? 'white' : cell === RED ? 'red' : cell === BLUE ? 'blue' : '',
                  isLastMove(rowIndex, colIndex) ? 'last-move' : '',
                  rippleCell === cellKey ? 'ripple' : '',
                  isHintCell(rowIndex, colIndex) ? 'hint-glow' : '',
                  isHighlighted(rowIndex, colIndex) ? 'solution-glow' : '',
                  isWrongCell(rowIndex, colIndex) ? 'wrong-flash' : '',
                  touchPreviewCell === cellKey ? 'touch-preview' : '',
                  candidate ? 'candidate-cell' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleClick(rowIndex, colIndex)}
              >
                {candidate && (
                  <span className="candidate-label" aria-label={`Candidate ${candidate.label}`}>
                    {candidate.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
