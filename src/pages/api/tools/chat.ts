import type { NextApiRequest, NextApiResponse } from "next";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { sanitizeMessage } from "src/lib/ai-providers/sanitize";
import { getModelById, AI_MODELS } from "src/lib/ai-providers/models";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { modelId, systemPrompt, messages } = req.body as {
    modelId: string;
    systemPrompt: string;
    messages: ChatMessage[];
  };

  if (!modelId || !systemPrompt || !Array.isArray(messages)) {
    return res.status(400).json({ error: "modelId, systemPrompt, and messages are required" });
  }

  // Support both new-style IDs ("openrouter/nemotron-3-nano") and legacy providerModelIds
  const model = getModelById(modelId) ?? AI_MODELS.find((m) => m.providerModelId === modelId);
  if (!model) {
    return res.status(400).json({ error: `Unknown model: ${modelId}` });
  }

  // Sanitize the latest user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    const check = sanitizeMessage(lastMessage.content);
    if (!check.ok) {
      return res.status(400).json({ error: check.reason });
    }
    lastMessage.content = check.cleaned;
  }

  try {
    const result = streamText({
      model: openrouter(model.providerModelId),
      system: systemPrompt,
      messages,
      maxOutputTokens: 2000,
      temperature: 0.8,
    });

    result.pipeTextStreamToResponse(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat streaming failed:", message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Chat request failed. The model may be temporarily unavailable." });
    }
  }
}
