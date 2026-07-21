import { describe, it, expect } from "vitest";
import { generateSpatialPrior, type PlayerProfile } from "src/lib/nba/tft/spatial-priors";
import { ZONE_IDS } from "src/lib/nba/tft/zones";

const CURRY: PlayerProfile = {
  playerId: 1,
  position: "PG",
  heightInches: 74,
  avgPoints: 28,
  threePtRate: 0.55,  // fraction of FGA that are 3s
  fgPct: 0.48,
  threePct: 0.42,
};

const GOBERT: PlayerProfile = {
  playerId: 2,
  position: "C",
  heightInches: 85,
  avgPoints: 12,
  threePtRate: 0.02,
  fgPct: 0.65,
  threePct: 0.10,
};

describe("spatial-priors", () => {
  it("returns a distribution summing to 1 over 8 zones", () => {
    const p = generateSpatialPrior(CURRY);
    const total = ZONE_IDS.reduce((s, z) => s + (p.zoneShare[z] ?? 0), 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("Curry-like profile has > 50% of attempts from 3-point zones", () => {
    const p = generateSpatialPrior(CURRY);
    const threePtShare =
      p.zoneShare["left-corner-3"] + p.zoneShare["right-corner-3"] +
      p.zoneShare["left-wing-3"] + p.zoneShare["right-wing-3"] +
      p.zoneShare["top-of-key"];
    expect(threePtShare).toBeGreaterThan(0.5);
  });

  it("Gobert-like profile has > 70% of attempts from paint", () => {
    const p = generateSpatialPrior(GOBERT);
    expect(p.zoneShare.paint).toBeGreaterThan(0.7);
  });

  it("assigns higher expected difficulty to contested zones", () => {
    const p = generateSpatialPrior(CURRY);
    // top-of-key with a defender approach is harder than a wide-open corner
    expect(p.zoneDifficulty["top-of-key"]).toBeGreaterThan(p.zoneDifficulty["left-corner-3"]);
  });
});
