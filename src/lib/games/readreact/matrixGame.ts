/**
 * Read & React — pure zero-sum matrix game solver.
 *
 * Convention: `A[i][j]` is the payoff to the ROW player (offense, maximizer)
 * when offense plays row i and defense plays column j. Defense is the column
 * player (minimizer). No React, no DOM.
 */

export type Matrix = number[][];

export interface Equilibrium {
  /** Game value V (offense's guaranteed expected payoff under optimal play). */
  value: number;
  /** Offense's optimal mixed strategy over rows (sums to 1). */
  rowMix: number[];
  /** Defense's optimal mixed strategy over columns (sums to 1). */
  colMix: number[];
}

/** Expected payoff to offense when it plays `rowMix` and defense plays column j. */
export function columnPayoff(A: Matrix, rowMix: number[], j: number): number {
  let s = 0;
  for (let i = 0; i < A.length; i++) s += rowMix[i] * A[i][j];
  return s;
}

/**
 * Defense's exact best response to a known offense mix: the column that
 * MINIMIZES offense's expected payoff. Ties break to the lowest index.
 */
export function bestResponseColumn(A: Matrix, rowMix: number[]): number {
  const n = A[0].length;
  let best = 0;
  let bestVal = Infinity;
  for (let j = 0; j < n; j++) {
    const v = columnPayoff(A, rowMix, j);
    if (v < bestVal - 1e-12) {
      bestVal = v;
      best = j;
    }
  }
  return best;
}

/** Expected payoff to offense from playing row i against a known defense mix. */
function rowPayoff(A: Matrix, i: number, colMix: number[]): number {
  let s = 0;
  for (let j = 0; j < A[0].length; j++) s += A[i][j] * colMix[j];
  return s;
}

/** Offense's best response (row that MAXIMIZES payoff) to a defense mix. */
function bestResponseRow(A: Matrix, colMix: number[]): number {
  let best = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < A.length; i++) {
    const v = rowPayoff(A, i, colMix);
    if (v > bestVal + 1e-12) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

/**
 * Solve the zero-sum game by fictitious play. Both players repeatedly best-
 * respond to the opponent's empirical strategy; for zero-sum games the empirical
 * frequencies converge to an equilibrium and the average payoff to the value V
 * (Robinson 1951). Exact enough for a teaching reveal — cross-checked in tests
 * against games with known closed-form solutions.
 */
export function solveZeroSum(A: Matrix, iterations = 20000): Equilibrium {
  const m = A.length;
  const n = A[0].length;
  const rowCounts = new Array(m).fill(0);
  const colCounts = new Array(n).fill(0);

  // Seed each side with one arbitrary move so empirical mixes are well-defined.
  rowCounts[0] = 1;
  colCounts[0] = 1;

  for (let t = 0; t < iterations; t++) {
    const rowTotal = t + 1;
    const colTotal = t + 1;
    const rowMix = rowCounts.map((c) => c / rowTotal);
    const colMix = colCounts.map((c) => c / colTotal);
    rowCounts[bestResponseRow(A, colMix)]++;
    colCounts[bestResponseColumn(A, rowMix)]++;
  }

  const total = iterations + 1;
  const rowMix = rowCounts.map((c) => c / total);
  const colMix = colCounts.map((c) => c / total);
  let value = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) value += rowMix[i] * A[i][j] * colMix[j];
  }
  return { value, rowMix, colMix };
}

/** True if a mixed strategy is effectively pure (one action carries ~all mass). */
export function isPure(mix: number[], threshold = 0.9): boolean {
  return mix.some((p) => p >= threshold);
}
