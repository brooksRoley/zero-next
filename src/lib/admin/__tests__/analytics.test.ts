/**
 * Regression coverage for the Go stats wired into admin/analytics.ts.
 *
 * Go lives in its own Supabase tables (go_players / go_puzzle_attempts),
 * isolated from Pente's players/game_results/puzzle_bank per CLAUDE.md — but
 * that isolation also meant Go engagement had zero visibility on the one
 * dashboard that reads this database. This covers the new `go` stats block
 * and its independent failure-degradation (a broken go_* query must not sink
 * the Pente stats or the request as a whole).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

type CountResult = { count: number; error: unknown };
type AvgResult = { data: unknown[]; error: unknown };
type TableResponses = Record<
  string,
  {
    countAll?: CountResult;
    countEq?: CountResult;
    avgColumn?: AvgResult;
  }
>;

function makeSupabaseMock(responses: TableResponses) {
  return {
    from(table: string) {
      return {
        select(_sel: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.count === "exact" && opts?.head) {
            const promise = Promise.resolve(
              responses[table]?.countAll ?? { count: 0, error: null }
            ) as Promise<CountResult> & { eq?: (col: string, val: unknown) => Promise<CountResult> };
            promise.eq = () =>
              Promise.resolve(responses[table]?.countEq ?? { count: 0, error: null });
            return promise;
          }
          return Promise.resolve(responses[table]?.avgColumn ?? { data: [], error: null });
        },
      };
    },
  };
}

let mockSupabase: ReturnType<typeof makeSupabaseMock> | null = null;
vi.mock("src/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));

function createMockReq(cookies: Record<string, string> = {}): any {
  return { method: "GET", cookies, headers: {} };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null, _headers: {} as Record<string, string> };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (data: unknown) => {
    res._json = data;
    return res;
  };
  res.setHeader = (key: string, value: string) => {
    res._headers[key] = value;
    return res;
  };
  return res;
}

// Five queries fire in a fixed order: pageViews, leadCounts, eventTotalsRaw,
// eventsByPage, funnelRows.
function mockSqlDefaults() {
  mockSql
    .mockResolvedValueOnce([]) // pageViews
    .mockResolvedValueOnce([{ total: 0, last_30_days: 0 }]) // leadCounts
    .mockResolvedValueOnce([]) // eventTotalsRaw
    .mockResolvedValueOnce([]) // eventsByPage
    .mockResolvedValueOnce([{}]); // funnelRows
}

describe("api/admin/analytics — Go stats", () => {
  const ORIGINAL_TOKEN = process.env.ADMIN_SESSION_TOKEN;

  beforeEach(() => {
    mockSql.mockReset();
    mockSupabase = null;
    process.env.ADMIN_SESSION_TOKEN = "secret-session";
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.ADMIN_SESSION_TOKEN;
    else process.env.ADMIN_SESSION_TOKEN = ORIGINAL_TOKEN;
  });

  it("returns Go player count/avg ELO and puzzle attempt totals, independent of Pente", async () => {
    mockSqlDefaults();
    mockSupabase = makeSupabaseMock({
      puzzle_bank: { countAll: { count: 40, error: null }, avgColumn: { data: [{ rating: 1200 }], error: null } },
      game_results: {
        countAll: { count: 12, error: null },
        countEq: { count: 5, error: null },
      },
      players: { countAll: { count: 8, error: null }, avgColumn: { data: [{ game_elo: 1300 }], error: null } },
      go_players: {
        countAll: { count: 3, error: null },
        avgColumn: {
          data: [{ go_elo: 1000 }, { go_elo: 1200 }, { go_elo: 1400 }],
          error: null,
        },
      },
      go_puzzle_attempts: {
        countAll: { count: 10, error: null },
        countEq: { count: 7, error: null },
      },
    });

    const { default: handler } = await import("src/pages/api/admin/analytics");
    const req = createMockReq({ tracker_session: "secret-session" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.supabaseStats.go).toEqual({
      players: { count: 3, avgElo: 1200 },
      puzzleAttempts: { total: 10, solved: 7 },
    });
    // Pente-side stats are untouched by the Go wiring.
    expect(res._json.supabaseStats.players).toEqual({ count: 8, avgGameElo: 1300 });
  });

  it("degrades Go stats to zero/null when the go_ tables error, without failing the request", async () => {
    mockSqlDefaults();
    mockSupabase = {
      from(table: string) {
        return {
          select(_sel: string, opts?: { count?: string; head?: boolean }) {
            if (table === "go_players" || table === "go_puzzle_attempts") {
              // countAll awaits this promise directly; countEq only awaits the
              // chained .eq() promise, so the base rejection must be marked
              // handled here or it surfaces as an unhandled rejection.
              const rejected = Promise.reject(
                new Error(`relation "${table}" does not exist`)
              ) as Promise<CountResult> & { eq?: () => Promise<CountResult> };
              rejected.catch(() => {});
              rejected.eq = () => Promise.reject(new Error(`relation "${table}" does not exist`));
              return rejected;
            }
            if (opts?.count === "exact" && opts?.head) {
              const p = Promise.resolve({ count: 0, error: null }) as Promise<CountResult> & {
                eq?: () => Promise<CountResult>;
              };
              p.eq = () => Promise.resolve({ count: 0, error: null });
              return p;
            }
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    };

    const { default: handler } = await import("src/pages/api/admin/analytics");
    const req = createMockReq({ tracker_session: "secret-session" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.supabaseStats.go).toEqual({
      players: { count: 0, avgElo: null },
      puzzleAttempts: { total: 0, solved: 0 },
    });
  });

  it("returns 401 when the tracker_session cookie is missing or wrong", async () => {
    mockSql.mockReset();
    const { default: handler } = await import("src/pages/api/admin/analytics");
    const req = createMockReq({ tracker_session: "wrong" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
