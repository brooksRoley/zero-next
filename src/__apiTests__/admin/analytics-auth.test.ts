/**
 * Regression coverage for the admin/analytics auth fix: isAuthorized()
 * previously checked only the browser tracker_session cookie, so no
 * non-browser session (this routine's own CFO/CTO/Data-Sci audits included)
 * could read the one dashboard with unit-economics data. It now also
 * accepts the shared x-admin-key header via isValidAdminKey, matching the
 * pattern already used by /api/admin/leads — while leaving the existing
 * cookie path for the browser page untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

vi.mock("src/lib/supabase", () => ({
  supabase: null,
}));

function createMockReq(
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
): any {
  return { method: "GET", cookies, headers };
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

describe("api/admin/analytics auth", () => {
  const ORIGINAL_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN;
  const ORIGINAL_ADMIN_KEY = process.env.ADMIN_KEY;

  beforeEach(() => {
    mockSql.mockReset();
    delete process.env.ADMIN_SESSION_TOKEN;
    delete process.env.ADMIN_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_SESSION_TOKEN === undefined) delete process.env.ADMIN_SESSION_TOKEN;
    else process.env.ADMIN_SESSION_TOKEN = ORIGINAL_SESSION_TOKEN;
    if (ORIGINAL_ADMIN_KEY === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = ORIGINAL_ADMIN_KEY;
  });

  it("returns 503 when neither ADMIN_SESSION_TOKEN nor ADMIN_KEY is configured", async () => {
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({}, { "x-admin-key": "anything" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("still authorizes the browser cookie path when only ADMIN_SESSION_TOKEN is set", async () => {
    process.env.ADMIN_SESSION_TOKEN = "secret-session";
    mockSqlDefaults();
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({ tracker_session: "secret-session" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("rejects a wrong cookie when only ADMIN_SESSION_TOKEN is set and no key header is sent", async () => {
    process.env.ADMIN_SESSION_TOKEN = "secret-session";
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({ tracker_session: "wrong" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("authorizes a valid x-admin-key even with no cookie and ADMIN_SESSION_TOKEN unset", async () => {
    process.env.ADMIN_KEY = "correct-key";
    mockSqlDefaults();
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({}, { "x-admin-key": "correct-key" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it("rejects an invalid x-admin-key", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({}, { "x-admin-key": "nope" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("authorizes via x-admin-key even when ADMIN_SESSION_TOKEN is also set and no cookie is sent", async () => {
    process.env.ADMIN_SESSION_TOKEN = "secret-session";
    process.env.ADMIN_KEY = "correct-key";
    mockSqlDefaults();
    const { default: handler } = await import("../../pages/api/admin/analytics");
    const req = createMockReq({}, { "x-admin-key": "correct-key" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
  });
});
