import { describe, it, expect } from "vitest";
import {
  solveZeroSum,
  bestResponseColumn,
  columnPayoff,
  isPure,
  type Matrix,
} from "../matrixGame";

describe("bestResponseColumn", () => {
  it("picks the column that minimizes offense's payoff", () => {
    const A: Matrix = [
      [1.24, 0.8],
      [0.75, 1.17],
    ];
    // Offense certain to play row 0: defense should pick col 1 (0.8 < 1.24).
    expect(bestResponseColumn(A, [1, 0])).toBe(1);
    // Offense certain to play row 1: defense should pick col 0 (0.75 < 1.17).
    expect(bestResponseColumn(A, [0, 1])).toBe(0);
  });

  it("columnPayoff mixes rows correctly", () => {
    const A: Matrix = [
      [2, 0],
      [0, 2],
    ];
    expect(columnPayoff(A, [0.5, 0.5], 0)).toBeCloseTo(1, 6);
  });
});

describe("solveZeroSum", () => {
  it("rock-paper-scissors has value 0 and a uniform mix", () => {
    // Row payoff: +1 win, -1 lose, 0 tie.
    const rps: Matrix = [
      [0, -1, 1],
      [1, 0, -1],
      [-1, 1, 0],
    ];
    const eq = solveZeroSum(rps);
    expect(eq.value).toBeCloseTo(0, 2);
    for (const p of eq.rowMix) expect(p).toBeCloseTo(1 / 3, 1);
  });

  it("matching pennies has value 0", () => {
    const mp: Matrix = [
      [1, -1],
      [-1, 1],
    ];
    const eq = solveZeroSum(mp);
    expect(eq.value).toBeCloseTo(0, 2);
    expect(eq.rowMix[0]).toBeCloseTo(0.5, 1);
  });

  it("a dominant-strategy game resolves to a pure equilibrium", () => {
    // Row 0 beats row 1 in every column → offense plays row 0 always; defense
    // minimizes to the smaller row-0 entry (1.05). V = 1.05.
    const A: Matrix = [
      [1.15, 1.05],
      [0.84, 0.8],
    ];
    const eq = solveZeroSum(A);
    expect(isPure(eq.rowMix)).toBe(true);
    expect(eq.value).toBeCloseTo(1.05, 2);
  });

  it("a no-dominant 2x2 resolves to a genuine mix bracketing the pure payoffs", () => {
    const A: Matrix = [
      [0.85, 1.24], // Paint: bad vs protect-paint, great vs contest-three
      [1.17, 0.75], // Corner3: great vs protect-paint, bad vs contest-three
    ];
    const eq = solveZeroSum(A);
    expect(isPure(eq.rowMix)).toBe(false);
    // Value sits strictly inside the payoff range (defense can hold it below the
    // 1.24 max but offense forces it above the 0.75 min).
    expect(eq.value).toBeGreaterThan(0.9);
    expect(eq.value).toBeLessThan(1.17);
  });
});
