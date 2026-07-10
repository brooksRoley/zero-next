import { describe, it, expect } from "vitest";
import {
  impliedProbability,
  decimalOdds,
  overround,
  holdPercent,
  devig,
  breakEvenWinRate,
  expectedLossPer100,
  round,
} from "src/lib/rig/odds-math";

describe("impliedProbability", () => {
  it("converts standard -110 juice to ~52.38%", () => {
    expect(impliedProbability(-110)).toBeCloseTo(0.5238, 4);
  });

  it("converts even money +100 to 50%", () => {
    expect(impliedProbability(100)).toBeCloseTo(0.5, 10);
  });

  it("converts a heavy favorite -650 to ~86.7%", () => {
    expect(impliedProbability(-650)).toBeCloseTo(650 / 750, 10);
  });

  it("converts a longshot +475 to ~17.4%", () => {
    expect(impliedProbability(475)).toBeCloseTo(100 / 575, 10);
  });

  it("throws on zero and non-finite input", () => {
    expect(() => impliedProbability(0)).toThrow();
    expect(() => impliedProbability(NaN)).toThrow();
    expect(() => impliedProbability(Infinity)).toThrow();
  });
});

describe("decimalOdds", () => {
  it("maps -110 to ~1.909", () => {
    expect(decimalOdds(-110)).toBeCloseTo(1.9091, 4);
  });

  it("maps +150 to 2.5", () => {
    expect(decimalOdds(150)).toBeCloseTo(2.5, 10);
  });

  it("throws on zero", () => {
    expect(() => decimalOdds(0)).toThrow();
  });
});

describe("overround / holdPercent", () => {
  it("a fair +100/+100 market has zero overround and zero hold", () => {
    expect(overround([100, 100])).toBeCloseTo(0, 10);
    expect(holdPercent([100, 100])).toBeCloseTo(0, 10);
  });

  it("the classic -110/-110 market has ~4.76% overround and ~4.55% hold", () => {
    expect(overround([-110, -110])).toBeCloseTo(0.047619, 5);
    expect(holdPercent([-110, -110])).toBeCloseTo(4.5455, 3);
  });

  it("a lopsided -650/+475 market still holds margin for the book", () => {
    const o = overround([-650, 475]);
    expect(o).toBeGreaterThan(0.03);
    expect(o).toBeLessThan(0.07);
  });

  it("throws with fewer than two outcomes", () => {
    expect(() => overround([-110])).toThrow();
  });
});

describe("devig", () => {
  it("normalized probabilities sum to 1", () => {
    const fair = devig([-650, 475]);
    expect(fair.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("preserves the favorite ordering", () => {
    const [fav, dog] = devig([-650, 475]);
    expect(fav).toBeGreaterThan(dog);
    expect(fav).toBeGreaterThan(0.8);
  });

  it("a symmetric market devigs to 50/50", () => {
    const [a, b] = devig([-110, -110]);
    expect(a).toBeCloseTo(0.5, 10);
    expect(b).toBeCloseTo(0.5, 10);
  });
});

describe("breakEvenWinRate", () => {
  it("at -110 the bettor must win 52.38% just to break even", () => {
    expect(breakEvenWinRate(-110)).toBeCloseTo(52.38, 2);
  });
});

describe("expectedLossPer100", () => {
  it("random betting into -110/-110 loses ~$4.55 per $100", () => {
    expect(expectedLossPer100([-110, -110])).toBeCloseTo(4.5455, 3);
  });
});

describe("round", () => {
  it("rounds to the requested decimals", () => {
    expect(round(4.5455, 2)).toBe(4.55);
    expect(round(4.5455)).toBe(4.5);
    expect(round(-3.25, 1)).toBe(-3.2); // JS Math.round toward +Infinity — deterministic
  });
});
