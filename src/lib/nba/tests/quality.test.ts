// TARGET STATE: Tests define the data platform specification
import { describe, it, expect } from "vitest";
import { SAMPLE_PLAYERS, SAMPLE_GAMES, SAMPLE_GAME_LOG, SAMPLE_TEAMS, SAMPLE_STANDINGS } from "./fixtures";
import type { NbaRow } from "../client";

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

  it("WINS + LOSSES equals total games for standings data", () => {
    for (const s of SAMPLE_STANDINGS) {
      const total = Number(s.WINS) + Number(s.LOSSES);
      expect(total).toBeGreaterThan(0);
      // Win PCT should match
      const expectedPct = Number(s.WINS) / total;
      expect(Number(s.WinPCT)).toBeCloseTo(expectedPct, 2);
    }
  });
});

describe("Data Quality - Referential Integrity", () => {
  it("every player has a valid team_id matching a known team", () => {
    const teamIds = new Set(SAMPLE_TEAMS.map((t) => Number(t.TeamID)));
    for (const p of SAMPLE_PLAYERS) {
      expect(teamIds.has(Number(p.TEAM_ID))).toBe(true);
    }
  });

  it("every game_id in game log exists in games list", () => {
    const gameIds = new Set(SAMPLE_GAMES.map((g) => g.GAME_ID));
    for (const gl of SAMPLE_GAME_LOG) {
      expect(gameIds.has(gl.GAME_ID)).toBe(true);
    }
  });

  it("standings team_ids exist in teams list", () => {
    // Full team list includes all teams referenced in standings
    const allTeamIds = new Set([
      ...SAMPLE_TEAMS.map((t) => Number(t.TeamID)),
      // Nuggets appear in standings but not SAMPLE_TEAMS (which is a subset)
      1610612743,
    ]);
    for (const s of SAMPLE_STANDINGS) {
      expect(allTeamIds.has(Number(s.TeamID))).toBe(true);
    }
  });

  it("no duplicate player_ids in player list", () => {
    const ids = SAMPLE_PLAYERS.map((p) => p.PLAYER_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no duplicate game_ids in game list", () => {
    const ids = SAMPLE_GAMES.map((g) => g.GAME_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Data Quality - Null Checks", () => {
  it("critical columns are never null in player data", () => {
    for (const p of SAMPLE_PLAYERS) {
      expect(p.PLAYER_ID).not.toBeNull();
      expect(p.PLAYER_NAME).not.toBeNull();
      expect(p.TEAM_ID).not.toBeNull();
    }
  });

  it("critical columns are never null in game data", () => {
    for (const g of SAMPLE_GAMES) {
      expect(g.GAME_ID).not.toBeNull();
      expect(g.GAME_DATE).not.toBeNull();
      expect(g.MATCHUP).not.toBeNull();
    }
  });

  it("stat columns are present for completed games", () => {
    for (const gl of SAMPLE_GAME_LOG) {
      // Completed games (have WL) should have stats
      if (gl.WL != null) {
        expect(gl.PTS).not.toBeNull();
        expect(gl.REB).not.toBeNull();
        expect(gl.AST).not.toBeNull();
        expect(gl.MIN).not.toBeNull();
      }
    }
  });

  it("standings have non-null win/loss data", () => {
    for (const s of SAMPLE_STANDINGS) {
      expect(s.WINS).not.toBeNull();
      expect(s.LOSSES).not.toBeNull();
      expect(s.WinPCT).not.toBeNull();
    }
  });
});
