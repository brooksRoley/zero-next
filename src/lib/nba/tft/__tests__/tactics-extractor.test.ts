import { describe, it, expect } from "vitest";
import { inferScheme, buildFormation } from "src/lib/nba/tft/tactics-extractor";
import { generateSpatialPrior } from "src/lib/nba/tft/spatial-priors";

describe("tactics-extractor", () => {
  it("detects blitz when opponent turnover% > 15", () => {
    expect(inferScheme({ opponentToPct: 0.17, opponentMidRate: 0.30,
                         opponent3paRate: 0.35, opponentCorner3Rate: 0.08 })).toBe("blitz");
  });

  it("detects drop when opponent mid-range rate > 40%", () => {
    expect(inferScheme({ opponentToPct: 0.10, opponentMidRate: 0.42,
                         opponent3paRate: 0.28, opponentCorner3Rate: 0.06 })).toBe("drop");
  });

  it("falls back to switch when nothing matches", () => {
    expect(inferScheme({ opponentToPct: 0.11, opponentMidRate: 0.30,
                         opponent3paRate: 0.35, opponentCorner3Rate: 0.07 })).toBe("switch");
  });

  it("buildFormation places 5 players on the board using their spatial priors", () => {
    const priors = [1,2,3,4,5].map((id) => generateSpatialPrior({
      playerId: id, position: "PG", heightInches: 74,
      avgPoints: 20, threePtRate: 0.4, fgPct: 0.45, threePct: 0.38,
    }));
    const f = buildFormation(priors);
    expect(f).toHaveLength(5);
    for (const spot of f) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.x).toBeLessThan(7);
      expect(spot.y).toBeGreaterThanOrEqual(0);
      expect(spot.y).toBeLessThan(8);
    }
  });
});
