/**
 * /api/events stores coarse visitor context (where from, rough location,
 * device family) with each event — and never the network address.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

import handler from "src/pages/api/events";

function createRes(): any {
  const res: any = { _status: 200, _json: null };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: unknown) => { res._json = data; return res; };
  res.setHeader = () => res;
  return res;
}

const insertCall = () =>
  mockSql.mock.calls.find((call) => (call[0] as string[]).join("").includes("INSERT INTO events"));

describe("api/events — visitor context", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("stores referrer, location and device with the event, and no address", async () => {
    const req: any = {
      method: "POST",
      headers: {
        host: "www.brooksroley.com",
        "x-forwarded-for": "203.0.113.7",
        "x-vercel-ip-country": "US",
        "x-vercel-ip-country-region": "WA",
        "x-vercel-ip-city": "Seattle",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      },
      socket: {},
      body: {
        session_id: "s1",
        anon_id: "a1",
        page: "/resume",
        event_type: "page_view",
        metadata: { path: "/resume" },
        referrer: "https://www.linkedin.com/jobs/view/1?trk=x",
      },
    };
    const res = createRes();
    await handler(req, res);

    expect(res._status).toBe(202);
    const values = insertCall()!.slice(1);
    expect(values).toEqual([
      "s1", "a1", "/resume", "page_view", JSON.stringify({ path: "/resume" }),
      "https://www.linkedin.com/jobs/view/1", "US", "WA", "Seattle", "desktop", "Chrome", "macOS",
    ]);
    expect(JSON.stringify(mockSql.mock.calls)).not.toContain("203.0.113.7");
  });

  it("drops a referrer that is this site itself", async () => {
    const req: any = {
      method: "POST",
      headers: { host: "www.brooksroley.com", "x-forwarded-for": "203.0.113.8" },
      socket: {},
      body: { event_type: "page_view", referrer: "https://brooksroley.com/" },
    };
    await handler(req, createRes());
    expect(insertCall()!.slice(1)[5]).toBeNull();
  });
});
