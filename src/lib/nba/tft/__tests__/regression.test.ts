import { describe, it, expect } from "vitest";
import { lossWL, lossBox, lossSpatial, combinedLoss } from "src/lib/nba/tft/regression";

describe("regression loss", () => {
  it("lossWL returns 0 when sim wins == actual wins for every team", () => {
    expect(lossWL({ 1: 50, 2: 30 }, { 1: 50, 2: 30 })).toBe(0);
  });

  it("lossWL returns > 0 when there is disagreement", () => {
    expect(lossWL({ 1: 50 }, { 1: 40 })).toBeCloseTo(10 / 82, 5);
  });

  it("lossBox is 0 for identical box lines", () => {
    const box = { 1: { pts: 25, reb: 7, ast: 5, fga: 20, fga3: 8 } };
    expect(lossBox(box, box, { 1: 2000 })).toBe(0);
  });

  it("lossSpatial is 0 for identical distributions", () => {
    const bins = { 1: { paint: 0.5, "top-of-key": 0.5 } };
    expect(lossSpatial(bins, bins, { 1: 100 })).toBe(0);
  });

  it("combinedLoss weighs terms per config", () => {
    const wl = 0.1, box = 0.2, spa = 0.3;
    const total = combinedLoss({ wl, box, spa }, { wl: 1, box: 0, spa: 0 });
    expect(total).toBe(wl);
  });
});
