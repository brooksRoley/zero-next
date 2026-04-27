/* eslint-disable */
// Self-contained Go engine — no imports, mirrors Pente's penteWorker.js pattern.
// Loaded as a Web Worker; receives { id, type, payload }, posts { id, result }.

'use strict';

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

function isValid(r, c, size) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function getNeighbors(r, c, size) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < size - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < size - 1) out.push([r, c + 1]);
  return out;
}

function findGroup(board, row, col) {
  const size = board.length;
  const player = board[row][col];
  if (player === EMPTY) return { stones: [], liberties: new Set() };
  const visited = new Set();
  const stones = [];
  const liberties = new Set();
  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const key = r + ',' + c;
    if (visited.has(key)) continue;
    visited.add(key);
    if (board[r][c] !== player) continue;
    stones.push([r, c]);
    for (const [nr, nc] of getNeighbors(r, c, size)) {
      const v = board[nr][nc];
      if (v === EMPTY) liberties.add(nr + ',' + nc);
      else if (v === player) stack.push([nr, nc]);
    }
  }
  return { stones, liberties };
}

function applyMove(board, row, col, color, koPoint) {
  const size = board.length;
  if (!isValid(row, col, size)) return { error: 'oob' };
  if (board[row][col] !== EMPTY) return { error: 'occupied' };
  if (koPoint && koPoint[0] === row && koPoint[1] === col) return { error: 'ko' };
  const next = board.map(r => r.slice());
  next[row][col] = color;
  const opp = color === BLACK ? WHITE : BLACK;
  const captured = [];
  const seen = new Set();
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (next[nr][nc] !== opp) continue;
    const k = nr + ',' + nc;
    if (seen.has(k)) continue;
    const g = findGroup(next, nr, nc);
    for (const [sr, sc] of g.stones) seen.add(sr + ',' + sc);
    if (g.liberties.size === 0) {
      for (const [sr, sc] of g.stones) {
        next[sr][sc] = EMPTY;
        captured.push([sr, sc]);
      }
    }
  }
  if (captured.length === 0) {
    const own = findGroup(next, row, col);
    if (own.liberties.size === 0) return { error: 'suicide' };
  }
  let nextKo = null;
  if (captured.length === 1) {
    const own = findGroup(next, row, col);
    if (own.stones.length === 1 && own.liberties.size === 1) {
      nextKo = captured[0];
    }
  }
  return { newBoard: next, captured, nextKoPoint: nextKo };
}

function findTargetGroup(board, targetStones) {
  for (const [r, c] of targetStones) {
    if (board[r] && board[r][c] !== EMPTY) {
      return findGroup(board, r, c);
    }
  }
  return null;
}

/**
 * Greedy 1-ply tsumego defender. `color` is the side defending the target.
 * Strategy in priority order:
 *   1. If any move captures opponent stones → play it.
 *   2. If the defended group is in atari → extend on its last liberty if that
 *      gains liberties.
 *   3. Otherwise play the move that maximizes the defended group's resulting
 *      liberty count.
 *   4. Fallback: any legal non-suicidal move; otherwise pass.
 */
function findEngineResponse(board, color, goal, koPoint) {
  const size = board.length;

  const candidates = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue;
      if (koPoint && koPoint[0] === r && koPoint[1] === c) continue;
      candidates.push([r, c]);
    }
  }

  // 1. Play a capturing move if available
  for (const [r, c] of candidates) {
    const result = applyMove(board, r, c, color, koPoint);
    if (result.error) continue;
    if (result.captured.length > 0) {
      return { move: [r, c], reason: 'capture' };
    }
  }

  // 2-3. Extend defended group.
  //   - When in atari (1 liberty) we extend on the only liberty even if it
  //     doesn't gain any — buying a turn is better than doing nothing.
  //   - Otherwise we require strict liberty gain, picking the maximum.
  const defended = goal && goal.targetStones ? findTargetGroup(board, goal.targetStones) : null;
  if (!defended) {
    return { move: null, reason: 'no_target' };
  }

  if (defended.liberties.size === 1) {
    const libKey = defended.liberties.values().next().value;
    const [r, c] = libKey.split(',').map(Number);
    const result = applyMove(board, r, c, color, koPoint);
    if (!result.error) {
      return { move: [r, c], reason: 'extend_atari' };
    }
  } else {
    let bestMove = null;
    let bestLiberties = defended.liberties.size;
    for (const libKey of defended.liberties) {
      const [r, c] = libKey.split(',').map(Number);
      const result = applyMove(board, r, c, color, koPoint);
      if (result.error) continue;
      const newGroup = findGroup(result.newBoard, r, c);
      if (newGroup.liberties.size > bestLiberties) {
        bestLiberties = newGroup.liberties.size;
        bestMove = [r, c];
      }
    }
    if (bestMove) return { move: bestMove, reason: 'extend' };
  }

  // 4. Fallback: any legal non-suicidal move
  for (const [r, c] of candidates) {
    const result = applyMove(board, r, c, color, koPoint);
    if (!result.error) {
      return { move: [r, c], reason: 'fallback' };
    }
  }

  return { move: null, reason: 'pass' };
}

// ─────────────────────────────────────────────────────────────────────────────
// BOT GAMEPLAY ENGINE (vs-bot mode)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a candidate move for the greedy bot. Returns -Infinity for illegal
 * moves (null result from applyMove). Higher = better for `color`.
 */
function scoreBotMove(board, row, col, color, koPoint) {
  const result = applyMove(board, row, col, color, koPoint);
  if (result.error) return -Infinity;

  const size = board.length;
  const opp = color === BLACK ? WHITE : BLACK;
  let score = 0;

  // Captures: most important tactical signal
  score += result.captured.length * 6;

  // Atari: threaten opponent groups with 1 liberty after our move
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (result.newBoard[nr][nc] === opp) {
      const g = findGroup(result.newBoard, nr, nc);
      if (g.liberties.size === 1) score += 3;
    }
  }

  // Rescue own groups that were in atari before this move
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (board[nr][nc] === color) {
      const before = findGroup(board, nr, nc);
      if (before.liberties.size <= 1) {
        const after = findGroup(result.newBoard, nr, nc);
        if (after.liberties.size >= 3) score += 9;
        else if (after.liberties.size >= 2) score += 5;
      }
    }
  }

  // Liberty health of our placed stone's group
  const own = findGroup(result.newBoard, row, col);
  score += Math.min(own.liberties.size, 6) * 0.3;

  // Center preference (stronger on 9×9/13×13 where territory matters more)
  const center = (size - 1) / 2;
  const manhattan = Math.abs(row - center) + Math.abs(col - center);
  if (size <= 13) score += Math.max(0, size * 0.4 - manhattan) * 0.15;

  // Small random tiebreaker for variety
  score += (Math.random() - 0.5) * 0.4;
  return score;
}

/**
 * Find the best move for `color` at the given difficulty level.
 * level 1 → 75% random; level 2 → 30% random; level 3 → 5% random (fully greedy).
 */
function findBotMove(board, color, level, koPoint) {
  const size = board.length;
  const legal = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) {
        const res = applyMove(board, r, c, color, koPoint);
        if (!res.error) legal.push([r, c]);
      }
    }
  }
  if (legal.length === 0) return null;

  const randomRates = { 1: 0.75, 2: 0.30, 3: 0.05 };
  const randomRate = randomRates[level] !== undefined ? randomRates[level] : 0.30;

  if (Math.random() < randomRate) {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  let best = null;
  let bestScore = -Infinity;
  for (const [r, c] of legal) {
    const s = scoreBotMove(board, r, c, color, koPoint);
    if (s > bestScore) { bestScore = s; best = [r, c]; }
  }
  return best || legal[Math.floor(Math.random() * legal.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: MINIMAX WITH ALPHA-BETA PRUNING
// ─────────────────────────────────────────────────────────────────────────────

function opponent(color) { return color === BLACK ? WHITE : BLACK; }

/**
 * Territory flood-fill: mirrors scoring.js computeAreaScore but returns a
 * signed value (positive = good for maxColor, negative = bad).
 */
function estimateTerritory(board, maxColor) {
  const size = board.length;
  const minColor = opponent(maxColor);
  const visited = new Set();
  let score = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue;
      const key = r + ',' + c;
      if (visited.has(key)) continue;

      let touchesMax = false;
      let touchesMin = false;
      let regionSize = 0;
      const stack = [[r, c]];

      while (stack.length) {
        const [rr, cc] = stack.pop();
        const k = rr + ',' + cc;
        if (visited.has(k)) continue;
        visited.add(k);
        regionSize++;
        for (const [nr, nc] of getNeighbors(rr, cc, size)) {
          const v = board[nr][nc];
          if (v === EMPTY) stack.push([nr, nc]);
          else if (v === maxColor) touchesMax = true;
          else if (v === minColor) touchesMin = true;
        }
      }

      if (touchesMax && !touchesMin) score += regionSize;
      else if (touchesMin && !touchesMax) score -= regionSize;
    }
  }
  return score;
}

/**
 * Static board evaluation from maxColor's perspective.
 * Components: stone count + territory estimate + liberty health.
 */
function staticEval(board, maxColor) {
  const size = board.length;
  const minColor = opponent(maxColor);
  let stones = 0;
  let liberty = 0;
  const visited = new Set();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = board[r][c];
      if (cell === EMPTY) continue;
      if (cell === maxColor) stones++;
      else stones--;

      const key = r + ',' + c;
      if (visited.has(key)) continue;
      const g = findGroup(board, r, c);
      for (const s of g.stones) visited.add(s[0] + ',' + s[1]);

      const libCount = g.liberties.size;
      const sign = cell === maxColor ? 1 : -1;
      liberty += sign * Math.min(libCount, 6) * 0.2;
      // Extra penalty/bonus for atari
      if (libCount === 1) liberty += sign * -2.5;
    }
  }

  const territory = estimateTerritory(board, maxColor);
  return stones * 1.0 + territory * 0.9 + liberty;
}

/**
 * Opening star-point seeds per board size, used when the board has no stones
 * (bot moves first). Order: corners → edge stars → tengen.
 */
const OPENING_SEEDS = {
  9:  [[2,2],[2,6],[6,2],[6,6],[4,4],[2,4],[6,4],[4,2],[4,6]],
  13: [[3,3],[3,9],[9,3],[9,9],[6,6],[3,6],[9,6],[6,3],[6,9]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]],
};

/**
 * Generate a focused candidate list:
 *   urgent  — captures (enemy group at 1 lib) + escapes (own group at 1 lib)
 *   high    — atari threats (reduces enemy group to 1 lib)
 *   normal  — moves within 2 intersections of any existing stone, capped
 * Falls back to opening seeds when the board is empty.
 */
function generateCandidates(board, color, koPoint) {
  const size = board.length;
  const enemy = opponent(color);
  const urgent = [];
  const high = [];
  const normal = [];

  // Mark cells within 2 of any stone
  const near = new Set();
  let stoneCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) continue;
      stoneCount++;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === EMPTY) {
            near.add(nr * size + nc);
          }
        }
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue;
      if (koPoint && koPoint[0] === r && koPoint[1] === c) continue;

      const res = applyMove(board, r, c, color, koPoint);
      if (res.error) continue;

      // Urgent: captures
      if (res.captured.length > 0) { urgent.push([r, c]); continue; }

      // Urgent: escape own group from atari
      let isEscape = false;
      for (const [nr, nc] of getNeighbors(r, c, size)) {
        if (board[nr][nc] === color && findGroup(board, nr, nc).liberties.size === 1) {
          isEscape = true; break;
        }
      }
      if (isEscape) { urgent.push([r, c]); continue; }

      if (!near.has(r * size + c)) continue;

      // High priority: puts enemy group in atari
      let threatensAtari = false;
      for (const [nr, nc] of getNeighbors(r, c, size)) {
        if (res.newBoard[nr][nc] === enemy && findGroup(res.newBoard, nr, nc).liberties.size === 1) {
          threatensAtari = true; break;
        }
      }
      if (threatensAtari) { high.push([r, c]); continue; }

      normal.push([r, c]);
    }
  }

  // Opening fallback: no stones on board yet
  if (stoneCount === 0 && urgent.length === 0 && high.length === 0 && normal.length === 0) {
    const seeds = OPENING_SEEDS[size] || OPENING_SEEDS[9];
    for (const [r, c] of seeds) {
      if (board[r][c] === EMPTY && (!koPoint || koPoint[0] !== r || koPoint[1] !== c)) {
        normal.push([r, c]);
      }
    }
    return normal;
  }

  // Shuffle normal moves and cap to control branching factor
  for (let i = normal.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = normal[i]; normal[i] = normal[j]; normal[j] = tmp;
  }
  const cap = size <= 9 ? 25 : size <= 13 ? 18 : 14;

  return [...urgent, ...high, ...normal.slice(0, cap)];
}

/**
 * Alpha-beta minimax. Returns a score from maxColor's perspective.
 * consecutivePasses tracks back-to-back passes to detect game-over positions.
 */
function minimaxAB(board, color, maxColor, depth, alpha, beta, koPoint, consecutivePasses) {
  if (depth === 0) return staticEval(board, maxColor);

  const cands = generateCandidates(board, color, koPoint);

  if (cands.length === 0) {
    // Pass — if both players pass consecutively, evaluate final position
    if (consecutivePasses >= 1) return staticEval(board, maxColor);
    return minimaxAB(board, opponent(color), maxColor, depth - 1, alpha, beta, null, consecutivePasses + 1);
  }

  const isMax = color === maxColor;
  let best = isMax ? -Infinity : Infinity;

  for (const [r, c] of cands) {
    const res = applyMove(board, r, c, color, koPoint);
    if (res.error) continue;
    const val = minimaxAB(res.newBoard, opponent(color), maxColor, depth - 1, alpha, beta, res.nextKoPoint, 0);
    if (isMax) {
      if (val > best) best = val;
      if (val > alpha) alpha = val;
    } else {
      if (val < best) best = val;
      if (val < beta) beta = val;
    }
    if (beta <= alpha) break;
  }

  // All candidates were illegal (shouldn't happen, but guard anyway)
  if (best === (isMax ? -Infinity : Infinity)) return staticEval(board, maxColor);
  return best;
}

/**
 * Find the best move using minimax lookahead for levels 4 and 5.
 * Depth scales with board size to stay within the time budget.
 */
function findBotMoveWithLookahead(board, color, level, koPoint) {
  const size = board.length;
  // Level 4 (Tactical): depth 1 all sizes; Level 5 (Strong): deeper on smaller boards
  const depth = level === 5
    ? (size <= 9 ? 3 : 2)
    : 1;  // level 4

  const cands = generateCandidates(board, color, koPoint);
  if (cands.length === 0) return null;

  let best = -Infinity;
  let bestMove = null;

  for (const [r, c] of cands) {
    const res = applyMove(board, r, c, color, koPoint);
    if (res.error) continue;
    const val = minimaxAB(res.newBoard, opponent(color), color, depth - 1, -Infinity, Infinity, res.nextKoPoint, 0);
    if (val > best || (val === best && Math.random() < 0.1)) {
      best = val;
      bestMove = [r, c];
    }
  }

  return bestMove || cands[0];
}

// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = function(e) {
  const data = e.data || {};
  const { id, type, payload } = data;
  if (type === 'find_response') {
    try {
      // goal === null signals bot gameplay; otherwise use puzzle engine
      const result = (payload.goal == null)
        ? { move: findBotMove(payload.board, payload.color, payload.level || 2, payload.koPoint) }
        : findEngineResponse(payload.board, payload.color, payload.goal, payload.koPoint);
      self.postMessage({ id, result });
    } catch (err) {
      self.postMessage({ id, result: { move: null, reason: 'error', error: String(err) } });
    }
  }
};
