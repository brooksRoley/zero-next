import { describe, it, expect } from "vitest";
import { boardToZone, BOARD_W, BOARD_H } from "src/lib/nba/tft/court-mapping";
import { ZONE_IDS } from "src/lib/nba/tft/zones";

describe("court-mapping", () => {
  it("center row of offensive half is top-of-key", () => {
    expect(boardToZone(3, 0)).toBe("top-of-key");
  });

  it("corner offensive cells map to corner 3s", () => {
    expect(boardToZone(0, 3)).toBe("left-corner-3");
    expect(boardToZone(6, 3)).toBe("right-corner-3");
  });

  it("center paint cells map to paint", () => {
    expect(boardToZone(3, 2)).toBe("paint");
  });

  it("every (x, y) in board maps to a valid zone id", () => {
    for (let x = 0; x < BOARD_W; x++) {
      for (let y = 0; y < BOARD_H; y++) {
        const zone = boardToZone(x, y);
        expect(ZONE_IDS).toContain(zone);
      }
    }
  });

  it("every zone is reachable from some (x, y)", () => {
    const seen = new Set<string>();
    for (let x = 0; x < BOARD_W; x++) {
      for (let y = 0; y < BOARD_H; y++) {
        seen.add(boardToZone(x, y));
      }
    }
    for (const id of ZONE_IDS) expect(seen).toContain(id);
  });
});
