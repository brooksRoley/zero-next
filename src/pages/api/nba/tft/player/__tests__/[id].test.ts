import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMocks } from "node-mocks-http";

// See summary.test.ts for why this is a plain closure rather than a vi.fn().
const state = vi.hoisted(() => ({
  impl: (..._a: unknown[]): Promise<unknown[]> => Promise.resolve([]),
}));
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => state.impl(...args),
}));

import handler from "../[id]";

describe("GET /api/nba/tft/player/[id]", () => {
  beforeEach(() => {
    state.impl = () => Promise.resolve([]);
  });

  it("returns 400 when the id is not a number", async () => {
    let called = false;
    state.impl = () => {
      called = true;
      return Promise.resolve([]);
    };
    const { req, res } = createMocks({ method: "GET", query: { id: "abc" } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(called).toBe(false);
  });

  it("returns 503 when no active version exists", async () => {
    const { req, res } = createMocks({ method: "GET", query: { id: "203999" } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    expect(JSON.parse(res._getData()).error).toMatch(/no active/i);
  });

  it("returns a clean JSON 503 when the TFT tables are unprovisioned", async () => {
    const err = Object.assign(
      new Error('relation "tft_coefficients" does not exist'),
      { code: "42P01" }
    );
    state.impl = () => Promise.reject(err);
    const { req, res } = createMocks({ method: "GET", query: { id: "203999" } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    expect(JSON.parse(res._getData()).error).toMatch(/provisioned/i);
  });

  it("returns 404 when the player is not in the backtest", async () => {
    let call = 0;
    state.impl = () => {
      call++;
      return Promise.resolve(call === 1 ? [{ version: "v1" }] : []);
    };
    const { req, res } = createMocks({ method: "GET", query: { id: "203999" } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });

  it("returns the player row when present", async () => {
    let call = 0;
    state.impl = () => {
      call++;
      return Promise.resolve(
        call === 1
          ? [{ version: "v1" }]
          : [
              {
                sim_shot_bins: [1],
                actual_shot_bins: [2],
                sim_box: {},
                actual_box: {},
              },
            ]
      );
    };
    const { req, res } = createMocks({ method: "GET", query: { id: "203999" } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).sim_shot_bins).toEqual([1]);
  });
});
