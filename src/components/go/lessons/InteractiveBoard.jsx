import React from 'react'
import { EMPTY, BLACK, WHITE } from 'src/lib/go/gameLogic'

function cellClass(cell) {
  if (cell === BLACK) return 'black'
  if (cell === WHITE) return 'white'
  return ''
}

const HOSHI = {
  9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
  13: [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]],
  19: [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15],
  ],
}

function isHoshi(size, r, c) {
  return (HOSHI[size] || []).some(([hr, hc]) => hr === r && hc === c)
}

/**
 * Lesson-flavored board renderer. Same DOM/CSS shape as the main game board,
 * but accepts overlay arrays for highlighting cells and an optional region
 * mask that dims (and ignores clicks for) cells outside a bounding box.
 *
 * Props:
 *  - board:           number[][] — current board state
 *  - hoverColor:      BLACK|WHITE — color of the hover-ghost
 *  - onCellClick:     (r, c) => void
 *  - liberties:       [[r,c], ...] — highlighted cyan (normal liberties)
 *  - atariCells:      [[r,c], ...] — highlighted red (last liberty / vital point)
 *  - eyes:            [[r,c], ...] — highlighted as enclosed eye points
 *  - blackTerritory:  [[r,c], ...] — empty cells shaded as black territory
 *  - whiteTerritory:  [[r,c], ...] — empty cells shaded as white territory
 *  - region:          { rMin, rMax, cMin, cMax } — clickable area; cells outside are dimmed
 *  - lastMove:        [r, c] | null
 *  - disabled:        boolean
 */
export default function InteractiveBoard({
  board,
  hoverColor = BLACK,
  onCellClick,
  liberties = [],
  atariCells = [],
  eyes = [],
  blackTerritory = [],
  whiteTerritory = [],
  region = null,
  lastMove = null,
  disabled = false,
}) {
  const size = board.length
  const libSet = new Set(liberties.map(([r, c]) => `${r},${c}`))
  const atariSet = new Set(atariCells.map(([r, c]) => `${r},${c}`))
  const eyeSet = new Set(eyes.map(([r, c]) => `${r},${c}`))
  const bTerrSet = new Set(blackTerritory.map(([r, c]) => `${r},${c}`))
  const wTerrSet = new Set(whiteTerritory.map(([r, c]) => `${r},${c}`))

  const inRegion = (r, c) => {
    if (!region) return true
    return r >= region.rMin && r <= region.rMax && c >= region.cMin && c <= region.cMax
  }

  return (
    <div
      className={`game-board go-board rounded-xl ${hoverColor === BLACK ? 'hover-black' : 'hover-white'} ${disabled ? 'opacity-90' : ''}`}
      style={{ ['--go-size']: size }}
    >
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="flex go-row">
          {row.map((cell, colIndex) => {
            const cellKey = `${rowIndex},${colIndex}`
            const isLast = lastMove && lastMove[0] === rowIndex && lastMove[1] === colIndex
            const isLastCol = colIndex === size - 1
            const hoshi = isHoshi(size, rowIndex, colIndex)
            const isLiberty = libSet.has(cellKey)
            const isAtari = atariSet.has(cellKey)
            const masked = !inRegion(rowIndex, colIndex)
            return (
              <button
                key={colIndex}
                data-row={rowIndex}
                data-col={colIndex}
                className={[
                  'board-cell',
                  cellClass(cell),
                  isLast ? 'last-move' : '',
                  isLastCol ? 'go-last-col' : '',
                  hoshi ? 'go-hoshi' : '',
                  masked ? 'go-masked' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  if (disabled || masked) return
                  if (onCellClick) onCellClick(rowIndex, colIndex)
                }}
                disabled={disabled || masked}
                aria-label={`${String.fromCharCode(65 + colIndex)}${size - rowIndex}`}
              >
                {hoshi && cell === EMPTY && <span className="go-hoshi-dot" />}
                {cell === EMPTY && !disabled && !masked && <span className="go-preview" />}
                {cell === EMPTY && bTerrSet.has(cellKey) && <span className="go-terr-fill go-terr-black" />}
                {cell === EMPTY && wTerrSet.has(cellKey) && <span className="go-terr-fill go-terr-white" />}
                {isLiberty && cell === EMPTY && <span className="go-liberty-dot" />}
                {isAtari && cell === EMPTY && <span className="go-liberty-dot go-liberty-atari" />}
                {eyeSet.has(cellKey) && cell === EMPTY && <span className="go-eye-mark" />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
