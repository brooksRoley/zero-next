/**
 * Regression coverage for the admin/leads auth fix: the route previously
 * checked a bespoke ADMIN_TOKEN/x-admin-token pair that was never set in
 * Vercel, causing a permanent live 503. It now reuses the shared
 * isValidAdminKey helper (ADMIN_KEY/x-admin-key) like every other admin
 * route in the codebase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

function createMockReq(
  method: string,
  headers: Record<string, string> = {},
  body: unknown = undefined
): any {
  return { method, headers, body };
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

describe("api/admin/leads auth", () => {
  const ORIGINAL_ADMIN_KEY = process.env.ADMIN_KEY;

  beforeEach(() => {
    mockSql.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_ADMIN_KEY === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = ORIGINAL_ADMIN_KEY;
  });

  it("returns 503 when ADMIN_KEY is not configured", async () => {
    delete process.env.ADMIN_KEY;
    const { default: handler } = await import("../../pages/api/admin/leads");
    const req = createMockReq("GET", { "x-admin-key": "anything" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._json.error).toMatch(/ADMIN_KEY/);
  });

  it("returns 401 when x-admin-key is missing or wrong", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import("../../pages/api/admin/leads");

    const noHeader = createMockRes();
    await handler(createMockReq("GET"), noHeader);
    expect(noHeader._status).toBe(401);

    const wrongKey = createMockRes();
    await handler(createMockReq("GET", { "x-admin-key": "nope" }), wrongKey);
    expect(wrongKey._status).toBe(401);

    expect(mockSql).not.toHaveBeenCalled();
  });

  it("accepts x-admin-key and returns leads + summary on GET", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import("../../pages/api/admin/leads");

    mockSql
      .mockResolvedValueOnce([{ id: 1, name: "Brooks", status: "new" }])
      .mockResolvedValueOnce([
        { total: 10, with_budget: 4, last_7: 2, prior_7: 1 },
      ])
      .mockResolvedValueOnce([{ source: "direct", count: 6 }]);

    const req = createMockReq("GET", { "x-admin-key": "correct-key" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.leads).toHaveLength(1);
    expect(res._json.summary.total).toBe(10);
    expect(res._json.summary.topSources[0]).toMatchObject({
      source: "direct",
      count: 6,
      percent: 60,
    });
  });

  it("rejects an invalid status on PATCH with 400", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import("../../pages/api/admin/leads");

    const req = createMockReq(
      "PATCH",
      { "x-admin-key": "correct-key" },
      { id: 1, status: "bogus" }
    );
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("updates status on PATCH with a valid status", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import("../../pages/api/admin/leads");

    mockSql.mockResolvedValueOnce([{ id: 1, status: "contacted" }]);

    const req = createMockReq(
      "PATCH",
      { "x-admin-key": "correct-key" },
      { id: 1, status: "contacted" }
    );
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.lead.status).toBe("contacted");
  });
});
