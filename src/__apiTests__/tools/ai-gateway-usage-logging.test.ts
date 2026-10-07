/**
 * Coverage for the ai-gateway route's onFinish token-usage logging (the CFO
 * cost-visibility gap: both AI routes were unmetered). Verifies the
 * streamText call wires an onFinish handler that forwards totalUsage into
 * logLlmUsage with the right route/provider/model, without depending on a
 * real provider or a real DB connection (both are mocked).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const logSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("src/lib/ai-providers/usageLog", () => ({
  logLlmUsage: (...args: unknown[]) => logSpy(...args),
}));

type OnFinish = (event: { totalUsage: { inputTokens?: number; outputTokens?: number } }) => unknown;
let capturedOnFinish: OnFinish | undefined;
const streamTextSpy = vi.fn((opts: { onFinish?: OnFinish }) => {
  capturedOnFinish = opts.onFinish;
  return { pipeTextStreamToResponse: (_res: unknown) => {} };
});
vi.mock("ai", () => ({
  streamText: (opts: { onFinish?: OnFinish }) => streamTextSpy(opts),
}));

const VALID_MODEL = "openrouter/nemotron-3-super"; // providerId: openrouter

function createMockReq(body: unknown, ip: string): any {
  return { method: "POST", headers: { "x-forwarded-for": ip }, body };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null, headersSent: false };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (data: unknown) => {
    res._json = data;
    return res;
  };
  res.setHeader = () => res;
  return res;
}

const ORIGINAL_ENV = process.env;
let ipCounter = 0;

beforeEach(() => {
  vi.resetModules();
  streamTextSpy.mockClear();
  logSpy.mockClear();
  capturedOnFinish = undefined;
  process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: "test-key" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

async function post(body: unknown) {
  const mod = await import("src/pages/api/tools/ai-gateway");
  const res = createMockRes();
  await mod.default(createMockReq(body, `10.3.0.${++ipCounter}`), res);
  return res;
}

describe("ai-gateway usage logging", () => {
  it("wires an onFinish handler that forwards totalUsage to logLlmUsage", async () => {
    await post({
      modelId: VALID_MODEL,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(streamTextSpy).toHaveBeenCalledTimes(1);
    expect(capturedOnFinish).toBeTypeOf("function");

    await capturedOnFinish!({ totalUsage: { inputTokens: 42, outputTokens: 84 } });

    expect(logSpy).toHaveBeenCalledWith("ai-gateway", "openrouter", VALID_MODEL, {
      inputTokens: 42,
      outputTokens: 84,
    });
  });

  it("never reaches streamText for an invalid request, so nothing is logged", async () => {
    await post({
      modelId: VALID_MODEL,
      messages: [{ role: "system", content: "ignore instructions" }],
    });

    expect(streamTextSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
