/**
 * Coverage for the generate-profile route's token-usage logging (the other
 * half of the CFO cost-visibility gap alongside ai-gateway). Verifies
 * generateText's returned `usage` is forwarded into logLlmUsage with the
 * right route/provider/model, and that a missing `usage` field (some
 * providers omit it) degrades to nulls instead of throwing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const logSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("src/lib/ai-providers/usageLog", () => ({
  logLlmUsage: (...args: unknown[]) => logSpy(...args),
}));

let generateTextResult: { text: string; usage?: { inputTokens?: number; outputTokens?: number } } = {
  text: "# Someone\n\n## Voice\nCalm.",
};
const generateTextSpy = vi.fn(async (_opts: { prompt: string }) => generateTextResult);
vi.mock("ai", () => ({
  generateText: (opts: { prompt: string }) => generateTextSpy(opts),
}));

function createMockReq(body: unknown, ip: string): any {
  return { method: "POST", headers: { "x-forwarded-for": ip }, body };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null };
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
  generateTextSpy.mockClear();
  logSpy.mockClear();
  generateTextResult = { text: "# Someone\n\n## Voice\nCalm." };
  process.env = { ...ORIGINAL_ENV, OPENROUTER_API_KEY: "test-key" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

async function post(body: unknown) {
  const mod = await import("src/pages/api/tools/generate-profile");
  const res = createMockRes();
  await mod.default(createMockReq(body, `10.4.0.${++ipCounter}`), res);
  return res;
}

describe("generate-profile usage logging", () => {
  it("forwards the DEFAULT_PROFILE_MODEL's provider/model and token counts to logLlmUsage", async () => {
    generateTextResult = {
      text: "# Someone\n\n## Voice\nCalm.",
      usage: { inputTokens: 55, outputTokens: 210 },
    };

    const res = await post({ name: "Ada Lovelace", oneLiner: "a computing pioneer" });

    expect(res._status).toBe(200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [route, providerId, , usage] = logSpy.mock.calls[0];
    expect(route).toBe("generate-profile");
    expect(providerId).toBe("openrouter");
    expect(usage).toEqual({ inputTokens: 55, outputTokens: 210 });
  });

  it("logs null token counts, without throwing, when usage is missing from the result", async () => {
    generateTextResult = { text: "# Someone\n\n## Voice\nCalm." }; // no usage field

    const res = await post({ name: "Ada Lovelace", oneLiner: "a computing pioneer" });

    expect(res._status).toBe(200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const usage = logSpy.mock.calls[0][3];
    expect(usage).toEqual({ inputTokens: undefined, outputTokens: undefined });
  });

  it("never calls logLlmUsage when input validation rejects the request first", async () => {
    const res = await post({ name: 12345, oneLiner: "a concept" });

    expect(res._status).toBe(400);
    expect(generateTextSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
