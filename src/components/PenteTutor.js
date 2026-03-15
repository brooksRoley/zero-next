/**
 * PenteTutor.js
 * Evaluation bar, hints, and post-game analysis for Pente.
 * Uses numeric constants: EMPTY=0, BLACK=1, WHITE=2
 */
import { EMPTY, BLACK, WHITE, BOARD_SIZE } from 'src/lib/pente/constants';
import { isValidPosition, checkForFiveInARow } from 'src/lib/pente/gameLogic';
import { PenteBot } from 'src/components/PentePlayerbot';

const defaultWeights = {
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

export class PenteTutor {
  constructor(weights) {
    this.weights = weights || defaultWeights;
  }

  /**
   * Evaluation bar score. Positive = White advantage, Negative = Black advantage.
   */
  evaluateBoardState(board, whiteCaptures, blackCaptures) {
    let whiteScore = whiteCaptures * this.weights.CAPTURE;
    let blackScore = blackCaptures * this.weights.CAPTURE;

    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const piece = board[r][c];
        if (piece === WHITE) {
          whiteScore += this.calculatePatternValue(board, r, c, WHITE);
        } else if (piece === BLACK) {
          blackScore += this.calculatePatternValue(board, r, c, BLACK);
        }
      }
    }

    return whiteScore - blackScore;
  }

  /**
   * Pattern value of a stone at (r, c) for the given color.
   */
  calculatePatternValue(board, r, c, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let value = 0;

    for (const [dr, dc] of directions) {
      let count = 1;
      let openEnds = 0;

      // Forward
      let i = 1;
      while (i < 5) {
        const nr = r + i * dr, nc = c + i * dc;
        if (!isValidPosition(nr, nc) || board[nr][nc] !== color) break;
        count++;
        i++;
      }
      const fR = r + i * dr, fC = c + i * dc;
      if (isValidPosition(fR, fC) && board[fR][fC] === EMPTY) openEnds++;

      // Backward
      i = 1;
      while (i < 5) {
        const nr = r - i * dr, nc = c - i * dc;
        if (!isValidPosition(nr, nc) || board[nr][nc] !== color) break;
        count++;
        i++;
      }
      const bR = r - i * dr, bC = c - i * dc;
      if (isValidPosition(bR, bC) && board[bR][bC] === EMPTY) openEnds++;

      if (count >= 5) value += this.weights.WIN;
      else if (count === 4 && openEnds >= 1) value += this.weights.OPEN_FOUR;
      else if (count === 3 && openEnds === 2) value += this.weights.OPEN_THREE;
      else if (count === 3 && openEnds === 1) value += this.weights.OPEN_THREE * 0.3;
      else if (count === 2 && openEnds === 2) value += 50;
    }

    return value;
  }

  /**
   * Get a hint for the given player.
   */
  getHint(board, playerColor, playerCaptures, oppCaptures) {
    const bot = new PenteBot(playerColor);
    const bestMove = bot.getBestMove(board, playerCaptures, oppCaptures);
    const explanation = this.generateExplanation(board, bestMove.row, bestMove.col, playerColor);

    return {
      suggestedMove: { row: bestMove.row, col: bestMove.col },
      explanation,
      evaluationDelta: bestMove.score,
    };
  }

  /**
   * Human-readable explanation for why a move is good.
   */
  generateExplanation(board, row, col, color) {
    const opponent = color === BLACK ? WHITE : BLACK;

    // Simulate move
    board[row][col] = color;
    const wins = checkForFiveInARow(board, row, col, color);
    board[row][col] = EMPTY;

    if (wins) return "This move wins the game by creating five in a row!";

    // Check if it captures
    const captures = this.countCapturesAt(board, row, col, color);
    if (captures > 0) return "This move captures an opponent's pair, bringing you closer to a capture victory.";

    // Check if it blocks opponent win
    board[row][col] = opponent;
    const blocksWin = checkForFiveInARow(board, row, col, opponent);
    board[row][col] = EMPTY;

    if (blocksWin) return "Critical move! You must play here to stop your opponent from winning on their next turn.";

    // Check open-four creation
    board[row][col] = color;
    if (this.hasOpenFour(board, row, col, color)) {
      board[row][col] = EMPTY;
      return "This creates an open four. If your opponent doesn't block both ends, you win.";
    }
    board[row][col] = EMPTY;

    // Check blocking open four
    board[row][col] = opponent;
    if (this.hasOpenFour(board, row, col, opponent)) {
      board[row][col] = EMPTY;
      return "You must block this open four, or your opponent will win.";
    }
    board[row][col] = EMPTY;

    // Check open-three
    board[row][col] = color;
    if (this.hasOpenThree(board, row, col, color)) {
      board[row][col] = EMPTY;
      return "This builds an open three — a strong setup that threatens to become an unstoppable four.";
    }
    board[row][col] = EMPTY;

    return "This is a solid developmental move that builds your presence on the board.";
  }

  countCapturesAt(board, row, col, color) {
    const opponent = color === BLACK ? WHITE : BLACK;
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

  hasOpenFour(board, row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      let count = 1, openEnds = 0;
      let i = 1;
      while (i < 5) {
        const r = row + i * dr, c = col + i * dc;
        if (!isValidPosition(r, c) || board[r][c] !== color) break;
        count++; i++;
      }
      const fR = row + i * dr, fC = col + i * dc;
      if (isValidPosition(fR, fC) && board[fR][fC] === EMPTY) openEnds++;
      i = 1;
      while (i < 5) {
        const r = row - i * dr, c = col - i * dc;
        if (!isValidPosition(r, c) || board[r][c] !== color) break;
        count++; i++;
      }
      const bR = row - i * dr, bC = col - i * dc;
      if (isValidPosition(bR, bC) && board[bR][bC] === EMPTY) openEnds++;
      if (count >= 4 && openEnds >= 1) return true;
    }
    return false;
  }

  hasOpenThree(board, row, col, color) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      let count = 1, openEnds = 0;
      let i = 1;
      while (i < 5) {
        const r = row + i * dr, c = col + i * dc;
        if (!isValidPosition(r, c) || board[r][c] !== color) break;
        count++; i++;
      }
      const fR = row + i * dr, fC = col + i * dc;
      if (isValidPosition(fR, fC) && board[fR][fC] === EMPTY) openEnds++;
      i = 1;
      while (i < 5) {
        const r = row - i * dr, c = col - i * dc;
        if (!isValidPosition(r, c) || board[r][c] !== color) break;
        count++; i++;
      }
      const bR = row - i * dr, bC = col - i * dc;
      if (isValidPosition(bR, bC) && board[bR][bC] === EMPTY) openEnds++;
      if (count === 3 && openEnds === 2) return true;
    }
    return false;
  }

  /**
   * Post-game analysis. Returns annotated move list.
   * Compares each move against the bot's best move to classify quality.
   */
  analyzeGameHistory(history, humanColor) {
    const analysis = [];

    for (let i = 0; i < history.length; i++) {
      const state = history[i];
      const currentEval = this.evaluateBoardState(state.board, state.whiteCaptures, state.blackCaptures);

      let annotation = "Good move.";

      // Compare against best move (skip first move or if coords missing)
      if (i > 0 && state.row !== undefined && state.col !== undefined) {
        const prevState = history[i - 1];
        const moverColor = state.moveMadeBy;
        const bot = new PenteBot(moverColor);

        const playerCaps = moverColor === BLACK ? prevState.blackCaptures : prevState.whiteCaptures;
        const oppCaps = moverColor === BLACK ? prevState.whiteCaptures : prevState.blackCaptures;

        const playedScore = bot.evaluateMove(
          prevState.board.map(r => [...r]),
          state.row, state.col,
          playerCaps, oppCaps
        );

        const bestMove = bot.getBestMove(
          prevState.board.map(r => [...r]),
          playerCaps, oppCaps
        );
        const scoreDiff = bestMove.score - playedScore;

        const isHuman = state.moveMadeBy === humanColor;
        if (scoreDiff >= this.weights.BLOCK_OPEN_FOUR) {
          annotation = isHuman
            ? "Blunder: You missed a critical threat (open 4 or capture)."
            : "Opponent blundered here.";
        } else if (scoreDiff >= this.weights.OPEN_THREE) {
          annotation = isHuman
            ? "Mistake: A stronger move was available."
            : "Weak opponent move.";
        } else if (scoreDiff < 100) {
          annotation = isHuman ? "Great move!" : "Strong opponent move.";
        }
      }

      analysis.push({
        turn: i,
        evaluation: currentEval,
        annotation,
      });
    }

    return analysis;
  }
}
