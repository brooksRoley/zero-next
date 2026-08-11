import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMocks } from "node-mocks-http";

// A plain hoisted closure stands in for the `sql` tagged-template. We avoid a
// vi.fn() here on purpose: when a vi.fn() implementation throws/rejects and the
// mock is reset in beforeEach, vitest's internal mock-result tracking surfaces a
// phantom unhandled-rejection and fails the test even though the handler behaves
// correctly. A hand-rolled closure has no such instrumentation.
const state = vi.hoisted(() => ({
  impl: (..._a: unknown[]): Promise<unknown[]> => Promise.resolve([]),
}));
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => state.impl(...args),
}));

import handler from "../summary";

describe("GET /api/nba/tft/summary", () => {
  beforeEach(() => {
    state.impl = () => Promise.resolve([]);
  });

  it("returns 503 when no active version exists", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/no active/i);
  });

  it("returns a clean JSON 503 (not a raw 500) when the TFT tables are unprovisioned", async () => {
    // Neon throws SQLSTATE 42P01 when tft_coefficients doesn't exist in this
    // environment — the prod regression that stranded the case study on an
    // infinite spinner. It must degrade to parseable JSON, not an HTML 500.
    const err = Object.assign(
      new Error('relation "tft_coefficients" does not exist'),
      { code: "42P01" }
    );
    state.impl = () => Promise.reject(err);
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/provisioned/i);
  });

  it("returns the backtest payload when an active version exists", async () => {
    let call = 0;
    state.impl = () => {
      call++;
      return Promise.resolve(
        call === 1
          ? [
              {
                version: "v1",
                fit_season: "2024-25",
                coefficients: { a: 1 },
                metrics: { mae: 3.2 },
              },
            ]
          : [{ team_id: 1, sim_wins: 50, actual_wins: 52, sim_pred_wins: 49 }]
      );
    };
    const { req, res } = createMocks({ method: "GET" });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.version).toBe("v1");
    expect(body.teams).toHaveLength(1);
    expect(body.teams[0].eps_engine).toBe(2); // 52 actual - 50 sim
  });
});
