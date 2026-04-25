import { describe, it, expect, vi } from "vitest";
import { upsertPlayers, upsertTeams, upsertGames, upsertPlayerGameStats } from "./writers";
import { SAMPLE_PLAYERS, SAMPLE_TEAMS, SAMPLE_GAMES, SAMPLE_GAME_LOG } from "../tests/fixtures";

// Mock sql tagged template — captures calls and returns empty arrays
function createMockSql() {
  const calls: { strings: string[]; values: any[] }[] = [];
  const mockSql = (strings: TemplateStringsArray, ...values: any[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve([]);
  };
  return { sql: mockSql, calls };
}

describe("upsertPlayers", () => {
  it("processes all player rows", async () => {
    const { sql } = createMockSql();
    const count = await upsertPlayers(sql, SAMPLE_PLAYERS);
    expect(count).toBe(3);
  });

  it("handles empty array", async () => {
    const { sql } = createMockSql();
    const count = await upsertPlayers(sql, []);
    expect(count).toBe(0);
  });

  it("maps PLAYER_ID to player_id column", async () => {
    const { sql, calls } = createMockSql();
    await upsertPlayers(sql, [SAMPLE_PLAYERS[0]]);
    expect(calls).toHaveLength(1);
    expect(calls[0].values[0]).toBe(2544); // LeBron's PLAYER_ID
  });
});

describe("upsertTeams", () => {
  it("processes all team rows", async () => {
    const { sql } = createMockSql();
    const count = await upsertTeams(sql, SAMPLE_TEAMS);
    expect(count).toBe(3);
  });

  it("handles TeamID casing from standings endpoint", async () => {
    const { sql, calls } = createMockSql();
    await upsertTeams(sql, [SAMPLE_TEAMS[0]]);
    expect(calls[0].values[0]).toBe(1610612747); // Lakers TeamID
  });
});

describe("upsertGames", () => {
  it("processes all game rows", async () => {
    const { sql } = createMockSql();
    const count = await upsertGames(sql, SAMPLE_GAMES);
    expect(count).toBe(3);
  });

  it("maps GAME_ID correctly", async () => {
    const { sql, calls } = createMockSql();
    await upsertGames(sql, [SAMPLE_GAMES[0]]);
    expect(calls[0].values[0]).toBe("0022500850");
  });
});

describe("upsertPlayerGameStats", () => {
  it("processes game log rows", async () => {
    const { sql } = createMockSql();
    const count = await upsertPlayerGameStats(sql, SAMPLE_GAME_LOG);
    expect(count).toBe(2);
  });

  it("maps stat fields to correct numeric values", async () => {
    const { sql, calls } = createMockSql();
    await upsertPlayerGameStats(sql, [SAMPLE_GAME_LOG[0]]);
    // Values should include PTS=32, REB=8, AST=10 from fixture
    const values = calls[0].values;
    expect(values).toContain(32);  // PTS
    expect(values).toContain(8);   // REB
    expect(values).toContain(10);  // AST
  });

  it("handles null stat fields", async () => {
    const { sql } = createMockSql();
    const row = { GAME_ID: "0022500999", PLAYER_ID: 2544, TEAM_ID: null, MIN: null, PTS: null, REB: null, AST: null, STL: null, BLK: null, TOV: null, FGM: null, FGA: null, FG_PCT: null, FG3M: null, FG3A: null, FG3_PCT: null, FTM: null, FTA: null, FT_PCT: null, PLUS_MINUS: null };
    const count = await upsertPlayerGameStats(sql, [row]);
    expect(count).toBe(1);
  });
});
