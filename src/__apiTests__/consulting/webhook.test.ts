/**
 * Coverage for the Stripe webhook (src/pages/api/consulting/webhook.ts) —
 * the route that flips checkout_sessions.status from 'pending' to 'paid'
 * once Stripe confirms payment. This is the other half of the money path
 * alongside checkout.ts and was previously untested; see the API-route
 * test-coverage baseline audit for the full gap list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

const mockConstructEvent = vi.fn();
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      webhooks = {
        constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
      };
    },
  };
});

function createRawReq(
  method: string,
  headers: Record<string, string> = {},
  rawBody = ""
): any {
  return {
    method,
    headers,
    socket: {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(rawBody);
    },
  };
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

const ENV_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

describe("api/consulting/webhook (Stripe money path)", () => {
  const ORIGINAL_ENV: Record<string, string | undefined> = {};
  let handler: any;

  beforeEach(async () => {
    for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];
    vi.resetModules();
    mockSql.mockReset();
    mockConstructEvent.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_valid";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_valid";
    ({ default: handler } = await import("../../pages/api/consulting/webhook"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
      else process.env[key] = ORIGINAL_ENV[key];
    }
  });

  it("returns 405 for non-POST requests", async () => {
    const res = createMockRes();
    await handler(createRawReq("GET"), res);
    expect(res._status).toBe(405);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_SECRET_KEY is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    ({ default: handler } = await import("../../pages/api/consulting/webhook"));

    const res = createMockRes();
    await handler(createRawReq("POST", { "stripe-signature": "sig" }, "{}"), res);

    expect(res._status).toBe(503);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.resetModules();
    ({ default: handler } = await import("../../pages/api/consulting/webhook"));

    const res = createMockRes();
    await handler(createRawReq("POST", { "stripe-signature": "sig" }, "{}"), res);

    expect(res._status).toBe(503);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = createMockRes();
    await handler(createRawReq("POST", {}, "{}"), res);
    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/stripe-signature/);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when Stripe signature verification fails (rejects a forged webhook)", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = createMockRes();
    await handler(
      createRawReq("POST", { "stripe-signature": "bad_sig" }, '{"type":"checkout.session.completed"}'),
      res
    );

    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/Webhook verification failed/);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("marks the matching pending checkout_sessions row as paid on checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123" } },
    });
    mockSql.mockResolvedValueOnce([]);

    const res = createMockRes();
    await handler(
      createRawReq("POST", { "stripe-signature": "good_sig" }, '{"id":"evt_1"}'),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ received: true });
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(mockSql.mock.calls[0].slice(1)).toEqual(["cs_test_123"]);
  });

  it("does not touch the database for unrelated event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: { id: "pi_test_1" } },
    });

    const res = createMockRes();
    await handler(
      createRawReq("POST", { "stripe-signature": "good_sig" }, '{"id":"evt_2"}'),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json).toEqual({ received: true });
    expect(mockSql).not.toHaveBeenCalled();
  });
});
