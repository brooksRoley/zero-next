/**
 * Pente Puzzle Generator (dev-time tool)
 *
 * Runs bot-vs-bot games and identifies positions where the best move
 * scores significantly higher than the second-best. These become puzzle candidates.
 *
 * Usage (from project root):
 *   node --experimental-vm-modules scripts/generate-puzzles.mjs
 *
 * Or import and call generatePuzzleCandidates() directly.
 */
import { PenteBot } from 'src/components/PentePlayerbot'
import { createEmptyBoard, applyMove } from 'src/lib/pente/gameLogic'
import { BLACK, WHITE, BOARD_SIZE, EMPTY } from 'src/lib/pente/constants'

const CATEGORY_THRESHOLDS = {
  WIN: 1000000,
  BLOCK_WIN: 500000,
  CAPTURE: 10000,
  OPEN_FOUR: 5000,
}

function classifyPuzzle(bestScore, board, row, col, player) {
  if (bestScore >= CATEGORY_THRESHOLDS.WIN) return 'five_in_a_row'
  if (bestScore >= CATEGORY_THRESHOLDS.BLOCK_WIN) return 'defense'
  if (bestScore >= CATEGORY_THRESHOLDS.CAPTURE) return 'capture'
  if (bestScore >= CATEGORY_THRESHOLDS.OPEN_FOUR) return 'mixed'
  return 'opening'
}

function classifyDifficulty(scoreDiff, moveNumber) {
  if (scoreDiff > 500000) return 1 // obvious winning/blocking move
  if (scoreDiff > 50000) return 2  // clear tactical move
  if (scoreDiff > 10000) return 3  // requires calculation
  return 4                          // subtle positional
}

/**
 * Generate puzzle candidates by simulating bot-vs-bot games.
 * @param {number} numGames - Number of games to simulate
 * @param {number} minScoreDiff - Minimum score gap between best and second-best move
 * @returns {Array} Array of puzzle candidate objects
 */
export function generatePuzzleCandidates(numGames = 30, minScoreDiff = 5000) {
  const candidates = []

  for (let g = 0; g < numGames; g++) {
    let board = createEmptyBoard()
    let blackCaptures = 0
    let whiteCaptures = 0
    let currentPlayer = BLACK

    const blackBot = new PenteBot(BLACK)
    const whiteBot = new PenteBot(WHITE)

    for (let moveNum = 0; moveNum < 200; moveNum++) {
      const bot = currentPlayer === BLACK ? blackBot : whiteBot
      const boardCopy = board.map(r => [...r])
      const botCaps = currentPlayer === BLACK ? blackCaptures : whiteCaptures
      const oppCaps = currentPlayer === BLACK ? whiteCaptures : blackCaptures

      const bestMove = bot.getBestMove(boardCopy, botCaps, oppCaps)
      if (!bestMove) break

      // Check if this is a puzzle-worthy position
      if (bestMove.score >= CATEGORY_THRESHOLDS.CAPTURE && moveNum > 4) {
        const allCandidateCells = bot.getCandidateCells(board)
        const scored = allCandidateCells
          .map(c => ({
            ...c,
            score: bot.evaluateMove(
              board.map(r => [...r]),
              c.row, c.col,
              botCaps, oppCaps
            ),
          }))
          .sort((a, b) => b.score - a.score)

        if (scored.length >= 2) {
          const scoreDiff = scored[0].score - scored[1].score

          if (scoreDiff >= minScoreDiff) {
            const category = classifyPuzzle(bestMove.score, board, bestMove.row, bestMove.col, currentPlayer)
            const difficulty = classifyDifficulty(scoreDiff, moveNum)

            candidates.push({
              id: `gen-${g}-${moveNum}`,
              title: `Generated: ${category}`,
              description: `${currentPlayer === BLACK ? 'Black' : 'White'} to move.`,
              category,
              difficulty,
              board: board.map(r => [...r]),
              playerToMove: currentPlayer,
              blackCaptures,
              whiteCaptures,
              solutions: [{ row: bestMove.row, col: bestMove.col }],
              hint: 'Find the strongest move.',
              explanation: `Best move scores ${bestMove.score}, next best scores ${scored[1].score} (gap: ${scoreDiff}).`,
              _meta: {
                gameNumber: g,
                moveNumber: moveNum,
                bestScore: bestMove.score,
                secondBestScore: scored[1].score,
                scoreDiff,
              },
            })
          }
        }
      }

      // Apply the move and continue
      let result
      try {
        result = applyMove(board, bestMove.row, bestMove.col, currentPlayer, blackCaptures, whiteCaptures)
      } catch {
        break
      }

      board = result.newBoard
      blackCaptures = result.blackCaptures
      whiteCaptures = result.whiteCaptures
      if (result.winner) break
      currentPlayer = result.nextPlayer
    }
  }

  return candidates
}

/**
 * Format a board state as a makeBoard() call for pasting into puzzles.js
 */
export function boardToMakeBoardCall(board) {
  const stones = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === BLACK) stones.push(`[${r}, ${c}, B]`)
      else if (board[r][c] === WHITE) stones.push(`[${r}, ${c}, W]`)
    }
  }
  return `makeBoard([\n  ${stones.join(',\n  ')},\n])`
}
