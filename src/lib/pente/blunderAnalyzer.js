import { BLACK, WHITE, EMPTY } from 'src/lib/pente/constants'

/**
 * Heuristic post-mortem: given a finished game, decide which human move lost
 * it and what tactical pattern punished them. This is a lightweight companion
 * to PenteTutor.analyzeGameHistory — that pass labels every move; we answer a
 * different question: "what's the single most teachable moment in this loss?"
 *
 * Return shape:
 *   {
 *     blunderIndex,        // index in moveHistory where the pivotal blunder happened
 *     blunderCell,         // { row, col } of the stone the human placed
 *     tactic,              // 'open_four' | 'fork' | 'capture_trap' | 'missed_block' | 'general'
 *     tacticLabel,         // human-readable e.g. "4-3 Fork"
 *     narrative,           // 1-2 sentence explanation for the intervention card
 *     puzzleCategory,      // category hint for the puzzle generator
 *     opponentColor,
 *   }
 *
 * Returns null if the loss wasn't really a blunder (e.g. opponent crushed you
 * from move one, or no move looks materially worse than the others).
 */

const LINE_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]
const BOARD_SIZE = 19

export function analyzeLoss({ moveHistory, gameAnalysis, humanColor, winner }) {
  if (!moveHistory?.length || !gameAnalysis?.length) return null
  if (winner === humanColor) return null

  const opponentColor = humanColor === BLACK ? WHITE : BLACK

  // Find the human move with the biggest eval swing against them. Eval is
  // from a fixed perspective, so "bad for human" means a big drop if human is
  // BLACK (positive = BLACK winning), or a big jump if human is WHITE. We
  // normalize into a signed "loss delta" per human move.
  const humanSign = humanColor === BLACK ? 1 : -1

  let worst = null
  for (let i = 0; i < moveHistory.length; i++) {
    const state = moveHistory[i]
    if (state.moveMadeBy !== humanColor) continue
    const prev = gameAnalysis[i - 1]?.evaluation ?? 0
    const curr = gameAnalysis[i]?.evaluation ?? 0
    const deltaAgainstHuman = (prev - curr) * humanSign
    if (deltaAgainstHuman <= 0) continue
    if (!worst || deltaAgainstHuman > worst.delta) {
      worst = { index: i, delta: deltaAgainstHuman, state }
    }
  }

  // Require a real swing before claiming "blunder" — otherwise the loss was
  // gradual, not a single mistake, and the intervention card would mislead.
  if (!worst || worst.delta < 2500) return null

  const { state } = worst
  const board = state.board
  const classification = classifyTactic(board, opponentColor, state)

  return {
    blunderIndex: worst.index,
    blunderCell: { row: state.row, col: state.col },
    opponentColor,
    ...classification,
  }
}

function classifyTactic(board, opponent, state) {
  const threats = countOpponentThreats(board, opponent)
  const humanCapsLost = detectCaptureTrap(state)

  if (threats.openFours >= 1) {
    return {
      tactic: 'open_four',
      tacticLabel: 'Open Four',
      puzzleCategory: 'defense',
      narrative:
        'Your opponent built an unblockable four-in-a-row — two open ends means one of them completes the five next turn. Defense had to come a move earlier.',
    }
  }

  if (threats.openThrees >= 2) {
    const label = threats.openFours >= 1 ? '4-3 Fork' : `${threats.openThrees}-${threats.openThrees} Fork`
    return {
      tactic: 'fork',
      tacticLabel: label,
      puzzleCategory: 'defense',
      narrative:
        'Your opponent created two simultaneous open-three threats — you can only block one. Spotting forks a move early is a foundational Pente skill.',
    }
  }

  if (humanCapsLost >= 2) {
    return {
      tactic: 'capture_trap',
      tacticLabel: 'Capture Trap',
      puzzleCategory: 'capture',
      narrative:
        'You walked a pair into a bracket. Once your opponent had the frame set up, placing the second stone was forced into a loss. Capture shape awareness is the fix.',
    }
  }

  if (threats.halfOpenFours >= 1) {
    return {
      tactic: 'missed_block',
      tacticLabel: 'Missed Block',
      puzzleCategory: 'defense',
      narrative:
        'A single half-open four became unblockable after your move. The tactical cue — a stretched threat along the diagonal or file — is learnable.',
    }
  }

  return {
    tactic: 'general',
    tacticLabel: 'Positional Slip',
    puzzleCategory: 'mixed',
    narrative:
      'No single dramatic threat, but this move let your opponent consolidate space. Training positional tension at your rating will sharpen the read.',
  }
}

function countOpponentThreats(board, opponent) {
  let openFours = 0
  let halfOpenFours = 0
  let openThrees = 0

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== opponent) continue
      for (const [dr, dc] of LINE_DIRS) {
        const pattern = readLine(board, r, c, dr, dc, opponent)
        if (!pattern) continue
        if (pattern.count === 4 && pattern.openEnds === 2) openFours++
        else if (pattern.count === 4 && pattern.openEnds === 1) halfOpenFours++
        else if (pattern.count === 3 && pattern.openEnds === 2) openThrees++
      }
    }
  }

  // Each run is counted from every stone that sits on its leftmost anchor, so
  // the above can overcount. We approximate — caller only cares about
  // "multiple threats exist?" not the exact cardinality.
  return {
    openFours: Math.min(openFours, 4),
    halfOpenFours: Math.min(halfOpenFours, 4),
    openThrees: Math.min(openThrees, 6),
  }
}

function readLine(board, r, c, dr, dc, color) {
  // Only anchor from the leftmost stone in the run to avoid double-counting.
  const br = r - dr, bc = c - dc
  if (inBounds(br, bc) && board[br][bc] === color) return null

  let count = 0
  let i = 0
  while (inBounds(r + i * dr, c + i * dc) && board[r + i * dr][c + i * dc] === color) {
    count++
    i++
  }
  if (count < 3) return null

  let openEnds = 0
  const endF = { r: r + count * dr, c: c + count * dc }
  const endB = { r: r - dr, c: c - dc }
  if (inBounds(endF.r, endF.c) && board[endF.r][endF.c] === EMPTY) openEnds++
  if (inBounds(endB.r, endB.c) && board[endB.r][endB.c] === EMPTY) openEnds++

  return { count, openEnds }
}

function detectCaptureTrap(state) {
  // The tutor stores per-turn capture totals. If the human just suffered a
  // capture (their capture-against count jumped), flag it. `state` contains
  // board + per-color capture counts after the move.
  // Heuristic: we don't have pre/post in one struct here, so the caller passes
  // the move state and we can only rely on a post-move heuristic. For now we
  // return 0 and let the threat-based classifier take precedence; the narrative
  // still covers capture traps when combined with fork detection upstream.
  return 0
}

function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}
