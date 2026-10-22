/**
 * Coverage for the private payments demo (src/pages/api/admin/payments.ts),
 * which backs the gated /funding page. The guards matter most: it must refuse
 * anyone without the admin cookie or key, and it must never open a Checkout
 * Session on live keys.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

const mockCreate = vi.fn();
const mockList = vi.fn();
vi.mock("stripe", () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        create: (...args: unknown[]) => mockCreate(...args),
        list: (...args: unknown[]) => mockList(...args),
      },
    };
  },
}));

function createMockReq(
  method: string,
  { cookies = {}, headers = {}, body }: { cookies?: Record<string, string>; headers?: Record<string, string>; body?: unknown } = {}
): any {
  return { method, cookies, headers, body };
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

const ENV_KEYS = ["ADMIN_SESSION_TOKEN", "ADMIN_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
const AUTHED = { cookies: { tracker_session: "session-token" } };

describe("/api/admin/payments", () => {
  const saved: Record<string, string | undefined> = {};
  let handler: typeof import("src/pages/api/admin/payments").default;

  beforeEach(async () => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.ADMIN_SESSION_TOKEN = "session-token";
    delete process.env.ADMIN_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_valid";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    mockSql.mockReset();
    mockCreate.mockReset();
    mockList.mockReset();
    handler = (await import("src/pages/api/admin/payments")).default;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("refuses a request without the admin cookie or key", async () => {
    const res = createMockRes();
    await handler(createMockReq("GET"), res);
    expect(res._status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("reports config and pairs Stripe sessions with our recorded status", async () => {
    mockList.mockResolvedValue({
      data: [
        { id: "cs_1", created: 1, amount_total: 500, currency: "usd", metadata: { service_type: "demo_tip_5" }, status: "complete", payment_status: "paid" },
        { id: "cs_2", created: 2, amount_total: 1000, currency: "usd", metadata: {}, status: "open", payment_status: "unpaid" },
      ],
    });
    mockSql.mockResolvedValue([{ stripe_session_id: "cs_1", status: "paid" }]);

    const res = createMockRes();
    await handler(createMockReq("GET", AUTHED), res);

    expect(res._status).toBe(200);
    expect(res._json.config).toMatchObject({ mode: "test", webhook_secret: false });
    expect(res._json.sessions.map((s: any) => s.recorded_status)).toEqual(["paid", null]);
  });

  it("still lists Stripe's sessions when the database is unavailable", async () => {
    mockList.mockResolvedValue({ data: [{ id: "cs_1", created: 1, amount_total: 500, currency: "usd", metadata: {}, status: "open", payment_status: "unpaid" }] });
    mockSql.mockRejectedValue(new Error("no DATABASE_URL"));

    const res = createMockRes();
    await handler(createMockReq("GET", AUTHED), res);

    expect(res._status).toBe(200);
    expect(res._json.sessions).toHaveLength(1);
  });

  it("never opens a checkout on live keys", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_real";
    const res = createMockRes();
    await handler(createMockReq("POST", { ...AUTHED, body: { item: "tip_5" } }), res);
    expect(res._status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an item the server doesn't price", async () => {
    const res = createMockRes();
    await handler(createMockReq("POST", { ...AUTHED, body: { item: "tip_1000000" } }), res);
    expect(res._status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("opens a test checkout at the server's price and records it", async () => {
    mockCreate.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/cs_new" });
    mockSql.mockResolvedValue([]);

    const res = createMockRes();
    await handler(
      createMockReq("POST", { ...AUTHED, headers: { origin: "https://www.brooksroley.com" }, body: { item: "tip_10", amount: 1 } }),
      res
    );

    expect(res._status).toBe(200);
    expect(res._json.url).toBe("https://checkout.stripe.com/cs_new");
    const args = mockCreate.mock.calls[0][0];
    expect(args.line_items[0].price_data.unit_amount).toBe(1000);
    expect(args.payment_method_types).toBeUndefined();
    expect(args.success_url).toBe("https://www.brooksroley.com/funding?session=success");
    expect(args.metadata.service_type).toBe("demo_tip_10");
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});
