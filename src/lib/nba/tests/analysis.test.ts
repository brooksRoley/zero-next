/**
 * Coverage for src/lib/nba/analysis.ts — the pure statistical layer behind
 * League Lens's outlier board and similarity comps.
 *
 * This module had no tests despite being the only place in the NBA surface
 * that computes anything: every "outlier" badge and "most similar player"
 * result on the explorer is one of these four functions. A silent regression
 * here produces confidently wrong basketball claims rather than an error.
 */
import { describe, it, expect } from "vitest";
import {
  zScores,
  zScoreMatrix,
  euclidean,
  nearestNeighbors,
} from "src/lib/nba/analysis";

describe("zScores", () => {
  it("centers on the mean and scales by the standard deviation", () => {
    // mean 30, population std sqrt(((-10)^2 + 10^2)/2) = 10 → [-1, 1]
    expect(zScores([20, 40])).toEqual([-1, 1]);
  });

  /**
   * Pinned deliberately: the divisor is n, not n-1. Z-scoring a complete pool
   * (every player-season in the store) is a population operation, and swapping
   * in the sample std would silently shrink every z — turning [20,30,40] into
   * ±1.0 instead of ±1.2247 and quietly reclassifying who counts as an outlier.
   */
  it("uses the population standard deviation (divisor n), not the sample one", () => {
    const z = zScores([20, 30, 40]);
    expect(z[0]).toBeCloseTo(-Math.sqrt(1.5), 12); // -1.2247…, not -1
    expect(z[1]).toBe(0);
    expect(z[2]).toBeCloseTo(Math.sqrt(1.5), 12);
  });

  it("produces a series with mean 0 and unit variance", () => {
    const z = zScores([1, 4, 9, 16, 25, 36]);
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const variance = z.reduce((a, b) => a + (b - mean) ** 2, 0) / z.length;
    expect(mean).toBeCloseTo(0, 10);
    expect(variance).toBeCloseTo(1, 10);
  });

  it("preserves ordering, so the largest input is the largest z", () => {
    const values = [12.4, 30.1, 8.8, 24.8, 26.3];
    const z = zScores(values);
    const maxValueIndex = values.indexOf(Math.max(...values));
    const maxZIndex = z.indexOf(Math.max(...z));
    expect(maxZIndex).toBe(maxValueIndex);
  });

  it("returns an empty array for an empty series", () => {
    expect(zScores([])).toEqual([]);
  });

  it("returns 0 for a single-element series rather than dividing by zero", () => {
    expect(zScores([24.8])).toEqual([0]);
  });

  it("returns all zeros for a zero-variance series", () => {
    expect(zScores([7, 7, 7, 7])).toEqual([0, 0, 0, 0]);
  });

  /**
   * The relative-epsilon guard, not `std === 0`. A uniform pool's computed mean
   * can differ from its own values by 1 ulp, leaving std ~1e-16; an exact-zero
   * check would let that through and emit z of exactly ±1 — which the explorer
   * renders as a 70/30 rating, i.e. a fabricated outlier from a flat pool.
   */
  it("treats float-noise variance as zero so a uniform pool yields no fake outliers", () => {
    const uniform = Array.from({ length: 50 }, () => 0.1 + 0.2); // 0.30000000000000004
    const z = zScores(uniform);
    expect(z.every((v) => v === 0)).toBe(true);
  });

  it("applies the guard proportionally to magnitude, not as a fixed epsilon", () => {
    // Large values whose spread is negligible relative to their scale.
    const z = zScores([1e9, 1e9 + 1e-3, 1e9 - 1e-3]);
    expect(z.every((v) => v === 0)).toBe(true);
  });

  it("still detects a genuinely small but real spread near zero", () => {
    const z = zScores([0.001, 0.002, 0.003]);
    expect(z.some((v) => v !== 0)).toBe(true);
  });
});

describe("zScoreMatrix", () => {
  type Row = { ppg: number; rpg: number };
  // Two rows keep the expected z-scores exact (±1) rather than irrational.
  const rows: Row[] = [
    { ppg: 20, rpg: 5 },
    { ppg: 40, rpg: 15 },
  ];
  const fields = [(r: Row) => r.ppg, (r: Row) => r.rpg];

  it("returns one vector per row, aligned with the field list", () => {
    const m = zScoreMatrix(rows, fields);
    expect(m).toHaveLength(2);
    expect(m[0]).toHaveLength(2);
  });

  it("z-scores each field independently, so differing units cannot dominate", () => {
    const m = zScoreMatrix(rows, fields);
    // ppg spans 20 points and rpg only 10, but both normalize to the same
    // profile — without this, raw scoring would swamp every similarity comp.
    expect(m[0]).toEqual([-1, -1]);
    expect(m[1]).toEqual([1, 1]);
  });

  it("zeros a constant field without affecting the others", () => {
    const withFlat = [
      { ppg: 20, rpg: 8 },
      { ppg: 40, rpg: 8 },
    ];
    const m = zScoreMatrix(withFlat, fields);
    expect(m.map((v) => v[1])).toEqual([0, 0]);
    expect(m.map((v) => v[0])).toEqual([-1, 1]);
  });

  it("handles an empty row set", () => {
    expect(zScoreMatrix([] as Row[], fields)).toEqual([]);
  });
});

describe("euclidean", () => {
  it("computes a known 3-4-5 distance", () => {
    expect(euclidean([0, 0], [3, 4])).toBe(5);
  });

  it("is zero for identical vectors", () => {
    expect(euclidean([1.5, -2, 0.25], [1.5, -2, 0.25])).toBe(0);
  });

  it("is symmetric", () => {
    const a = [1, 2, 3];
    const b = [-4, 0, 2.5];
    expect(euclidean(a, b)).toBeCloseTo(euclidean(b, a), 12);
  });
});

describe("nearestNeighbors", () => {
  // A deliberately ordered 1-D space so expected neighbors are unambiguous.
  const vectors = [[0], [1], [2], [5], [9]];

  it("excludes the target itself", () => {
    const result = nearestNeighbors(vectors, 0, 4);
    expect(result.map((r) => r.index)).not.toContain(0);
  });

  it("returns neighbors nearest-first", () => {
    const result = nearestNeighbors(vectors, 0, 4);
    expect(result.map((r) => r.index)).toEqual([1, 2, 3, 4]);
    const distances = result.map((r) => r.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it("respects k", () => {
    // Target is [2]: distances are [1]→1, [0]→2, [5]→3, [9]→7.
    expect(nearestNeighbors(vectors, 2, 2).map((r) => r.index)).toEqual([1, 0]);
  });

  it("returns everything available when k exceeds the pool", () => {
    // 5 vectors, target excluded → at most 4 neighbors.
    expect(nearestNeighbors(vectors, 0, 99)).toHaveLength(4);
  });

  it("reports the actual distance alongside each neighbor", () => {
    const [closest] = nearestNeighbors(vectors, 3, 1);
    expect(closest.index).toBe(2); // [2] is 3 away; [9] is 4 away
    expect(closest.distance).toBe(3);
  });

  it("finds a comp in multi-dimensional stat space", () => {
    // index 0 is the target; index 2 is its near-twin, index 1 is far off.
    const statSpace = [
      [1.2, 0.8, -0.4],
      [-1.9, 2.2, 1.7],
      [1.1, 0.9, -0.3],
    ];
    const [comp] = nearestNeighbors(statSpace, 0, 1);
    expect(comp.index).toBe(2);
  });

  it("returns an empty list when the pool holds only the target", () => {
    expect(nearestNeighbors([[1, 2]], 0, 5)).toEqual([]);
  });
});
