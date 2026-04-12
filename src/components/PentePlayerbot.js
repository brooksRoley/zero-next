/**
 * PentePlayerBot.js
 * A heuristic-based AI for playing Pente with configurable difficulty.
 * Supports classic 2-player, FFA, and team modes.
 */
import { BOARD_SIZE, EMPTY, BLACK, WHITE, isOpponent as isOpp } from 'src/lib/pente/constants';
import { isValidPosition, checkForFiveInARow } from 'src/lib/pente/gameLogic';

// Difficulty presets — ELO approximates the skill level.
// Engine fields (searchDepth, timeBudgetMs, blunderRate) drive the minimax Web Worker.
// Legacy fields (randomness, depthScale) are kept for the fallback heuristic bot.
export const BOT_LEVELS = {
  beginner:     { elo: 600,  label: 'Beginner',     searchDepth: 1, timeBudgetMs: 200,  blunderRate: 0.15, randomness: 0.4,  depthScale: 0.3  },
  intermediate: { elo: 1000, label: 'Intermediate',  searchDepth: 2, timeBudgetMs: 800,  blunderRate: 0.05, randomness: 0.2,  depthScale: 0.6  },
  advanced:     { elo: 1400, label: 'Advanced',      searchDepth: 3, timeBudgetMs: 2000, blunderRate: 0.01, randomness: 0.08, depthScale: 0.85 },
  expert:       { elo: 1800, label: 'Expert',        searchDepth: 4, timeBudgetMs: 4000, blunderRate: 0,    randomness: 0.02, depthScale: 1.0  },
};

/**
 * Pick the difficulty level closest to a player's ELO.
 */
export function getBotLevelForElo(playerElo) {
  const levels = Object.entries(BOT_LEVELS);
  let closest = levels[0];
  let minDiff = Infinity;
  for (const entry of levels) {
    const diff = Math.abs(entry[1].elo - playerElo);
    if (diff < minDiff) { minDiff = diff; closest = entry; }
  }
  return closest[0];
}

export class PenteBot {
  /**
   * @param {number} botColor - This bot's stone color (BLACK, WHITE, RED, or BLUE)
   * @param {string} [level='expert'] - Difficulty key from BOT_LEVELS
   * @param {object} [gameMode=null] - Game mode config from GAME_MODES
   */
  constructor(botColor, level = 'expert', gameMode = null) {
    this.botColor = botColor;
    this.gameMode = gameMode;
    this.level = BOT_LEVELS[level] || BOT_LEVELS.expert;

    // In classic/no-gameMode, opponent is the other color
    // In multi-player, opponents are determined dynamically
    if (!gameMode || gameMode.key === 'classic') {
      this.opponentColor = botColor === BLACK ? WHITE : BLACK;
    } else {
      this.opponentColor = null; // multi-opponent — resolved per-evaluation
    }

    // Scale weights by difficulty
    const s = this.level.depthScale;
    this.weights = {
      WIN: 1000000,
      BLOCK_WIN: 500000,
      CAPTURE: 10000 * s,
      PREVENT_CAPTURE: 8000 * s,
      OPEN_FOUR: 5000 * s,
      BLOCK_OPEN_FOUR: 4500 * s,
      OPEN_THREE: 1000 * s,
      BLOCK_OPEN_THREE: 900 * s,
      PROXIMITY: 10 * s,
    };
  }

  /**
   * Get all opponent colors for this bot.
   */
  getOpponents() {
    if (this.opponentColor) return [this.opponentColor];
    if (!this.gameMode) return [this.botColor === BLACK ? WHITE : BLACK];
    return this.gameMode.turnOrder.filter(c =>
      c !== this.botColor && isOpp(this.botColor, c, this.gameMode)
    );
  }

  /**
   * Main entry point.
   * @param {number[][]} board
   * @param {number} botCaptures - This bot's capture count
   * @param {number} [oppCaptures] - Opponent's capture count (classic mode)
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

    const maxScoreForNoise = this.weights.WIN;

    for (const { row, col } of candidates) {
      let score = this.evaluateMove(board, row, col, botCaptures, oppCaptures);

      // Add difficulty-based randomness
      if (this.level.randomness > 0) {
        score += Math.random() * this.level.randomness * maxScoreForNoise;
      }

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
    const opponents = this.getOpponents();

    // Simulate bot's move
    board[row][col] = this.botColor;

    // Win by five?
    if (checkForFiveInARow(board, row, col, this.botColor)) {
      score += this.weights.WIN;
    }

    // Win by captures?
    const botCaps = this.countCaptures(board, row, col, this.botColor);
    if ((botCaptures || 0) + botCaps >= 5) {
      score += this.weights.WIN;
    }
    score += botCaps * this.weights.CAPTURE;

    // Block each opponent's win
    for (const opp of opponents) {
      board[row][col] = opp;
      if (checkForFiveInARow(board, row, col, opp)) {
        score += this.weights.BLOCK_WIN;
      }
      const oCaps = this.countCaptures(board, row, col, opp);
      if ((oppCaptures || 0) + oCaps >= 5) {
        score += this.weights.BLOCK_WIN;
      }
    }

    // Restore bot color for pattern analysis
    board[row][col] = this.botColor;

    // Line patterns in all 4 directions
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      score += this.scoreLinePattern(board, row, col, dr, dc, this.botColor, false);
      for (const opp of opponents) {
        score += this.scoreLinePattern(board, row, col, dr, dc, opp, true);
      }
    }

    // Prevent own pairs from being captured
    score += this.preventCaptureScore(board, row, col);

    // Proximity
    score += this.getProximityScore(board, row, col);

    // In team mode: bonus for supporting teammate structures
    if (this.gameMode?.teams) {
      score += this.teammateSupport(board, row, col);
    }

    // Undo
    board[row][col] = EMPTY;
    return score;
  }

  /**
   * Returns empty cells within 2 spaces of any existing stone.
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
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let pairs = 0;

    for (const [dx, dy] of dirs) {
      for (const sign of [1, -1]) {
        const sdx = dx * sign, sdy = dy * sign;
        const r1 = row + sdx, c1 = col + sdy;
        const r2 = row + 2 * sdx, c2 = col + 2 * sdy;
        const r3 = row + 3 * sdx, c3 = col + 3 * sdy;

        if (!isValidPosition(r1, c1) || !isValidPosition(r2, c2) || !isValidPosition(r3, c3)) continue;

        const mid1 = board[r1][c1];
        const mid2 = board[r2][c2];
        const far  = board[r3][c3];

        if (mid1 === EMPTY || mid2 === EMPTY || mid1 !== mid2) continue;

        if (!this.gameMode || this.gameMode.key === 'classic') {
          const opponent = color === BLACK ? WHITE : BLACK;
          if (mid1 === opponent && far === color) pairs++;
        } else if (this.gameMode.teams) {
          if (isOpp(color, mid1, this.gameMode) && !isOpp(color, far, this.gameMode) && far !== EMPTY) pairs++;
        } else {
          // FFA
          if (mid1 !== color && far === color) pairs++;
        }
      }
    }
    return pairs;
  }

  /**
   * Score line patterns (open 3s, open 4s) for a given color at (row, col).
   */
  scoreLinePattern(board, row, col, dRow, dCol, color, isBlocking) {
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
    const opponents = this.getOpponents();
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let score = 0;

    for (const [dx, dy] of dirs) {
      for (const sign of [1, -1]) {
        const sdx = dx * sign, sdy = dy * sign;
        const rBehind = row - sdx, cBehind = col - sdy;
        const r1 = row + sdx, c1 = col + sdy;
        const r2 = row + 2 * sdx, c2 = col + 2 * sdy;

        if (!isValidPosition(rBehind, cBehind) || !isValidPosition(r1, c1) || !isValidPosition(r2, c2)) continue;

        // Pattern: OPP . BOT BOT — placing at . prevents capture
        if (
          opponents.includes(board[rBehind][cBehind]) &&
          board[r1][c1] === this.botColor &&
          opponents.includes(board[r2][c2])
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

  /**
   * In team mode, bonus for moves that support teammate structures.
   * Checks if placing here extends a teammate's line or sets up a bracket.
   */
  teammateSupport(board, row, col) {
    if (!this.gameMode?.teams) return 0;
    const teammates = this.gameMode.turnOrder.filter(c =>
      c !== this.botColor && !isOpp(this.botColor, c, this.gameMode)
    );
    if (teammates.length === 0) return 0;

    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const mate of teammates) {
      for (const [dr, dc] of directions) {
        // Check if placing here extends a teammate's 2-in-a-row
        let count = 0;
        for (let i = 1; i <= 3; i++) {
          const r = row + i * dr, c = col + i * dc;
          if (!isValidPosition(r, c) || board[r][c] !== mate) break;
          count++;
        }
        for (let i = 1; i <= 3; i++) {
          const r = row - i * dr, c = col - i * dc;
          if (!isValidPosition(r, c) || board[r][c] !== mate) break;
          count++;
        }
        // Bonus for being near teammate lines (but don't overvalue — teammates can't help with five-in-a-row)
        if (count >= 2) score += this.weights.PROXIMITY * 5;
        else if (count >= 1) score += this.weights.PROXIMITY * 2;

        // Check if placing here creates a bracket for capturing with teammate
        for (const sign of [1, -1]) {
          const sdx = dr * sign, sdy = dc * sign;
          const r1 = row + sdx, c1 = col + sdy;
          const r2 = row + 2 * sdx, c2 = col + 2 * sdy;
          const r3 = row + 3 * sdx, c3 = col + 3 * sdy;
          if (!isValidPosition(r1, c1) || !isValidPosition(r2, c2) || !isValidPosition(r3, c3)) continue;
          // Pattern: [bot placing here] - OPP - OPP - TEAMMATE
          if (
            isOpp(this.botColor, board[r1][c1], this.gameMode) &&
            board[r1][c1] === board[r2][c2] &&
            teammates.includes(board[r3][c3])
          ) {
            score += this.weights.CAPTURE * 0.3;
          }
        }
      }
    }

    return score;
  }
}
