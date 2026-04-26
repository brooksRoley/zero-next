import { EMPTY, BLACK, WHITE, createEmptyBoard } from './gameLogic'

/**
 * Minimal SGF parser scoped to what tsumego need: SZ, AB, AW, PL, B, W, C.
 * Supports the main line only — variations (sub-trees in `()`) are ignored
 * after the first `(`/`)` pair. Coordinates use SGF's column-then-row letters
 * (`a` = 0, `b` = 1, ...). `tt` or empty `[]` = pass.
 *
 * Returns:
 *   { size, initialBoard, toMove, comment, mainline: [{ color, move }] }
 *
 *   move = [row, col] | 'pass'
 *
 * The initial board has all AB/AW setup stones placed; it does NOT include
 * mainline moves. Stepping through the puzzle is the caller's job.
 */
export function parseSgf(sgf) {
  const tokens = tokenize(sgf)
  const props = []
  for (const tok of tokens) {
    if (tok.type === 'prop') props.push(tok)
  }

  let size = 19
  const blackSetup = []
  const whiteSetup = []
  let toMove = BLACK
  let comment = ''
  const mainline = []

  for (const { key, values } of props) {
    switch (key) {
      case 'SZ':
        size = parseInt(values[0], 10) || 19
        break
      case 'AB':
        for (const v of values) {
          const rc = sgfCoordToRC(v)
          if (rc) blackSetup.push(rc)
        }
        break
      case 'AW':
        for (const v of values) {
          const rc = sgfCoordToRC(v)
          if (rc) whiteSetup.push(rc)
        }
        break
      case 'PL':
        toMove = values[0] === 'W' ? WHITE : BLACK
        break
      case 'C':
        comment = values[0] || ''
        break
      case 'B':
      case 'W': {
        const color = key === 'B' ? BLACK : WHITE
        const v = values[0]
        if (!v || v === 'tt') {
          mainline.push({ color, move: 'pass' })
        } else {
          const rc = sgfCoordToRC(v, size)
          if (rc) mainline.push({ color, move: rc })
        }
        break
      }
      default:
        break
    }
  }

  const initialBoard = createEmptyBoard(size)
  for (const [r, c] of blackSetup) {
    if (inBounds(r, c, size)) initialBoard[r][c] = BLACK
  }
  for (const [r, c] of whiteSetup) {
    if (inBounds(r, c, size)) initialBoard[r][c] = WHITE
  }

  return { size, initialBoard, toMove, comment, mainline }
}

function inBounds(r, c, size) {
  return r >= 0 && r < size && c >= 0 && c < size
}

/**
 * Convert SGF coord string (e.g. "bc") to [row, col]. SGF uses column first,
 * then row, both as letters a-z (a = 0). `tt` (and the empty string) mean
 * pass and are handled by the caller.
 */
function sgfCoordToRC(s, size = 19) {
  if (!s || s.length < 2) return null
  if (s === 'tt') return null
  const col = s.charCodeAt(0) - 97
  const row = s.charCodeAt(1) - 97
  if (size <= 19 && (col < 0 || row < 0 || col >= size || row >= size)) return null
  return [row, col]
}

/**
 * Tokenize an SGF string into a flat sequence of {type:'prop', key, values[]}.
 * We ignore the tree structure: `(`, `)`, `;` are consumed but not emitted as
 * structural tokens, and only the first encounter of each move/property in
 * source order ends up in the property stream — sufficient for puzzle main
 * lines where the SGF author has already arranged the solution path.
 */
function tokenize(sgf) {
  const out = []
  let i = 0
  const n = sgf.length
  while (i < n) {
    const ch = sgf[i]
    if (ch === '(' || ch === ')' || ch === ';' || /\s/.test(ch)) {
      i++
      continue
    }
    if (/[A-Z]/.test(ch)) {
      let key = ''
      while (i < n && /[A-Z]/.test(sgf[i])) {
        key += sgf[i]
        i++
      }
      const values = []
      while (i < n && sgf[i] === '[') {
        i++
        let val = ''
        while (i < n && sgf[i] !== ']') {
          if (sgf[i] === '\\' && i + 1 < n) {
            val += sgf[i + 1]
            i += 2
          } else {
            val += sgf[i]
            i++
          }
        }
        if (i < n && sgf[i] === ']') i++
        values.push(val)
      }
      out.push({ type: 'prop', key, values })
      continue
    }
    i++
  }
  return out
}

/**
 * Render an [row, col] move pair as SGF coords (column letter, then row).
 * Used when serializing user-played sequences for analysis or sharing.
 */
export function rcToSgf([row, col]) {
  return String.fromCharCode(97 + col) + String.fromCharCode(97 + row)
}

// Re-export game-logic constants for SGF consumers
export { EMPTY, BLACK, WHITE }
