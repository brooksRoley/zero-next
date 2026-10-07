/**
 * Coverage for the /api/admin/email-signups route: mirrors the
 * admin/leads auth pattern (ADMIN_KEY / x-admin-key) so first-party
 * mailing-list captures (Model Arena gate, digital-product notify,
 * funding tip jar) have the same admin visibility as consulting leads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

function createMockReq(
  method: string,
  headers: Record<string, string> = {}
): any {
  return { method, headers };
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

describe("api/admin/email-signups auth", () => {
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
    const { default: handler } = await import(
      "../../pages/api/admin/email-signups"
    );
    const req = createMockReq("GET", { "x-admin-key": "anything" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._json.error).toMatch(/ADMIN_KEY/);
  });

  it("returns 401 when x-admin-key is missing or wrong", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import(
      "../../pages/api/admin/email-signups"
    );

    const noHeader = createMockRes();
    await handler(createMockReq("GET"), noHeader);
    expect(noHeader._status).toBe(401);

    const wrongKey = createMockRes();
    await handler(createMockReq("GET", { "x-admin-key": "nope" }), wrongKey);
    expect(wrongKey._status).toBe(401);

    expect(mockSql).not.toHaveBeenCalled();
  });

  it("rejects non-GET methods with 405", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import(
      "../../pages/api/admin/email-signups"
    );

    const req = createMockReq("POST", { "x-admin-key": "correct-key" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("accepts x-admin-key and returns signups + summary on GET", async () => {
    process.env.ADMIN_KEY = "correct-key";
    const { default: handler } = await import(
      "../../pages/api/admin/email-signups"
    );

    mockSql
      .mockResolvedValueOnce([
        { id: 1, email: "a@example.com", source: "funding_tip_jar", created_at: "2026-08-01T00:00:00Z" },
      ])
      .mockResolvedValueOnce([
        { source: "funding_tip_jar", count: 3 },
        { source: "model_arena", count: 2 },
      ])
      .mockResolvedValueOnce([{ total: 5, last_7: 2, prior_7: 1 }]);

    const req = createMockReq("GET", { "x-admin-key": "correct-key" });
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.signups).toHaveLength(1);
    expect(res._json.summary).toMatchObject({
      total: 5,
      last7: 2,
      prior7: 1,
      bySource: [
        { source: "funding_tip_jar", count: 3 },
        { source: "model_arena", count: 2 },
      ],
    });
  });
});
