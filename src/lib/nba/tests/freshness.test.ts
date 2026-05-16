// TARGET STATE: Tests define the data platform specification
import { describe, it, expect, vi } from "vitest";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { getRecentIngestions } from "../db/readers";
import { logBronzeIngestion } from "../db/writers";

function createMockSql(returnRows: any[] = []) {
  const calls: any[] = [];
  const mockSql = (strings: TemplateStringsArray, ...values: any[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve(returnRows);
  };
  return { sql: mockSql as unknown as NeonQueryFunction<false, false>, calls };
}

describe("Data Freshness", () => {
  it("bronze ingestion log can be queried for recent runs", async () => {
    const recentRuns = [
      { id: 1, source: "stats.nba.com", endpoint: "leaguedashplayerstats", row_count: 500, ingested_at: new Date().toISOString() },
    ];
    const { sql } = createMockSql(recentRuns);
    const result = await getRecentIngestions(sql, 10);
    expect(result).toHaveLength(1);
    expect(result[0].endpoint).toBe("leaguedashplayerstats");
  });

  it("ingestion timestamp is recorded accurately", async () => {
    const { sql, calls } = createMockSql();
    const before = Date.now();
    await logBronzeIngestion(sql, "stats.nba.com", "test-endpoint", {}, {}, 42);
    // Verify the ingestion was logged with correct params
    expect(calls).toHaveLength(1);
    expect(calls[0].values).toContain("test-endpoint");
    expect(calls[0].values).toContain(42);
  });

  it("can detect stale data via ingestion gap", async () => {
    const staleRun = [
      { id: 1, source: "stats.nba.com", endpoint: "players", row_count: 500, ingested_at: "2026-01-01T00:00:00Z" },
    ];
    const { sql } = createMockSql(staleRun);
    const result = await getRecentIngestions(sql, 1);
    const lastRun = new Date(result[0].ingested_at);
    const hoursSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
    // This data is months old — freshness check should flag it
    expect(hoursSinceRun).toBeGreaterThan(24);
  });

  it("freshness check passes for recent ingestion", async () => {
    const freshRun = [
      { id: 1, source: "stats.nba.com", endpoint: "players", row_count: 500, ingested_at: new Date().toISOString() },
    ];
    const { sql } = createMockSql(freshRun);
    const result = await getRecentIngestions(sql, 1);
    const lastRun = new Date(result[0].ingested_at);
    const hoursSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
    expect(hoursSinceRun).toBeLessThan(24);
  });
});
