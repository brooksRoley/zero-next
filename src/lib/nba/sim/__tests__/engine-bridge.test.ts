import { describe, it, expect } from "vitest";
import { simulateGameTS } from "src/lib/nba/sim/engine-bridge";
import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";

function make(id: number, team: string): EnginePlayer {
  return { id, name: `P${id}`, team, shooting: 60, defense: 55, speed: 60,
           height_inches: 78, weight_lbs: 200, stamina: 60 };
}

describe("simulateGameTS with per-player events", () => {
  const home = [1, 2, 3, 4, 5].map((i) => make(i, "LAL"));
  const away = [6, 7, 8, 9, 10].map((i) => make(i, "BOS"));

  it("returns playerLines for every player", () => {
    const r = simulateGameTS(home, away, 42, 300);
    expect(r.playerLines).toHaveLength(10);
    expect(r.playerLines.map((p) => p.playerId).sort((a, b) => a - b)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it("sum of home player points equals homeScore", () => {
    const r = simulateGameTS(home, away, 42, 300);
    const homeIds = new Set(home.map((h) => h.id));
    const homePts = r.playerLines.filter((p) => homeIds.has(p.playerId))
      .reduce((s, p) => s + p.pts, 0);
    expect(homePts).toBe(r.homeScore);
  });

  it("shot origins fall inside a valid zone", () => {
    const r = simulateGameTS(home, away, 42, 300);
    for (const line of r.playerLines) {
      for (const s of line.shots) {
        expect(s.zoneId).toBeTruthy();
        expect(Number.isFinite(s.loc_x)).toBe(true);
        expect(Number.isFinite(s.loc_y)).toBe(true);
      }
    }
  });
});
