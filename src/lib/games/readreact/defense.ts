/**
 * Read & React — the adaptive defense bot.
 *
 * It best-responds to the offense's SMOOTHED empirical play frequency. Laplace
 * smoothing keeps it near a best response to a uniform offense early on (so it
 * doesn't hard-counter the very first possession); as the player reveals a
 * tendency, the smoothed mix sharpens and the defense keys on it — which is the
 * whole lesson: predictability gets punished, so you must mix.
 */
import { bestResponseColumn, type Matrix } from "./matrixGame";

export interface DefenseOptions {
  /** Pseudo-count added to each play; higher = slower to react. Default 1. */
  smoothing?: number;
}

/** The defense's smoothed model of how the offense has been playing. */
export function offenseModel(playCounts: number[], smoothing = 1): number[] {
  const total = playCounts.reduce((s, c) => s + c, 0);
  const denom = total + smoothing * playCounts.length;
  return playCounts.map((c) => (c + smoothing) / denom);
}

/**
 * Choose the scheme (column) that best-responds to the offense's smoothed
 * play history. `playCounts[i]` = how many times offense has called play i.
 */
export function chooseScheme(
  A: Matrix,
  playCounts: number[],
  opts: DefenseOptions = {}
): number {
  return bestResponseColumn(A, offenseModel(playCounts, opts.smoothing ?? 1));
}
