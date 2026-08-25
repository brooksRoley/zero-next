/**
 * Auth coverage for /api/bball/setup.
 *
 * This route ran DDL plus a `DELETE ... USING` self-join against production
 * Neon with no auth check and no method guard — its own docstring advertised
 * `GET /api/bball/setup`. Every sibling under bball/admin already used the
 * shared x-admin-key check; this one was simply missed, and nothing tested it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

function createMockReq(
  method = "GET",
  headers: Record<string, string> = {}
): any {
  return { method, headers, body: {} };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null, _headers: {}, _ended: false };
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
  res.end = () => {
    res._ended = true;
    return res;
  };
  return res;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ADMIN_KEY: "test-admin-key" };
  mockSql.mockReset();
  mockSql.mockResolvedValue([]);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

async function loadHandler() {
  const mod = await import("src/pages/api/bball/setup");
  return mod.default;
}

describe("/api/bball/setup auth", () => {
  it("rejects an unauthenticated request with 401 and runs no SQL", async () => {
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("GET"), res);

    expect(res._status).toBe(401);
    // The point of the fix: no DDL, no DELETE, before auth passes.
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("rejects a wrong admin key", async () => {
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("GET", { "x-admin-key": "wrong" }), res);

    expect(res._status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("denies when ADMIN_KEY is unset, rather than comparing undefined to undefined", async () => {
    delete process.env.ADMIN_KEY;
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("GET"), res);

    expect(res._status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("accepts a valid admin key and provisions the tables", async () => {
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("GET", { "x-admin-key": "test-admin-key" }), res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ ok: true, message: "bball tables ready" });
    expect(mockSql).toHaveBeenCalled();
  });

  it("accepts POST as well as the documented GET", async () => {
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("POST", { "x-admin-key": "test-admin-key" }), res);

    expect(res._status).toBe(200);
  });

  it("rejects other methods with 405 before touching the database", async () => {
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("DELETE", { "x-admin-key": "test-admin-key" }), res);

    expect(res._status).toBe(405);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("still answers the CORS preflight without requiring a key", async () => {
    // The Vite/Pages browser client preflights these endpoints; that must keep
    // working, and answering OPTIONS reveals nothing and runs no SQL.
    const handler = await loadHandler();
    const res = createMockRes();
    await handler(createMockReq("OPTIONS"), res);

    expect(res._status).toBe(204);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
