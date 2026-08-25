/**
 * Coverage for the Stripe Checkout money path (src/pages/api/consulting/checkout.ts).
 * This route creates the actual payment session for consulting deposits and
 * writes the pending checkout_sessions row that the webhook later flips to
 * 'paid' — it was previously untested despite being the highest-risk route
 * on the site (an audit established a full API-route test-coverage baseline
 * and flagged this as the top gap; see the coverage baseline report).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

const mockCheckoutCreate = vi.fn();
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: (...args: unknown[]) => mockCheckoutCreate(...args),
        },
      };
    },
  };
});

function createMockReq(
  method: string,
  headers: Record<string, string> = {},
  body: unknown = undefined
): any {
  return { method, headers, body, socket: {} };
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

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_STRATEGY",
  "STRIPE_PRICE_SPRINT",
  "STRIPE_PRICE_FRACTIONAL",
] as const;

describe("api/consulting/checkout (Stripe money path)", () => {
  const ORIGINAL_ENV: Record<string, string | undefined> = {};
  let handler: any;

  beforeEach(async () => {
    for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];
    vi.resetModules();
    mockSql.mockReset();
    mockCheckoutCreate.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_valid";
    delete process.env.STRIPE_PRICE_STRATEGY;
    delete process.env.STRIPE_PRICE_SPRINT;
    delete process.env.STRIPE_PRICE_FRACTIONAL;
    ({ default: handler } = await import("../../pages/api/consulting/checkout"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
      else process.env[key] = ORIGINAL_ENV[key];
    }
  });

  it("returns 405 for non-POST requests", async () => {
    const res = createMockRes();
    await handler(createMockReq("GET"), res);
    expect(res._status).toBe(405);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_SECRET_KEY is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    ({ default: handler } = await import("../../pages/api/consulting/checkout"));

    const res = createMockRes();
    await handler(createMockReq("POST", {}, { service_type: "strategy_session" }), res);

    expect(res._status).toBe(503);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_SECRET_KEY is still the placeholder value", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_REPLACE_ME";
    vi.resetModules();
    ({ default: handler } = await import("../../pages/api/consulting/checkout"));

    const res = createMockRes();
    await handler(createMockReq("POST", {}, { service_type: "strategy_session" }), res);

    expect(res._status).toBe(503);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when service_type is missing", async () => {
    const res = createMockRes();
    await handler(createMockReq("POST", {}, {}), res);
    expect(res._status).toBe(400);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown service_type", async () => {
    const res = createMockRes();
    await handler(
      createMockReq("POST", {}, { service_type: "gold_plated_everything" }),
      res
    );
    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/Unknown service_type/);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("creates a checkout session using server-side pricing (ignores any client-supplied amount) and records a pending checkout_sessions row", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/session_abc",
    });
    mockSql.mockResolvedValueOnce([]);

    const res = createMockRes();
    await handler(
      createMockReq(
        "POST",
        { origin: "https://brooksroley.com" },
        {
          service_type: "strategy_session",
          lead_id: 42,
          customer_email: "client@example.com",
          // A malicious client trying to pay $0.01 instead of the real price —
          // the route must never read pricing from the request body.
          amount_cents: 1,
        }
      ),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json.url).toBe("https://checkout.stripe.com/session_abc");

    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCheckoutCreate.mock.calls[0][0];
    expect(createArgs.mode).toBe("payment");
    expect(createArgs.customer_email).toBe("client@example.com");
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(15000); // server-side PRICE_MAP, not client's 1
    expect(createArgs.line_items[0].quantity).toBe(1);
    expect(createArgs.success_url).toBe("https://brooksroley.com/consulting?session=success");
    expect(createArgs.cancel_url).toBe("https://brooksroley.com/consulting?session=cancelled");
    expect(createArgs.metadata).toMatchObject({ service_type: "strategy_session", lead_id: "42" });

    expect(mockSql).toHaveBeenCalledTimes(1);
    const insertValues = mockSql.mock.calls[0].slice(1);
    expect(insertValues).toEqual(["cs_test_123", 42, 15000, "strategy_session"]);
  });

  it("uses a saved Stripe Price ID instead of inline price_data when the tier's env var is set", async () => {
    process.env.STRIPE_PRICE_SPRINT = "price_1AbcDevSprint";
    vi.resetModules();
    ({ default: handler } = await import("../../pages/api/consulting/checkout"));

    mockCheckoutCreate.mockResolvedValueOnce({
      id: "cs_test_456",
      url: "https://checkout.stripe.com/session_def",
    });
    mockSql.mockResolvedValueOnce([]);

    const res = createMockRes();
    await handler(
      createMockReq("POST", {}, { service_type: "dev_sprint" }),
      res
    );

    expect(res._status).toBe(200);
    const createArgs = mockCheckoutCreate.mock.calls[0][0];
    expect(createArgs.line_items[0]).toEqual({ price: "price_1AbcDevSprint", quantity: 1 });
  });

  it("rate-limits a single IP to 10 requests per hour and returns 429 after that", async () => {
    mockCheckoutCreate.mockResolvedValue({
      id: "cs_test_x",
      url: "https://checkout.stripe.com/session_x",
    });
    mockSql.mockResolvedValue([]);

    const reqHeaders = { "x-forwarded-for": "203.0.113.9" };
    let lastRes: any;
    for (let i = 0; i < 10; i++) {
      lastRes = createMockRes();
      await handler(
        createMockReq("POST", reqHeaders, { service_type: "strategy_session" }),
        lastRes
      );
      expect(lastRes._status).toBe(200);
    }

    const eleventhRes = createMockRes();
    await handler(
      createMockReq("POST", reqHeaders, { service_type: "strategy_session" }),
      eleventhRes
    );
    expect(eleventhRes._status).toBe(429);
    expect(mockCheckoutCreate).toHaveBeenCalledTimes(10);
  });
});
