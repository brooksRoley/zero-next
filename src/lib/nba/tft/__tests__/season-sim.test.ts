import { describe, it, expect } from "vitest";
import { simulateSeason, type SeasonInput } from "src/lib/nba/tft/season-sim";
import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";

function make(id: number, team: string): EnginePlayer {
  return { id, name: `P${id}`, team, shooting: 60, defense: 55, speed: 60,
           height_inches: 78, weight_lbs: 200, stamina: 60 };
}

describe("simulateSeason", () => {
  const input: SeasonInput = {
    rosters: {
      1: [1,2,3,4,5].map((i) => make(i, "LAL")),
      2: [6,7,8,9,10].map((i) => make(i, "BOS")),
    },
    schedule: [
      { home_team_id: 1, away_team_id: 2 },
      { home_team_id: 2, away_team_id: 1 },
    ],
    replicates: 3,
    ticksPerGame: 100,
    baseSeed: 42,
  };

  it("returns wins for every team", () => {
    const r = simulateSeason(input);
    expect(r.teamWins[1] + r.teamWins[2]).toBeCloseTo(input.schedule.length, 5);
  });

  it("returns box lines for every player who appeared", () => {
    const r = simulateSeason(input);
    for (const id of [1,2,3,4,5,6,7,8,9,10]) {
      expect(r.playerBoxes[id]).toBeDefined();
    }
  });

  it("returns shot bins normalized to 1 per player who took shots", () => {
    const r = simulateSeason(input);
    for (const [_, bins] of Object.entries(r.playerShotBins)) {
      const total = Object.values(bins).reduce((s, v) => s + v, 0);
      if (total > 0) expect(total).toBeCloseTo(1, 5);
    }
  });
});
