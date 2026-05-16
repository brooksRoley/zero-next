// TARGET STATE: Tests define the data platform specification
import { describe, it, expect, vi } from "vitest";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { cleanForSilver, aggregateSeasonStats } from "../pipeline";
import { upsertPlayers, upsertTeams, logBronzeIngestion } from "../db/writers";
import {
  SAMPLE_PLAYERS, SAMPLE_TEAMS, SAMPLE_GAME_LOG,
  PLAYER_LEBRON, PLAYER_AD,
} from "./fixtures";
import type { NbaRow } from "../client";

// Mock sql
function createMockSql() {
  const calls: any[] = [];
  const mockSql = (strings: TemplateStringsArray, ...values: any[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve([]);
  };
  return { sql: mockSql as unknown as NeonQueryFunction<false, false>, calls };
}

describe("Pipeline - Idempotency", () => {
  it("running upsert twice produces same row count", async () => {
    const { sql: sql1 } = createMockSql();
    const { sql: sql2 } = createMockSql();
    const count1 = await upsertPlayers(sql1, SAMPLE_PLAYERS);
    const count2 = await upsertPlayers(sql2, SAMPLE_PLAYERS);
    expect(count1).toBe(count2);
  });

  it("upsert doesn't create duplicates (ON CONFLICT)", async () => {
    const { sql, calls } = createMockSql();
    await upsertPlayers(sql, [PLAYER_LEBRON, PLAYER_LEBRON]);
    // Both rows are sent — dedup is DB-side via ON CONFLICT
    expect(calls).toHaveLength(2);
    // Verify both target same player_id
    expect(calls[0].values[0]).toBe(calls[1].values[0]);
  });

  it("re-processing doesn't change gold table values", () => {
    const gameStats = SAMPLE_GAME_LOG.map((g) => ({
      pts: Number(g.PTS), reb: Number(g.REB), ast: Number(g.AST),
      stl: Number(g.STL), blk: Number(g.BLK), tov: Number(g.TOV),
      minutes: Number(g.MIN), fg_pct: Number(g.FG_PCT), fg3_pct: Number(g.FG3_PCT),
      ft_pct: Number(g.FT_PCT), plus_minus: Number(g.PLUS_MINUS),
    }));
    const result1 = aggregateSeasonStats(gameStats);
    const result2 = aggregateSeasonStats(gameStats);
    expect(result1).toEqual(result2);
  });
});

describe("Pipeline - Incremental Ingestion", () => {
  it("checkpoint tracks last ingestion metadata", async () => {
    const { sql, calls } = createMockSql();
    await logBronzeIngestion(sql, "stats.nba.com", "leaguedashplayerstats", { Season: "2025-26" }, {}, 500);
    expect(calls).toHaveLength(1);
    expect(calls[0].values).toContain("leaguedashplayerstats");
    expect(calls[0].values).toContain(500);
  });

  it("bronze log preserves source and row count", async () => {
    const { sql, calls } = createMockSql();
    await logBronzeIngestion(sql, "stats.nba.com", "leaguestandingsv3", { Season: "2025-26" }, { sample: true }, 30);
    expect(calls[0].values).toContain("stats.nba.com");
    expect(calls[0].values).toContain("leaguestandingsv3");
    expect(calls[0].values).toContain(30);
  });

  it("different endpoints create separate checkpoints", async () => {
    const { sql, calls } = createMockSql();
    await logBronzeIngestion(sql, "stats.nba.com", "endpoint_a", {}, {}, 10);
    await logBronzeIngestion(sql, "stats.nba.com", "endpoint_b", {}, {}, 20);
    expect(calls).toHaveLength(2);
    expect(calls[0].values).toContain("endpoint_a");
    expect(calls[1].values).toContain("endpoint_b");
  });
});

describe("Pipeline - Bronze to Silver", () => {
  it("raw JSON is preserved in bronze via logBronzeIngestion", async () => {
    const { sql, calls } = createMockSql();
    const rawData = [{ PLAYER_ID: 2544, PLAYER_NAME: "LeBron James" }];
    await logBronzeIngestion(sql, "stats.nba.com", "test", {}, rawData, 1);
    // raw_response is JSON stringified
    const rawParam = calls[0].values.find((v: any) => typeof v === "string" && v.includes("LeBron"));
    expect(rawParam).toBeDefined();
  });

  it("silver tables have correct types (not all strings)", () => {
    const rows: NbaRow[] = [
      { PLAYER_ID: "2544", PLAYER_NAME: "LeBron James", TEAM_ID: "1610612747", PTS: "24.8", REB: "7.1" },
    ];
    const cleaned = cleanForSilver(rows);
    expect(typeof cleaned[0].PLAYER_ID).toBe("number");
    expect(typeof cleaned[0].PTS).toBe("number");
    expect(typeof cleaned[0].REB).toBe("number");
    // Name stays string
    expect(typeof cleaned[0].PLAYER_NAME).toBe("string");
  });

  it("cleaning removes duplicate rows", () => {
    const rows = [PLAYER_LEBRON, { ...PLAYER_LEBRON }, PLAYER_AD];
    const cleaned = cleanForSilver(rows);
    expect(cleaned).toHaveLength(2);
  });

  it("null handling: missing stats → NULL not 0", () => {
    const rows: NbaRow[] = [
      { PLAYER_ID: 9999, PLAYER_NAME: "Test", TEAM_ID: 1, PTS: null, REB: null },
    ];
    const cleaned = cleanForSilver(rows);
    expect(cleaned[0].PTS).toBeNull();
    expect(cleaned[0].REB).toBeNull();
  });
});

describe("Pipeline - Silver to Gold", () => {
  it("per-game stats aggregate correctly to season averages", () => {
    const gameStats = [
      { pts: 32, reb: 8, ast: 10, stl: 2, blk: 1, tov: 3, minutes: 36, fg_pct: 0.545, fg3_pct: 0.375, ft_pct: 0.833, plus_minus: 12 },
      { pts: 22, reb: 6, ast: 7, stl: 0, blk: 0, tov: 5, minutes: 38, fg_pct: 0.4, fg3_pct: 0.286, ft_pct: 0.8, plus_minus: -8 },
    ];
    const result = aggregateSeasonStats(gameStats);
    expect(result.gamesPlayed).toBe(2);
    expect(result.ppg).toBe(27.0);
    expect(result.rpg).toBe(7.0);
    expect(result.apg).toBe(8.5);
  });

  it("PPG = total points / games played", () => {
    const gameStats = [
      { pts: 30, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2, minutes: 35, fg_pct: 0.5, fg3_pct: 0.4, ft_pct: 0.8, plus_minus: 5 },
      { pts: 20, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2, minutes: 35, fg_pct: 0.5, fg3_pct: 0.4, ft_pct: 0.8, plus_minus: 5 },
      { pts: 40, reb: 5, ast: 5, stl: 1, blk: 1, tov: 2, minutes: 35, fg_pct: 0.5, fg3_pct: 0.4, ft_pct: 0.8, plus_minus: 5 },
    ];
    const result = aggregateSeasonStats(gameStats);
    expect(result.ppg).toBe(30.0);
  });

  it("season stats update when new game added", () => {
    const twoGames = [
      { pts: 30, reb: 10, ast: 8, stl: 1, blk: 1, tov: 2, minutes: 36, fg_pct: 0.5, fg3_pct: 0.4, ft_pct: 0.8, plus_minus: 5 },
      { pts: 20, reb: 6, ast: 4, stl: 1, blk: 0, tov: 3, minutes: 34, fg_pct: 0.45, fg3_pct: 0.35, ft_pct: 0.75, plus_minus: -2 },
    ];
    const before = aggregateSeasonStats(twoGames);
    expect(before.gamesPlayed).toBe(2);
    expect(before.ppg).toBe(25.0);

    const threeGames = [...twoGames, { pts: 40, reb: 12, ast: 10, stl: 3, blk: 2, tov: 1, minutes: 38, fg_pct: 0.6, fg3_pct: 0.5, ft_pct: 0.9, plus_minus: 15 }];
    const after = aggregateSeasonStats(threeGames);
    expect(after.gamesPlayed).toBe(3);
    expect(after.ppg).toBe(30.0);
  });

  it("gold refresh is idempotent", () => {
    const gameStats = [
      { pts: 25, reb: 7, ast: 6, stl: 1, blk: 1, tov: 2, minutes: 35, fg_pct: 0.48, fg3_pct: 0.36, ft_pct: 0.82, plus_minus: 3 },
    ];
    const r1 = aggregateSeasonStats(gameStats);
    const r2 = aggregateSeasonStats(gameStats);
    const r3 = aggregateSeasonStats(gameStats);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it("empty game stats returns zeroes", () => {
    const result = aggregateSeasonStats([]);
    expect(result.gamesPlayed).toBe(0);
    expect(result.ppg).toBe(0);
  });
});
