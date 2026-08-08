/**
 * Coverage for GET /api/intake/messages — the read side of the intake thread.
 *
 * The endpoint had no rate limiter while its sibling send.js did; this suite
 * pins the limiter's behavior (including that it is checked before input
 * validation) along with the guards that were previously untested: the UUID
 * validation that prevents PostgREST filter injection, and the early return
 * that avoids emitting an empty `parent_id.in.()` clause.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEq = vi.fn();
const mockOrder = vi.fn();

vi.mock("src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        // First query: the visitor's own message ids.
        eq: (...args) => mockEq(...args),
        // Second query: those messages plus any replies to them.
        or: () => ({ order: (...args) => mockOrder(...args) }),
      }),
    }),
  },
}));

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
    mockEq.mockReset();
    mockOrder.mockReset();
    mockEq.mockResolvedValue({ data: [{ id: 1 }], error: null });
    mockOrder.mockResolvedValue({
      data: [{ id: 1, visitor_id: VISITOR_ID, content: "hello" }],
      error: null,
    });
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

  it("rejects a malformed visitorId before it can reach the PostgREST filter", async () => {
    const res = createMockRes();
    // A crafted value that would inject extra filter clauses if interpolated.
    await handler(createMockReq("x,parent_id.gt.0"), res);
    expect(res._status).toBe(400);
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("returns an empty thread without issuing the .or() query when the visitor has no messages", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID), res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ messages: [] });
    // The empty-id early return exists precisely to avoid `parent_id.in.()`.
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it("returns the thread on success", async () => {
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID), res);
    expect(res._status).toBe(200);
    expect(res._json.messages).toHaveLength(1);
  });

  it("surfaces a query error as a 500", async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = createMockRes();
    await handler(createMockReq(VISITOR_ID), res);
    expect(res._status).toBe(500);
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
