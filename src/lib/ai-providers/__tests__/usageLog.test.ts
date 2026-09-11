/**
 * Coverage for logLlmUsage, the shared token-usage logger for the site's two
 * unmetered LLM routes (ai-gateway, generate-profile). The one behavior that
 * matters most: a logging failure must never surface as a thrown error,
 * since both call sites run after (or during) an AI response already in
 * flight — see the doc comment on the function itself.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

import { logLlmUsage } from "src/lib/ai-providers/usageLog";

describe("logLlmUsage", () => {
  beforeEach(() => {
    mockSql.mockReset();
  });

  it("inserts an llm_usage event with the route, provider, model, and token counts", async () => {
    mockSql.mockResolvedValueOnce([]);

    await logLlmUsage("ai-gateway", "openrouter", "openrouter/nemotron-3-super", {
      inputTokens: 120,
      outputTokens: 340,
    });

    expect(mockSql).toHaveBeenCalledTimes(1);
    const values = mockSql.mock.calls[0].slice(1); // [0] is the template strings array
    expect(values[0]).toBe("ai-gateway");
    const metadata = JSON.parse(values[1] as string);
    expect(metadata).toEqual({
      provider: "openrouter",
      model: "openrouter/nemotron-3-super",
      inputTokens: 120,
      outputTokens: 340,
    });
  });

  it("stores null token counts when usage is unavailable, instead of throwing", async () => {
    mockSql.mockResolvedValueOnce([]);

    await logLlmUsage("generate-profile", "openrouter", "openrouter/gpt-oss-120b", {});

    const values = mockSql.mock.calls[0].slice(1);
    const metadata = JSON.parse(values[1] as string);
    expect(metadata.inputTokens).toBeNull();
    expect(metadata.outputTokens).toBeNull();
  });

  it("swallows a DB error rather than rejecting", async () => {
    mockSql.mockRejectedValueOnce(new Error("POSTGRES_URL is not configured"));

    await expect(
      logLlmUsage("ai-gateway", "openrouter", "some-model", { inputTokens: 1, outputTokens: 1 })
    ).resolves.toBeUndefined();
  });
});
