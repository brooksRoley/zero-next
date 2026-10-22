/**
 * Coverage for the intake owner-notification addition: a new intake message
 * (voice or text) should trigger a best-effort server-side Resend email to
 * the owner's inbox, mirroring api/consulting/leads.ts's notifyNewLead. The
 * owner's address must never depend on anything client-supplied, and a
 * notification failure must never turn a persisted message into an error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({ sql: (...args) => mockSql(...args) }));
vi.mock("src/lib/intakeSchema", () => ({ ensureIntakeSchema: () => Promise.resolve() }));

function createMockReq(body, headers = {}) {
  return { method: "POST", headers, body, socket: {} };
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

describe("api/intake/send owner notification", () => {
  const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;
  let handler;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    mockSql.mockReset();
    mockSql.mockResolvedValue([{ id: 1, visitor_id: VISITOR_ID, content: "hello" }]);
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    ({ default: handler } = await import("../../pages/api/intake/send.js"));
  });

  afterEach(() => {
    if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
  });

  it("rejects a missing visitorId", async () => {
    const req = createMockReq({ type: "text", content: "hi" });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it("rejects a malformed visitorId", async () => {
    const req = createMockReq({ visitorId: "not-a-uuid", type: "text", content: "hi" });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it("does not call the notification service when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const req = createMockReq({ visitorId: VISITOR_ID, type: "text", content: "hello" });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a server-side notification to the owner's inbox when configured, never the client", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const req = createMockReq({
      visitorId: VISITOR_ID,
      visitorName: "Jordan",
      type: "text",
      content: "Interested in a dev sprint",
    });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(options.body);
    expect(payload.to).toEqual(["brooksroley@gmail.com"]);
    expect(payload.subject).toContain("Jordan");
    expect(payload.text).toContain("Interested in a dev sprint");
    // The response body returned to the client carries only the persisted
    // message — never the owner's notification address.
    expect(JSON.stringify(res._json)).not.toContain("brooksroley@gmail.com");
  });

  it("still returns 200 with the persisted message when the notification delivery fails", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    fetchMock.mockRejectedValue(new Error("network down"));
    const req = createMockReq({ visitorId: VISITOR_ID, type: "text", content: "hello" });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.message).toBeTruthy();
  });

  it("persists to the intake_messages table and returns the stored row", async () => {
    const res = createMockRes();
    await handler(createMockReq({ visitorId: VISITOR_ID, type: "text", content: "hello" }), res);
    expect(res._status).toBe(200);
    expect(res._json.message).toEqual({ id: 1, visitor_id: VISITOR_ID, content: "hello" });
    expect(mockSql.mock.calls[0][0].join("")).toContain("INSERT INTO intake_messages");
  });

  it("returns a generic error, never the database's message, when the write fails", async () => {
    mockSql.mockRejectedValue(new Error('relation "intake_messages" does not exist'));
    const res = createMockRes();
    await handler(createMockReq({ visitorId: VISITOR_ID, type: "text", content: "hello" }), res);
    expect(res._status).toBe(500);
    expect(res._json.error).not.toMatch(/relation|intake_messages/);
  });

  it("rejects an audio URL that isn't this site's own upload, so no foreign link reaches the inbox", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    const res = createMockRes();
    await handler(createMockReq({ visitorId: VISITOR_ID, type: "voice", audioUrl: "https://evil.example/x.webm" }), res);
    expect(res._status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("rejects oversized content", async () => {
    const res = createMockRes();
    await handler(createMockReq({ visitorId: VISITOR_ID, type: "text", content: "x".repeat(5001) }), res);
    expect(res._status).toBe(400);
  });
});
