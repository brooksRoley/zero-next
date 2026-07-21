import { describe, it, expect } from "vitest";
import { SCHEMES, schemeEffect, ZONE_MULT_BOUNDS } from "src/lib/nba/tft/scheme-effects";

describe("scheme-effects", () => {
  it("declares 5 schemes", () => {
    expect(SCHEMES).toEqual(["drop", "switch", "blitz", "ICE", "zone"]);
  });

  it("every scheme's zone multiplier is within [0.5, 1.5]", () => {
    for (const s of SCHEMES) {
      const eff = schemeEffect(s);
      for (const mult of Object.values(eff.zoneAttemptMult)) {
        expect(mult).toBeGreaterThanOrEqual(ZONE_MULT_BOUNDS.min);
        expect(mult).toBeLessThanOrEqual(ZONE_MULT_BOUNDS.max);
      }
    }
  });

  it("drop scheme suppresses at-rim, elevates mid-range", () => {
    const eff = schemeEffect("drop");
    expect(eff.zoneAttemptMult.paint).toBeLessThan(1);
    expect(eff.zoneAttemptMult["left-mid"]).toBeGreaterThan(1);
    expect(eff.zoneAttemptMult["right-mid"]).toBeGreaterThan(1);
  });

  it("blitz raises turnover bonus, lowers 3P efficiency", () => {
    const eff = schemeEffect("blitz");
    expect(eff.turnoverBonus).toBeGreaterThan(0);
    expect(eff.threePctPenalty).toBeGreaterThan(0);
  });
});
