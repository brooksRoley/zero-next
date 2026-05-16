// TARGET STATE: Tests define the data platform specification
import { describe, it, expect } from "vitest";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { toParquetData, estimateSize, PLAYER_SEASON_SCHEMA, TEAM_SEASON_SCHEMA } from "../parquet";
import { getPlayerSeasonStats, getStandings, getPlayerGameLog } from "../db/readers";

function createMockSql(returnRows: any[] = []) {
  const mockSql = (strings: TemplateStringsArray, ...values: any[]) => Promise.resolve(returnRows);
  return mockSql as unknown as NeonQueryFunction<false, false>;
}

describe("Storage - Parquet Export", () => {
  it("gold tables transform to valid Parquet-ready format", () => {
    const rows = [
      { player_id: 2544, season: "2025-26", team_id: 1610612747, games_played: 62, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, spg: 1.2, bpg: 0.6, topg: 3.4, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768, plus_minus_avg: 3.2 },
      { player_id: 203076, season: "2025-26", team_id: 1610612747, games_played: 58, mpg: 34.1, ppg: 26.3, rpg: 11.9, apg: 3.2, spg: 1.3, bpg: 2.1, topg: 2.1, fg_pct: 0.521, fg3_pct: 0.343, ft_pct: 0.778, plus_minus_avg: 5.1 },
    ];
    const data = toParquetData(rows, PLAYER_SEASON_SCHEMA);
    expect(data.rowCount).toBe(2);
    expect(data.schema).toEqual(PLAYER_SEASON_SCHEMA);
    // Each row should only have schema columns
    for (const row of data.rows) {
      for (const col of PLAYER_SEASON_SCHEMA) {
        expect(col.name in row).toBe(true);
      }
    }
  });

  it("exported data contains correct column types", () => {
    const rows = [
      { player_id: 2544, season: "2025-26", team_id: 1610612747, games_played: 62, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, spg: 1.2, bpg: 0.6, topg: 3.4, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768, plus_minus_avg: 3.2 },
    ];
    const data = toParquetData(rows, PLAYER_SEASON_SCHEMA);
    const row = data.rows[0];
    expect(typeof row.player_id).toBe("number");
    expect(typeof row.season).toBe("string");
    expect(typeof row.ppg).toBe("number");
  });

  it("Parquet columnar estimate is smaller than equivalent JSON", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      player_id: 1000 + i,
      season: "2025-26",
      team_id: 1610612747,
      games_played: 60 + (i % 20),
      mpg: 30 + Math.random() * 10,
      ppg: 10 + Math.random() * 20,
      rpg: 3 + Math.random() * 10,
      apg: 1 + Math.random() * 8,
      spg: Math.random() * 3,
      bpg: Math.random() * 3,
      topg: 1 + Math.random() * 3,
      fg_pct: 0.3 + Math.random() * 0.3,
      fg3_pct: 0.2 + Math.random() * 0.3,
      ft_pct: 0.5 + Math.random() * 0.4,
      plus_minus_avg: -5 + Math.random() * 15,
    }));
    const data = toParquetData(rows, PLAYER_SEASON_SCHEMA);
    const sizes = estimateSize(data);
    expect(sizes.ratio).toBeGreaterThan(1); // JSON should be larger
    expect(sizes.columnarBytes).toBeLessThan(sizes.jsonBytes);
  });

  it("team season schema exports correctly", () => {
    const rows = [
      { team_id: 1610612747, season: "2025-26", games_played: 72, ppg: 115.2, opp_ppg: 112.1, rpg: 44.5, apg: 26.3, pace: 99.8, off_rtg: 115.5, def_rtg: 112.3, net_rtg: 3.2 },
    ];
    const data = toParquetData(rows, TEAM_SEASON_SCHEMA);
    expect(data.rowCount).toBe(1);
    expect(data.rows[0].net_rtg).toBe(3.2);
  });
});

describe("Storage - Query Performance", () => {
  it("player season stats query resolves quickly (mocked)", async () => {
    const mockRow = { player_id: 2544, season: "2025-26", ppg: 24.8 };
    const sql = createMockSql([mockRow]);
    const start = performance.now();
    const result = await getPlayerSeasonStats(sql, 2544, "2025-26");
    const elapsed = performance.now() - start;
    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(200);
  });

  it("standings query resolves quickly (mocked)", async () => {
    const mockRows = Array.from({ length: 30 }, (_, i) => ({
      team_id: 1610612737 + i, season: "2025-26", wins: 40, losses: 32,
    }));
    const sql = createMockSql(mockRows);
    const start = performance.now();
    const result = await getStandings(sql, "2025-26");
    const elapsed = performance.now() - start;
    expect(result).toHaveLength(30);
    expect(elapsed).toBeLessThan(100);
  });

  it("player game log query resolves quickly (mocked)", async () => {
    const mockRows = Array.from({ length: 82 }, (_, i) => ({
      game_id: `002250${String(i).padStart(4, "0")}`, player_id: 2544, pts: 25,
    }));
    const sql = createMockSql(mockRows);
    const start = performance.now();
    const result = await getPlayerGameLog(sql, 2544, "2025-26");
    const elapsed = performance.now() - start;
    expect(result).toHaveLength(82);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("Storage - Schema Evolution", () => {
  it("adding a new column preserves existing data in Parquet export", () => {
    const rows = [
      { player_id: 2544, season: "2025-26", team_id: 1610612747, games_played: 62, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, spg: 1.2, bpg: 0.6, topg: 3.4, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768, plus_minus_avg: 3.2, new_metric: 42 },
    ];
    // Original schema doesn't include new_metric — it should be excluded but not error
    const data = toParquetData(rows, PLAYER_SEASON_SCHEMA);
    expect(data.rows[0].ppg).toBe(24.8);
    expect("new_metric" in data.rows[0]).toBe(false);
  });

  it("missing column in data results in null", () => {
    const rows = [
      { player_id: 2544, season: "2025-26", team_id: 1610612747, games_played: 62 },
    ];
    const data = toParquetData(rows, PLAYER_SEASON_SCHEMA);
    expect(data.rows[0].ppg).toBeNull();
    expect(data.rows[0].rpg).toBeNull();
  });

  it("schema with extra columns filters correctly", () => {
    const extendedSchema = [
      ...PLAYER_SEASON_SCHEMA,
      { name: "usage_rate" as const, type: "DOUBLE" as const },
    ];
    const rows = [
      { player_id: 2544, season: "2025-26", team_id: 1610612747, games_played: 62, usage_rate: 28.5, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, spg: 1.2, bpg: 0.6, topg: 3.4, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768, plus_minus_avg: 3.2 },
    ];
    const data = toParquetData(rows, extendedSchema);
    expect(data.rows[0].usage_rate).toBe(28.5);
  });
});
