/**
 * Route contract tests for GET /api/nba/predictions/accuracy.
 * Focus: the handler must degrade gracefully when the nba_prediction_results
 * table is not provisioned (Postgres 42P01) instead of hard-503-ing, while
 * still surfacing genuine DB failures as 503.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));
vi.mock("src/lib/nba/db/readers", () => ({
  getPredictionAccuracyByMonth: vi.fn(async () => []),
}));

function createMockReq(query: Record<string, string> = {}): any {
  return { query, headers: {}, method: "GET" };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  res.setHeader = () => res;
  return res;
}

beforeEach(() => {
  mockSql.mockReset();
});

describe("GET /api/nba/predictions/accuracy", () => {
  it("returns an empty 200 (not 503) when the results table is missing", async () => {
    const err = Object.assign(
      new Error('relation "nba_prediction_results" does not exist'),
      { code: "42P01" }
    );
    mockSql.mockRejectedValue(err);

    const { default: handler } = await import("src/pages/api/nba/predictions/accuracy");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data.totalPredictions).toBe(0);
    expect(res._json._meta.tableProvisioned).toBe(false);
    expect(res._json.rollingCover).toEqual([]);
  });

  it("still returns 503 on a genuine database error", async () => {
    mockSql.mockRejectedValue(new Error("connection terminated unexpectedly"));

    const { default: handler } = await import("src/pages/api/nba/predictions/accuracy");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(503);
    expect(res._json.error).toContain("connection terminated");
  });

  it("computes stats from settled rows when the table has data", async () => {
    mockSql.mockResolvedValue([
      {
        predicted_spread: -5,
        vegas_spread: -3,
        actual_margin: -7,
        settled_at: "2026-03-15T00:00:00.000Z",
      },
    ]);

    const { default: handler } = await import("src/pages/api/nba/predictions/accuracy");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data.totalPredictions).toBe(1);
    // tableProvisioned flag is only emitted on the missing-table path.
    expect(res._json._meta.tableProvisioned).toBeUndefined();
  });
});
