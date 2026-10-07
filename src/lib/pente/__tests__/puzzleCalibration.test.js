import { describe, it, expect } from "vitest";
import {
  expectedSolveRate,
  median,
  computeCalibration,
  MIN_ATTEMPTS_FOR_CALIBRATION,
} from "../puzzleCalibration";

describe("expectedSolveRate", () => {
  it("returns 0.5 when the puzzle rating equals the reference ELO", () => {
    expect(expectedSolveRate(1200, 1200)).toBeCloseTo(0.5, 6);
  });

  it("returns a higher expected rate for an easier (lower-rated) puzzle", () => {
    expect(expectedSolveRate(1000, 1200)).toBeGreaterThan(0.5);
  });

  it("returns a lower expected rate for a harder (higher-rated) puzzle", () => {
    expect(expectedSolveRate(1400, 1200)).toBeLessThan(0.5);
  });
});

describe("median", () => {
  it("returns null for an empty array", () => {
    expect(median([])).toBeNull();
  });

  it("returns the middle value for an odd-length array", () => {
    expect(median([1000, 1400, 1200])).toBe(1200);
  });

  it("averages the two middle values for an even-length array", () => {
    expect(median([1000, 1200, 1300, 1400])).toBe(1250);
  });
});

describe("computeCalibration", () => {
  const referenceElo = 1200;

  it("ranks puzzles by |actual − expected| solve rate, worst first", () => {
    const puzzles = [
      // Rated 1200 (expected ~50%) but solved 95% of the time — badly miscalibrated (too easy for its rating).
      { id: "a", rating: 1200, times_served: 20, times_solved: 19 },
      // Rated 1200, solved exactly 50% — perfectly calibrated (gap = 0).
      { id: "b", rating: 1200, times_served: 20, times_solved: 10 },
      // Rated 1600 (expected low) but almost never solved — roughly calibrated (correctly hard).
      { id: "c", rating: 1600, times_served: 20, times_solved: 1 },
    ];

    const result = computeCalibration(puzzles, referenceElo);

    // "a" (95% solved at a 50%-expected rating) is the worst-calibrated;
    // "b" (solved exactly at its expected rate) is the best.
    expect(result[0].id).toBe("a");
    expect(result[result.length - 1].id).toBe("b");
    expect(result[0].gap).toBeGreaterThan(result[result.length - 1].gap);
  });

  it("excludes puzzles below the minimum attempt threshold", () => {
    const puzzles = [
      {
        id: "low-sample",
        rating: 1200,
        times_served: MIN_ATTEMPTS_FOR_CALIBRATION - 1,
        times_solved: 0,
      },
      {
        id: "enough-sample",
        rating: 1200,
        times_served: MIN_ATTEMPTS_FOR_CALIBRATION,
        times_solved: 0,
      },
    ];

    const result = computeCalibration(puzzles, referenceElo);

    expect(result.map((r) => r.id)).toEqual(["enough-sample"]);
  });

  it("drops rows with missing or non-numeric fields instead of throwing", () => {
    const puzzles = [
      { id: "missing-rating", times_served: 10, times_solved: 5 },
      { id: "missing-counts", rating: 1200 },
      null,
      undefined,
    ];

    expect(() => computeCalibration(puzzles, referenceElo)).not.toThrow();
    expect(computeCalibration(puzzles, referenceElo)).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const puzzles = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      rating: 1000 + i * 10,
      times_served: 10,
      times_solved: i,
    }));

    expect(computeCalibration(puzzles, referenceElo, 3)).toHaveLength(3);
  });

  it("returns an empty array when referenceElo is not finite (e.g. no players yet)", () => {
    const puzzles = [{ id: "a", rating: 1200, times_served: 10, times_solved: 5 }];
    expect(computeCalibration(puzzles, NaN)).toEqual([]);
    expect(computeCalibration(puzzles, null)).toEqual([]);
  });
});
