import { sql } from "src/lib/db";

export type LlmUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

/**
 * Best-effort token-usage logging for the site's two unmetered LLM routes
 * (ai-gateway, generate-profile). Writes into the shared `events` table
 * (event_type: "llm_usage", page: the route name) rather than a dedicated
 * table, matching how every other interaction on the site is tracked.
 *
 * Never throws: a logging failure must not affect an AI response that has
 * already streamed to (or been sent back to) the caller.
 */
export async function logLlmUsage(
  route: string,
  providerId: string,
  modelId: string,
  usage: LlmUsage
): Promise<void> {
  try {
    await sql`
      INSERT INTO events (event_type, page, metadata)
      VALUES (
        'llm_usage',
        ${route},
        ${JSON.stringify({
          provider: providerId,
          model: modelId,
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
        })}
      )
    `;
  } catch {
    // Best-effort — see doc comment above.
  }
}
