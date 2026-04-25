import { describe, it, expect } from "vitest";
import { mapPlayerToEngine, mapRosterToEngine, type EnginePlayer } from "../sim/stat-mapper";

describe("mapPlayerToEngine", () => {
  it("maps LeBron's real stats to engine 0-100 scale", () => {
    const result = mapPlayerToEngine({
      player_id: 2544,
      player_name: "LeBron James",
      team_id: 1610612747,
      fg_pct: 0.495,
      ts_pct: 0.58,
      fg3_pct: 0.362,
      def_rtg: 110,
      stl_pct: 1.8,
      blk_pct: 1.2,
      pace: 100,
      mpg: 35.2,
      age: 41,
      height_inches: 81,
      weight_lbs: 250,
    });

    expect(result.shooting).toBeGreaterThanOrEqual(0);
    expect(result.shooting).toBeLessThanOrEqual(100);
    expect(result.defense).toBeGreaterThanOrEqual(0);
    expect(result.defense).toBeLessThanOrEqual(100);
    expect(result.speed).toBeGreaterThanOrEqual(0);
    expect(result.speed).toBeLessThanOrEqual(100);
    expect(result.height_inches).toBe(81);
    expect(result.weight_lbs).toBe(250);
    expect(result.name).toBe("LeBron James");
    // LeBron should have above-average shooting
    expect(result.shooting).toBeGreaterThan(60);
  });

  it("maps a poor shooter to low shooting stat", () => {
    const result = mapPlayerToEngine({
      player_id: 9999,
      player_name: "Bad Shooter",
      team_id: 1,
      fg_pct: 0.35,
      ts_pct: 0.42,
      fg3_pct: 0.22,
      def_rtg: 118,
      stl_pct: 0.5,
      blk_pct: 0.3,
      pace: 98,
      mpg: 20,
      age: 22,
      height_inches: 76,
      weight_lbs: 210,
    });
    expect(result.shooting).toBeLessThan(55);
  });

  it("maps a defensive specialist to high defense", () => {
    const result = mapPlayerToEngine({
      player_id: 8888,
      player_name: "Lockdown",
      team_id: 1,
      fg_pct: 0.40,
      ts_pct: 0.50,
      fg3_pct: 0.30,
      def_rtg: 100, // elite
      stl_pct: 3.0,
      blk_pct: 2.5,
      pace: 100,
      mpg: 32,
      age: 27,
      height_inches: 79,
      weight_lbs: 220,
    });
    expect(result.defense).toBeGreaterThan(70);
  });

  it("clamps all stats to 0-100", () => {
    const result = mapPlayerToEngine({
      player_id: 1,
      player_name: "Edge Case",
      team_id: 1,
      fg_pct: 0.99,
      ts_pct: 0.99,
      fg3_pct: 0.99,
      def_rtg: 80,
      stl_pct: 10,
      blk_pct: 10,
      pace: 120,
      mpg: 48,
      age: 20,
      height_inches: 88,
      weight_lbs: 300,
    });
    expect(result.shooting).toBeLessThanOrEqual(100);
    expect(result.defense).toBeLessThanOrEqual(100);
    expect(result.speed).toBeLessThanOrEqual(100);
  });
});

describe("mapRosterToEngine", () => {
  it("maps array of players and assigns team", () => {
    const players = [
      { player_id: 1, player_name: "P1", team_id: 100, fg_pct: 0.45, ts_pct: 0.55, fg3_pct: 0.35, def_rtg: 108, stl_pct: 1.5, blk_pct: 1.0, pace: 100, mpg: 30, age: 25, height_inches: 78, weight_lbs: 215 },
      { player_id: 2, player_name: "P2", team_id: 100, fg_pct: 0.48, ts_pct: 0.58, fg3_pct: 0.38, def_rtg: 106, stl_pct: 2.0, blk_pct: 0.5, pace: 102, mpg: 33, age: 28, height_inches: 75, weight_lbs: 195 },
    ];
    const roster = mapRosterToEngine(players, "LAL");
    expect(roster).toHaveLength(2);
    expect(roster[0].team).toBe("LAL");
    expect(roster[1].team).toBe("LAL");
  });
});
