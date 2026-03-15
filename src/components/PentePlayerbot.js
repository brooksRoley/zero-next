/**
 * PentePlayerBot.js
 * A heuristic-based AI for playing Pente.
 * Uses numeric constants: EMPTY=0, BLACK=1, WHITE=2
 */
import { BOARD_SIZE, EMPTY } from 'src/lib/pente/constants';
import { isValidPosition, checkForFiveInARow, computeCaptures } from 'src/lib/pente/gameLogic';

export class PenteBot {
  constructor(botColor) {
    this.botColor = botColor;
    this.opponentColor = botColor === 1 ? 2 : 1;

    this.weights = {
      WIN: 1000000,
      BLOCK_WIN: 500000,
      CAPTURE: 10000,
      PREVENT_CAPTURE: 8000,
      OPEN_FOUR: 5000,
      BLOCK_OPEN_FOUR: 4500,
      OPEN_THREE: 1000,
      BLOCK_OPEN_THREE: 900,
      PROXIMITY: 10,
    };
  }

  /**
   * Main entry point.
   * @returns {{ row: number, col: number, score: number }}
   */
  getBestMove(board, botCaptures, oppCaptures) {
    let bestScore = -Infinity;
    let bestMoves = [];

    const candidates = this.getCandidateCells(board);

    // First move — play center
    if (candidates.length === BOARD_SIZE * BOARD_SIZE) {
      const center = Math.floor(BOARD_SIZE / 2);
      return { row: center, col: center, score: 0 };
    }

    for (const { row, col } of candidates) {
      const score = this.evaluateMove(board, row, col, botCaptures, oppCaptures);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [{ row, col, score }];
      } else if (score === bestScore) {
        bestMoves.push({ row, col, score });
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /**
   * Evaluates placing a stone at (row, col).
   */
  evaluateMove(board, row, col, botCaptures, oppCaptures) {
    let score = 0;

    // Simulate bot's move
    board[row][col] = this.botColor;

    // Win?
    if (checkForFiveInARow(board, row, col, this.botColor)) {
      score += this.weights.WIN;
    }
    const botCaps = this.countCaptures(board, row, col, this.botColor);
    if (botCaptures + botCaps >= 5) {
      score += this.weights.WIN;
    }
    score += botCaps * this.weights.CAPTURE;

    // Block opponent win?
    board[row][col] = this.opponentColor;
    if (checkForFiveInARow(board, row, col, this.opponentColor)) {
      score += this.weights.BLOCK_WIN;
    }
    const oppCaps = this.countCaptures(board, row, col, this.opponentColor);
    if (oppCaptures + oppCaps >= 5) {
      score += this.weights.BLOCK_WIN;
    }

    // Restore bot color for pattern analysis
    board[row][col] = this.botColor;

    // Line patterns in all 4 directions
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      score += this.scoreLinePattern(board, row, col, dr, dc, this.botColor, false);
      score += this.scoreLinePattern(board, row, col, dr, dc, this.opponentColor, true);
    }

    // Prevent own pairs from being captured
    score += this.preventCaptureScore(board, row, col);

    // Proximity
    score += this.getProximityScore(board, row, col);

    // Undo
    board[row][col] = EMPTY;
    return score;
  }

  /**
   * Returns empty cells within 2 spaces of any existing stone (or all if board nearly empty).
   */
  getCandidateCells(board) {
    const hasNeighbor = (r, c) => {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (isValidPosition(nr, nc) && board[nr][nc] !== EMPTY) return true;
        }
      }
      return false;
    };

    const candidates = [];
    let hasStones = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== EMPTY) { hasStones = true; continue; }
        if (!hasStones || hasNeighbor(r, c)) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    // If no neighbors found (empty board), return all
    if (candidates.length === 0) {
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
          if (board[r][c] === EMPTY) candidates.push({ row: r, col: c });
    }

    return candidates;
  }

  /**
   * Count how many pairs would be captured by placing `color` at (row, col).
   */
  countCaptures(board, row, col, color) {
    const opponent = color === 1 ? 2 : 1;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let pairs = 0;
    for (const [dx, dy] of dirs) {
      for (const sign of [1, -1]) {
        const sdx = dx * sign, sdy = dy * sign;
        const r1 = row + sdx, c1 = col + sdy;
        const r2 = row + 2 * sdx, c2 = col + 2 * sdy;
        const r3 = row + 3 * sdx, c3 = col + 3 * sdy;
        if (
          isValidPosition(r1, c1) && isValidPosition(r2, c2) && isValidPosition(r3, c3) &&
          board[r1][c1] === opponent && board[r2][c2] === opponent && board[r3][c3] === color
        ) {
          pairs++;
        }
      }
    }
    return pairs;
  }

  /**
   * Score line patterns (open 3s, open 4s) for a given color at (row, col).
   */
  scoreLinePattern(board, row, col, dRow, dCol, color, isBlocking) {
    // Count consecutive stones in both directions from (row, col)
    let count = 1;
    let openEnds = 0;

    // Forward
    let i = 1;
    while (i < 5) {
      const r = row + i * dRow, c = col + i * dCol;
      if (!isValidPosition(r, c) || board[r][c] !== color) break;
      count++;
      i++;
    }
    // Check open end forward
    const fR = row + i * dRow, fC = col + i * dCol;
    if (isValidPosition(fR, fC) && board[fR][fC] === EMPTY) openEnds++;

    // Backward
    i = 1;
    while (i < 5) {
      const r = row - i * dRow, c = col - i * dCol;
      if (!isValidPosition(r, c) || board[r][c] !== color) break;
      count++;
      i++;
    }
    const bR = row - i * dRow, bC = col - i * dCol;
    if (isValidPosition(bR, bC) && board[bR][bC] === EMPTY) openEnds++;

    const w = this.weights;
    let score = 0;

    if (count >= 4 && openEnds >= 1) {
      score = isBlocking ? w.BLOCK_OPEN_FOUR : w.OPEN_FOUR;
    } else if (count === 3 && openEnds === 2) {
      score = isBlocking ? w.BLOCK_OPEN_THREE : w.OPEN_THREE;
    } else if (count === 3 && openEnds === 1) {
      score = (isBlocking ? w.BLOCK_OPEN_THREE : w.OPEN_THREE) * 0.5;
    }

    return score;
  }

  /**
   * Score for preventing own pairs from being captured next turn.
   */
  preventCaptureScore(board, row, col) {
    // Check if placing here fills a gap that would prevent an opponent capture
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let score = 0;
    for (const [dx, dy] of dirs) {
      for (const sign of [1, -1]) {
        const sdx = dx * sign, sdy = dy * sign;
        // Pattern: OPP . BOT BOT — placing at . prevents capture
        // Check if (row, col) is between opponent and own pair
        const rBehind = row - sdx, cBehind = col - sdy;
        const r1 = row + sdx, c1 = col + sdy;
        const r2 = row + 2 * sdx, c2 = col + 2 * sdy;
        if (
          isValidPosition(rBehind, cBehind) && board[rBehind][cBehind] === this.opponentColor &&
          isValidPosition(r1, c1) && board[r1][c1] === this.botColor &&
          isValidPosition(r2, c2) && board[r2][c2] === this.opponentColor
        ) {
          score += this.weights.PREVENT_CAPTURE;
        }
      }
    }
    return score;
  }

  /**
   * Proximity bonus for playing near existing stones.
   */
  getProximityScore(board, row, col) {
    let score = 0;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (isValidPosition(nr, nc) && board[nr][nc] !== EMPTY) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          score += this.weights.PROXIMITY / dist;
        }
      }
    }
    // Centrality bonus
    const center = Math.floor(BOARD_SIZE / 2);
    const distFromCenter = Math.abs(row - center) + Math.abs(col - center);
    score += Math.max(0, (BOARD_SIZE - distFromCenter)) * 0.5;
    return score;
  }
}
