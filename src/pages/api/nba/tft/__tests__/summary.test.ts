import { describe, it, expect, vi } from "vitest";
import handler from "../summary";
import { createMocks } from "node-mocks-http";

vi.mock("src/lib/db", () => ({
  sql: async (_parts: TemplateStringsArray, ..._values: unknown[]) => [],
}));

describe("GET /api/nba/tft/summary", () => {
  it("returns 503 when no active version exists", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/no active/i);
  });
});
