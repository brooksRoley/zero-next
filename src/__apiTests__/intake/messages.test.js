/**
 * Coverage for GET /api/intake/messages — the read side of the intake thread.
 *
 * Pins the rate limiter (checked before input validation), the UUID guard,
 * that visitorId reaches Neon only as a bound parameter, and that database
 * errors never reach the client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({ sql: (...args) => mockSql(...args) }));
vi.mock("src/lib/intakeSchema", () => ({ ensureIntakeSchema: () => Promise.resolve() }));

function createMockReq(visitorId, ip = "203.0.113.1") {
  return {
    method: "GET",
    headers: { "x-forwarded-for": ip },
    query: visitorId === undefined ? {} : { visitorId },
    socket: {},
  };
}

function createMockRes() {
  const res = { _status: 200, _json: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (data) => {
    res._json = data;
    return res;
  };
  return res;
}

const VISITOR_ID = "11111111-2222-3333-4444-555555555555";

describe("api/intake/messages", () => {
  let handler;

  beforeEach(async () => {
    // Fresh module registry per test so the module-level rate limiter starts
    // with an empty hit log and tests can't leak budget into each other.
    vi.resetModules();
    mockSql.mockReset();
    mockSql.mockResolvedValue([{ id: 1, visitor_id: VISITOR_ID, content: "hello" }]);
    ({ default: handler } = await import("../../pages/api/intake/messages.js"));
  });

  it("rejects a non-GET method", async () => {
    const req = { ...createMockReq(VISITOR_ID), method: "POST" };
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it("rejects a missing visitorId", async () => {
    const res = createMockRes();
    await handler(createMockReq(undefined), res);
    expect(res._status).toBe(400);
  });

  it("rejects a malformed visitorId before any query runs", async () => {
    const res = createMockRes();
    await handler(createMockReq("x,parent_id.gt.0"), res);
    expect(res._status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns the thread on success, binding visitorId as a parameter", async () => {
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID), res);
    expect(res._status).toBe(200);
    expect(res._json.messages).toHaveLength(1);
    const [strings, ...values] = mockSql.mock.calls[0];
    expect(strings.join("")).not.toContain(VISITOR_ID);
    expect(values).toEqual([VISITOR_ID, VISITOR_ID]);
  });

  it("surfaces a query error as a generic 500", async () => {
    mockSql.mockRejectedValue(new Error("relation does not exist"));
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID), res);
    expect(res._status).toBe(500);
    expect(res._json.error).not.toMatch(/relation/);
  });

  it("allows a full hour's budget of 60 requests, then 429s the 61st", async () => {
    const ip = "198.51.100.7";
    for (let i = 0; i < 60; i++) {
      const res = createMockRes();
      await handler(createMockReq(VISITOR_ID, ip), res);
      expect(res._status).toBe(200);
    }

    const limited = createMockRes();
    await handler(createMockReq(VISITOR_ID, ip), limited);
    expect(limited._status).toBe(429);
    expect(limited._json.error).toMatch(/too many requests/i);
  });

  it("budgets per IP, so one abusive client cannot lock out another", async () => {
    const abusive = "198.51.100.8";
    for (let i = 0; i < 61; i++) {
      await handler(createMockReq(VISITOR_ID, abusive), createMockRes());
    }

    const other = createMockRes();
    await handler(createMockReq(VISITOR_ID, "198.51.100.9"), other);
    expect(other._status).toBe(200);
  });

  it("rate-limits before validating input, so malformed requests still cost budget", async () => {
    const ip = "198.51.100.10";
    // Burn the whole budget on requests that never pass validation.
    for (let i = 0; i < 60; i++) {
      await handler(createMockReq("not-a-uuid", ip), createMockRes());
    }

    // A well-formed request from the same IP is now throttled, not served.
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID, ip), res);
    expect(res._status).toBe(429);
  });
});
