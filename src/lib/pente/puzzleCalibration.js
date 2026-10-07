/**
 * Puzzle-rating calibration: compares each puzzle_bank puzzle's actual solve
 * rate against what its stated `rating` predicts, using the standard Elo
 * expected-score formula with the median solver's puzzle ELO as the
 * reference strength. A puzzle rated 1200 with a 95% solve rate is
 * functionally much easier than 1200 — this surfaces that gap so
 * `puzzle_bank.rating` can eventually be corrected (visibility only for now;
 * this does not write back to the table).
 *
 * Read-only diagnostic consumed by /api/admin/analytics and rendered on
 * /admin/analytics. Flagged 8x across sessions (7x under the pre-07-26
 * "Basketball Modeling" ledger, 1x in the current "zero-next — Running
 * Notes" ledger, 2026-09-01) before shipping here.
 */

/** Puzzles with fewer than this many attempts are excluded — a puzzle served
 *  twice and solved twice isn't miscalibrated, it's a sample size of two. */
export const MIN_ATTEMPTS_FOR_CALIBRATION = 5;

/**
 * Standard Elo expected-score formula: the probability a solver rated
 * `referenceElo` solves a puzzle rated `rating`.
 */
export function expectedSolveRate(rating, referenceElo) {
  return 1 / (1 + Math.pow(10, (rating - referenceElo) / 400));
}

/** Median of a numeric array, or null when empty. Preferred over the mean so
 *  a handful of very strong or very new players don't skew the reference
 *  strength used for every puzzle's expected solve rate. */
export function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Ranks puzzle_bank rows by |actual solve rate − expected solve rate|,
 * worst-calibrated first. Rows below MIN_ATTEMPTS_FOR_CALIBRATION or missing
 * a usable rating/attempt count are silently dropped rather than throwing —
 * this is a best-effort dashboard widget, not a data-integrity gate.
 *
 * @param {Array<{id: string, rating: number, times_served: number, times_solved: number}>} puzzles
 * @param {number} referenceElo
 * @param {number} [limit]
 */
export function computeCalibration(puzzles, referenceElo, limit = 10) {
  if (!Array.isArray(puzzles) || !Number.isFinite(referenceElo)) return [];

  return puzzles
    .filter(
      (p) =>
        Number.isFinite(p?.rating) &&
        Number.isFinite(p?.times_served) &&
        Number.isFinite(p?.times_solved) &&
        p.times_served >= MIN_ATTEMPTS_FOR_CALIBRATION
    )
    .map((p) => {
      const solveRate = p.times_solved / p.times_served;
      const expected = expectedSolveRate(p.rating, referenceElo);
      return {
        id: p.id,
        rating: p.rating,
        timesServed: p.times_served,
        timesSolved: p.times_solved,
        solveRate: round3(solveRate),
        expectedSolveRate: round3(expected),
        gap: round3(Math.abs(solveRate - expected)),
      };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}
