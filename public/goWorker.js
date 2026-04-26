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

self.onmessage = function(e) {
  const data = e.data || {};
  const { id, type, payload } = data;
  if (type === 'find_response') {
    try {
      const result = findEngineResponse(payload.board, payload.color, payload.goal, payload.koPoint);
      self.postMessage({ id, result });
    } catch (err) {
      self.postMessage({ id, result: { move: null, reason: 'error', error: String(err) } });
    }
  }
};
