import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildProfilePrompt } from "src/lib/ai-providers/profile-prompt";
import { sanitizeOneLiner, sanitizeProfile } from "src/lib/ai-providers/sanitize";
import { DEFAULT_PROFILE_MODEL, getModelById } from "src/lib/ai-providers/models";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, oneLiner } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const sanitized = sanitizeOneLiner(oneLiner || "");
  if (!sanitized.ok) {
    return res.status(400).json({ error: sanitized.reason });
  }

  try {
    const { text } = await generateText({
      model: openrouter(getModelById(DEFAULT_PROFILE_MODEL)?.providerModelId ?? DEFAULT_PROFILE_MODEL),
      prompt: buildProfilePrompt(name.trim(), sanitized.cleaned),
      maxOutputTokens: 1500,
      temperature: 0.9,
    });

    const profileCheck = sanitizeProfile(text);
    if (!profileCheck.ok) {
      return res.status(500).json({ error: "Generated profile failed safety check. Try again." });
    }

    return res.status(200).json({ profile: profileCheck.cleaned });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Profile generation failed:", message);
    return res.status(502).json({ error: "Failed to generate profile. The model may be temporarily unavailable." });
  }
}
