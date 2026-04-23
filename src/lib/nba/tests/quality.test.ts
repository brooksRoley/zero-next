// TARGET STATE: Tests define the data platform specification
import { describe, it, expect } from "vitest";
import { SAMPLE_PLAYERS, SAMPLE_GAMES, SAMPLE_GAME_LOG } from "./fixtures";

describe("Data Quality - Range Validation", () => {
  it("PTS, REB, AST are non-negative", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(Number(p.PTS)).toBeGreaterThanOrEqual(0);
      expect(Number(p.REB)).toBeGreaterThanOrEqual(0);
      expect(Number(p.AST)).toBeGreaterThanOrEqual(0);
    }
  });

  it("FG_PCT, FG3_PCT, FT_PCT are between 0 and 1", () => {
    for (const p of SAMPLE_PLAYERS) {
      if (p.FG_PCT != null) {
        expect(Number(p.FG_PCT)).toBeGreaterThanOrEqual(0);
        expect(Number(p.FG_PCT)).toBeLessThanOrEqual(1);
      }
      if (p.FG3_PCT != null) {
        expect(Number(p.FG3_PCT)).toBeGreaterThanOrEqual(0);
        expect(Number(p.FG3_PCT)).toBeLessThanOrEqual(1);
      }
      if (p.FT_PCT != null) {
        expect(Number(p.FT_PCT)).toBeGreaterThanOrEqual(0);
        expect(Number(p.FT_PCT)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("MIN (minutes) between 0 and 53 (OT max)", () => {
    for (const gl of SAMPLE_GAME_LOG) {
      if (gl.MIN != null) {
        expect(Number(gl.MIN)).toBeGreaterThanOrEqual(0);
        expect(Number(gl.MIN)).toBeLessThanOrEqual(53);
      }
    }
  });

  it("TEAM_ABBREVIATION is exactly 3 uppercase letters", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(p.TEAM_ABBREVIATION).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("PLAYER_ID is a positive integer", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(Number(p.PLAYER_ID)).toBeGreaterThan(0);
      expect(Number.isInteger(Number(p.PLAYER_ID))).toBe(true);
    }
  });
});

describe("Data Quality - Referential Integrity", () => {
  it.todo("every player_id in game stats exists in players table");
  it.todo("every team_id in standings exists in teams table");
  it.todo("every game_id in player stats exists in games table");
  it.todo("no orphaned records in child tables");
});

describe("Data Quality - Null Checks", () => {
  it("critical columns are never null in fixture data", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(p.PLAYER_ID).not.toBeNull();
      expect(p.TEAM_ID).not.toBeNull();
    }
    for (const g of SAMPLE_GAMES) {
      expect(g.GAME_ID).not.toBeNull();
      expect(g.GAME_DATE).not.toBeNull();
    }
  });

  it.todo("stat columns are not null for completed games in gold tables");
});
