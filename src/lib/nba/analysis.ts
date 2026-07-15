/**
 * Pure statistical helpers for League Lens (outliers, similarity).
 * Client-importable — no DB or network dependencies. All math operates on
 * stored, source-published stats; nothing here fabricates new metrics.
 */

/** Z-scores for a numeric series. Zero-variance series → all zeros. */
export function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  // Relative epsilon, not === 0: a uniform pool's mean can differ from its
  // values by 1 ulp, leaving std ~1e-16 and z exactly ±1 (rating 70/30).
  if (std < 1e-9 * Math.max(1, Math.abs(mean))) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

/**
 * Z-score each row across the given numeric fields.
 * Returns one vector per row, aligned with `fields`.
 */
export function zScoreMatrix<T>(
  rows: T[],
  fields: Array<(row: T) => number>
): number[][] {
  const columns = fields.map((get) => zScores(rows.map(get)));
  return rows.map((_, i) => columns.map((col) => col[i]));
}

/** Euclidean distance between two equal-length vectors. */
export function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * Indexes of the k rows nearest to `targetIndex` in z-scored stat space
 * (the target itself excluded), nearest first.
 */
export function nearestNeighbors(
  vectors: number[][],
  targetIndex: number,
  k: number
): Array<{ index: number; distance: number }> {
  const target = vectors[targetIndex];
  return vectors
    .map((v, index) => ({ index, distance: euclidean(v, target) }))
    .filter((d) => d.index !== targetIndex)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}
