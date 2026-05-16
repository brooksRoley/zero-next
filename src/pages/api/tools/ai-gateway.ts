import type { NextApiRequest, NextApiResponse } from "next";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getModelById, type AIModel } from "src/lib/ai-providers/models";
import { getProvider, type Provider } from "src/lib/ai-providers/providers";
import { getFallbackModels } from "src/lib/ai-providers/fallback";
import { resolveKey } from "src/lib/ai-providers/keys";
import { sanitizeMessage } from "src/lib/ai-providers/sanitize";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory per-IP timestamp log. Resets on cold start and is per-instance on
// Vercel; that's intentional — good-enough defense against casual abuse of
// server API keys without adding Redis. For stronger guarantees, swap in a KV
// store later.
const ipHits = new Map<string, number[]>();

function getClientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (ipHits.get(ip) || []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  // Opportunistic cleanup so the Map doesn't grow unbounded across cold-warm cycles.
  if (ipHits.size > 1000) {
    ipHits.forEach((ts: number[], k: string) => {
      const pruned = ts.filter((t) => t > cutoff);
      if (pruned.length === 0) ipHits.delete(k);
      else ipHits.set(k, pruned);
    });
  }
  return false;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function createProviderClient(provider: Provider, apiKey: string) {
  if (provider.id === "openrouter") {
    return createOpenRouter({ apiKey });
  }
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey,
  });
}

async function tryStream(
  model: AIModel,
  provider: Provider,
  apiKey: string,
  systemPrompt: string | undefined,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
  res: NextApiResponse
): Promise<boolean> {
  try {
    const client = createProviderClient(provider, apiKey);
    const result = streamText({
      model: client(model.providerModelId),
      system: systemPrompt,
      messages,
      maxOutputTokens: maxTokens,
      temperature,
    });
    result.pipeTextStreamToResponse(res);
    return true;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429) return false;
    throw err;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { modelId, systemPrompt, messages, maxTokens, temperature } =
    req.body as {
      modelId: string;
      systemPrompt?: string;
      messages: ChatMessage[];
      maxTokens?: number;
      temperature?: number;
    };

  if (!modelId || !Array.isArray(messages) || messages.length === 0) {
    return res
      .status(400)
      .json({ error: "modelId and messages are required" });
  }

  const model = getModelById(modelId);
  if (!model) {
    return res.status(400).json({ error: `Unknown model: ${modelId}` });
  }

  const provider = getProvider(model.providerId);
  if (!provider) {
    return res.status(400).json({ error: `Unknown provider: ${model.providerId}` });
  }

  // Sanitize latest user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    const check = sanitizeMessage(lastMessage.content);
    if (!check.ok) {
      return res.status(400).json({ error: check.reason });
    }
    lastMessage.content = check.cleaned;
  }

  // Resolve API key (BYOK header > env)
  const byokHeader = req.headers["x-provider-key"] as string | undefined;
  const apiKey = resolveKey(model.providerId, byokHeader);
  if (!apiKey) {
    return res
      .status(401)
      .json({ error: `No API key available for ${provider.name}. Add one in the API Keys panel or set ${provider.envKey} on the server.` });
  }

  const maxTok = maxTokens ?? 2000;
  const temp = temperature ?? 0.8;

  try {
    const success = await tryStream(
      model,
      provider,
      apiKey,
      systemPrompt,
      messages,
      maxTok,
      temp,
      res
    );
    if (success) return;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status !== 429) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Gateway error:", message);
      if (!res.headersSent) {
        return res.status(502).json({
          error: "Request failed. The model may be temporarily unavailable.",
        });
      }
      return;
    }
  }

  // 429: try fallback providers
  const exhausted = [model.providerId];
  const fallbacks = getFallbackModels(modelId, exhausted);

  for (const fbModel of fallbacks) {
    const fbProvider = getProvider(fbModel.providerId);
    if (!fbProvider) continue;
    const fbKey = resolveKey(fbModel.providerId, byokHeader);
    if (!fbKey) continue;

    try {
      const success = await tryStream(
        fbModel,
        fbProvider,
        fbKey,
        systemPrompt,
        messages,
        maxTok,
        temp,
        res
      );
      if (success) return;
    } catch {
      exhausted.push(fbModel.providerId);
      continue;
    }
  }

  if (!res.headersSent) {
    return res.status(429).json({
      error: "All providers rate-limited for this model. Try a different model or wait a moment.",
    });
  }
}
