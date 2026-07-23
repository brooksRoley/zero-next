import { describe, it, expect } from "vitest";
import { LEVELS, evMatrix } from "../levels";
import { solveZeroSum, isPure } from "../matrixGame";

describe("Read & React campaign levels", () => {
  it("has a coherent arc: at least one dominant-strategy level and several mixed", () => {
    const types = LEVELS.map((l) => l.intendedType);
    expect(types).toContain("dominant");
    expect(types.filter((t) => t === "mixed").length).toBeGreaterThanOrEqual(3);
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
  });

  for (const level of LEVELS) {
    it(`level "${level.id}" solves to its intended equilibrium type (${level.intendedType})`, () => {
      const eq = solveZeroSum(evMatrix(level));
      if (level.intendedType === "dominant") {
        expect(isPure(eq.rowMix)).toBe(true);
      } else {
        // Genuinely mixed: no single play carries ~all the weight.
        expect(isPure(eq.rowMix)).toBe(false);
      }
      // Value is a sane points-per-possession figure.
      expect(eq.value).toBeGreaterThan(0.5);
      expect(eq.value).toBeLessThan(1.6);
    });

    it(`level "${level.id}" has a well-formed make grid`, () => {
      expect(level.makeGrid).toHaveLength(level.plays.length);
      for (const row of level.makeGrid) {
        expect(row).toHaveLength(level.schemes.length);
        for (const p of row) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      }
      expect(level.possessions).toBeGreaterThanOrEqual(6);
    });
  }
});
