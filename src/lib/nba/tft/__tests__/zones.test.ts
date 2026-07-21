import { describe, it, expect } from "vitest";
import { ZONES, ZONE_IDS, findZoneAt } from "src/lib/nba/tft/zones";

describe("zones", () => {
  it("exports 8 zones matching basketball-platform taxonomy", () => {
    expect(ZONE_IDS).toEqual([
      "paint", "left-mid", "right-mid",
      "left-corner-3", "right-corner-3",
      "left-wing-3", "right-wing-3", "top-of-key",
    ]);
    expect(ZONES).toHaveLength(8);
  });

  it("every zone declares makePct, pts, polygon points", () => {
    for (const z of ZONES) {
      expect(z.makePct).toBeGreaterThan(0);
      expect([2, 3]).toContain(z.pts);
      expect(z.poly.split(" ").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("findZoneAt returns paint for center-of-key point (230, 180)", () => {
    expect(findZoneAt(230, 180)?.id).toBe("paint");
  });

  it("findZoneAt returns null outside the half-court", () => {
    expect(findZoneAt(-50, -50)).toBeNull();
  });
});
