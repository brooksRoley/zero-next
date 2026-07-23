import { describe, it, expect } from "vitest";
import { chooseScheme, offenseModel } from "../defense";
import type { Matrix } from "../matrixGame";

// Paint vs Corner3 against protect-paint (col 0) vs contest-three (col 1).
const A: Matrix = [
  [0.85, 1.24], // Paint: countered by protect-paint (col 0)
  [1.17, 0.75], // Corner3: countered by contest-three (col 1)
];

describe("adaptive defense", () => {
  it("with no history, best-responds to a roughly uniform offense (doesn't insta-counter)", () => {
    // vs a uniform offense, col 1 holds offense lowest (0.995 < 1.01).
    expect(chooseScheme(A, [0, 0])).toBe(1);
  });

  it("keys on a spammed play and counters it", () => {
    // Offense has called Paint (row 0) repeatedly → defense switches to
    // protect-paint (col 0), the best response to pure Paint.
    expect(chooseScheme(A, [100, 0])).toBe(0);
    // Symmetrically, spamming Corner3 draws contest-three (col 1).
    expect(chooseScheme(A, [0, 100])).toBe(1);
  });

  it("smoothing controls how fast the model reacts to history", () => {
    // Same single Paint observation: heavy smoothing keeps the model near
    // uniform, light smoothing lets it swing hard toward Paint.
    const gentle = offenseModel([1, 0], 10);
    const sharp = offenseModel([1, 0], 0.01);
    expect(gentle[0]).toBeGreaterThan(gentle[1]); // leans Paint, but only slightly
    expect(gentle[0]).toBeLessThan(0.6);
    expect(sharp[0]).toBeGreaterThan(0.95); // nearly certain Paint
    expect(gentle.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 6);
    expect(sharp.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 6);
  });
});
