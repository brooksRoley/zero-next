# Multi-Provider AI Gateway & Model Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the chat sandbox from 3 OpenRouter models to ~50 free models across 3 providers (OpenRouter, Groq, Cerebras) with a unified gateway API, and build a Model Arena page with side-by-side comparison and blind battle modes.

**Architecture:** A provider-agnostic registry (`src/lib/ai-providers/`) defines providers, models, and key resolution. A single gateway API route (`/api/tools/ai-gateway`) replaces the old `/api/tools/chat` route, handling streaming, sanitization, and 429 fallback across providers. The chat sandbox upgrades its model dropdown and API calls, and a new Model Arena page at `/tools/model-arena` enables side-by-side and blind battle comparisons.

**Tech Stack:** Next.js Pages Router, Vercel AI SDK v6, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`, TypeScript, Tailwind CSS, localStorage for BYOK keys and battle history.

---

## File Structure

### New files (create)
- `src/lib/ai-providers/providers.ts` — provider definitions (OpenRouter, Groq, Cerebras)
- `src/lib/ai-providers/models.ts` — full model registry (~50 free models), lookup functions
- `src/lib/ai-providers/fallback.ts` — cross-provider equivalent lookup + fallback selection
- `src/lib/ai-providers/keys.ts` — API key resolution (BYOK header > server env)
- `src/lib/ai-providers/sanitize.ts` — moved from openrouter/sanitize.ts (unchanged content)
- `src/lib/ai-providers/colors.ts` — moved from openrouter/colors.ts (unchanged content)
- `src/lib/ai-providers/profile-prompt.ts` — moved from openrouter/profile-prompt.ts (unchanged content)
- `src/pages/api/tools/ai-gateway.ts` — unified streaming gateway API route
- `src/pages/tools/model-arena.tsx` — Model Arena page with Compare + Battle modes

### Modified files
- `src/pages/tools/chat.tsx` — update imports, model dropdown with optgroups, BYOK panel, use gateway endpoint
- `src/pages/api/tools/generate-profile.ts` — update imports to use new provider resolution
- `src/pages/index.tsx` — add Model Arena card

### Deleted files
- `src/pages/api/tools/chat.ts` — replaced by ai-gateway
- `src/pages/api/tools/setup-characters.ts` — one-time migration, table exists
- `src/lib/openrouter/` — entire directory (after contents moved to ai-providers)

---

### Task 1: Install dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @ai-sdk/openai-compatible**

```bash
cd /Users/brooks/Desktop/zero-next && yarn add @ai-sdk/openai-compatible
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/brooks/Desktop/zero-next && grep openai-compatible package.json
```

Expected: `"@ai-sdk/openai-compatible": "^x.x.x"` in dependencies

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add package.json yarn.lock && git commit -m "deps: add @ai-sdk/openai-compatible for multi-provider gateway"
```

---

### Task 2: Create provider registry (`src/lib/ai-providers/providers.ts`)

**Files:**
- Create: `src/lib/ai-providers/providers.ts`

- [ ] **Step 1: Create the providers file**

```ts
// src/lib/ai-providers/providers.ts

export type Provider = {
  id: "openrouter" | "groq" | "cerebras";
  name: string;
  baseUrl: string;
  envKey: string;
  rateLimit: { rpm: number; rpd: number };
};

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    rateLimit: { rpm: 20, rpd: 200 },
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    rateLimit: { rpm: 30, rpd: 1000 },
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    rateLimit: { rpm: 30, rpd: 1000000 },
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/ai-providers/providers.ts && git commit -m "feat: add multi-provider registry with OpenRouter, Groq, Cerebras"
```

---

### Task 3: Create model registry (`src/lib/ai-providers/models.ts`)

**Files:**
- Create: `src/lib/ai-providers/models.ts`

- [ ] **Step 1: Create the models file with full registry**

```ts
// src/lib/ai-providers/models.ts

export type AIModel = {
  id: string;
  providerId: "openrouter" | "groq" | "cerebras";
  providerModelId: string;
  displayName: string;
  contextLength: number;
  capabilities: ("chat" | "vision" | "code")[];
  free: boolean;
  equivalentIds?: string[];
};

export const AI_MODELS: AIModel[] = [
  // ── OpenRouter ──
  {
    id: "openrouter/nvidia-nemotron-3-super",
    providerId: "openrouter",
    providerModelId: "nvidia/llama-3.3-nemotron-super-49b-v1:free",
    displayName: "NVIDIA Nemotron Super 49B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gpt-oss-120b",
    providerId: "openrouter",
    providerModelId: "openai/gpt-4.1-nano:free",
    displayName: "OpenAI GPT-4.1 Nano",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/gpt-oss-120b", "cerebras/gpt-oss-120b"],
  },
  {
    id: "openrouter/llama-3.3-70b",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-3.3-70b-instruct:free",
    displayName: "Meta Llama 3.3 70B",
    contextLength: 131_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/llama-3.3-70b"],
  },
  {
    id: "openrouter/llama-4-scout",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-4-scout:free",
    displayName: "Meta Llama 4 Scout",
    contextLength: 512_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["groq/llama-4-scout"],
  },
  {
    id: "openrouter/llama-4-maverick",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-4-maverick:free",
    displayName: "Meta Llama 4 Maverick",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["groq/llama-4-maverick"],
  },
  {
    id: "openrouter/qwen3-235b",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-235b-a22b:free",
    displayName: "Qwen3 235B A22B",
    contextLength: 40_960,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["cerebras/qwen3-235b"],
  },
  {
    id: "openrouter/qwen3-coder-480b",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-coder-480b-a35b:free",
    displayName: "Qwen3 Coder 480B",
    contextLength: 65_536,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["cerebras/qwen3-coder-480b"],
  },
  {
    id: "openrouter/gemma-4-31b",
    providerId: "openrouter",
    providerModelId: "google/gemma-4-12b-it:free",
    displayName: "Google Gemma 4 12B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-27b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-27b-it:free",
    displayName: "Google Gemma 3 27B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-12b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-12b-it:free",
    displayName: "Google Gemma 3 12B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-4b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-4b-it:free",
    displayName: "Google Gemma 3 4B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/mistral-small-3.1",
    providerId: "openrouter",
    providerModelId: "mistralai/mistral-small-3.1-24b-instruct:free",
    displayName: "Mistral Small 3.1 24B",
    contextLength: 131_000,
    capabilities: ["chat", "code", "vision"],
    free: true,
  },
  {
    id: "openrouter/devstral-2",
    providerId: "openrouter",
    providerModelId: "mistralai/devstral-2:free",
    displayName: "Mistral Devstral 2 123B",
    contextLength: 131_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/minimax-m2.5",
    providerId: "openrouter",
    providerModelId: "minimax/minimax-m2.5:free",
    displayName: "MiniMax M2.5",
    contextLength: 1_000_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/glm-4.5-air",
    providerId: "openrouter",
    providerModelId: "zhipu-ai/glm-4-air:free",
    displayName: "Z.AI GLM 4 Air",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["cerebras/glm-4.7"],
  },
  {
    id: "openrouter/nous-hermes-3-405b",
    providerId: "openrouter",
    providerModelId: "nousresearch/hermes-3-llama-3.1-405b:free",
    displayName: "Nous Hermes 3 405B",
    contextLength: 16_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/ling-2.6-flash",
    providerId: "openrouter",
    providerModelId: "inclusionai/ling-2.6-flash:free",
    displayName: "InclusionAI Ling 2.6 Flash",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3n-4b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3n-e4b-it:free",
    displayName: "Google Gemma 3n 4B",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/free-router",
    providerId: "openrouter",
    providerModelId: "openrouter/auto",
    displayName: "OpenRouter Auto (Free)",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/nemotron-3-nano",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-nano-omni-free",
    displayName: "NVIDIA Nemotron 3 Nano Omni",
    contextLength: 256_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/arcee-trinity",
    providerId: "openrouter",
    providerModelId: "arcee-ai/arcee-trinity-large-preview:free",
    displayName: "Arcee Trinity Large Preview",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },

  // ── Groq ──
  {
    id: "groq/llama-4-scout",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    displayName: "Meta Llama 4 Scout",
    contextLength: 512_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["openrouter/llama-4-scout"],
  },
  {
    id: "groq/llama-4-maverick",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-maverick-17b-128e-instruct",
    displayName: "Meta Llama 4 Maverick",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["openrouter/llama-4-maverick"],
  },
  {
    id: "groq/llama-3.3-70b",
    providerId: "groq",
    providerModelId: "llama-3.3-70b-versatile",
    displayName: "Meta Llama 3.3 70B Versatile",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/llama-3.3-70b"],
  },
  {
    id: "groq/llama-3.1-8b",
    providerId: "groq",
    providerModelId: "llama-3.1-8b-instant",
    displayName: "Meta Llama 3.1 8B Instant",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["cerebras/llama-3.1-8b"],
  },
  {
    id: "groq/qwq-32b",
    providerId: "groq",
    providerModelId: "qwen-qwq-32b",
    displayName: "Qwen QwQ 32B",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "groq/gpt-oss-120b",
    providerId: "groq",
    providerModelId: "openai/gpt-4.1-nano",
    displayName: "OpenAI GPT-4.1 Nano",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/gpt-oss-120b", "cerebras/gpt-oss-120b"],
  },
  {
    id: "groq/deepseek-r1-70b",
    providerId: "groq",
    providerModelId: "deepseek-r1-distill-llama-70b",
    displayName: "DeepSeek R1 Distill 70B",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "groq/mistral-saba-24b",
    providerId: "groq",
    providerModelId: "mistral-saba-24b",
    displayName: "Mistral Saba 24B",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "groq/gemma-2-9b",
    providerId: "groq",
    providerModelId: "gemma2-9b-it",
    displayName: "Google Gemma 2 9B IT",
    contextLength: 8_192,
    capabilities: ["chat"],
    free: true,
  },

  // ── Cerebras ──
  {
    id: "cerebras/qwen3-235b",
    providerId: "cerebras",
    providerModelId: "qwen-3-235b-a22b",
    displayName: "Qwen3 235B A22B (~1400 tok/s)",
    contextLength: 64_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/qwen3-235b"],
  },
  {
    id: "cerebras/gpt-oss-120b",
    providerId: "cerebras",
    providerModelId: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano (~3000 tok/s)",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/gpt-oss-120b", "groq/gpt-oss-120b"],
  },
  {
    id: "cerebras/qwen3-coder-480b",
    providerId: "cerebras",
    providerModelId: "qwen-3-coder-480b-a35b",
    displayName: "Qwen3 Coder 480B",
    contextLength: 65_536,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/qwen3-coder-480b"],
  },
  {
    id: "cerebras/llama-3.1-8b",
    providerId: "cerebras",
    providerModelId: "llama3.1-8b",
    displayName: "Llama 3.1 8B (~1800 tok/s)",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["groq/llama-3.1-8b"],
  },
  {
    id: "cerebras/glm-4.7",
    providerId: "cerebras",
    providerModelId: "glm-4.7",
    displayName: "Z.AI GLM 4.7",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["openrouter/glm-4.5-air"],
  },
];

export const DEFAULT_PROFILE_MODEL = "openrouter/nemotron-3-nano";

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(
  providerId: string
): AIModel[] {
  return AI_MODELS.filter((m) => m.providerId === providerId);
}

/** Group models by provider for UI optgroups */
export function getModelsGroupedByProvider(): {
  providerId: string;
  providerName: string;
  models: AIModel[];
}[] {
  const groups: Map<string, { providerName: string; models: AIModel[] }> = new Map();
  for (const model of AI_MODELS) {
    if (!groups.has(model.providerId)) {
      const names: Record<string, string> = {
        openrouter: "OpenRouter",
        groq: "Groq",
        cerebras: "Cerebras",
      };
      groups.set(model.providerId, {
        providerName: names[model.providerId] || model.providerId,
        models: [],
      });
    }
    groups.get(model.providerId)!.models.push(model);
  }
  return Array.from(groups.entries()).map(([providerId, data]) => ({
    providerId,
    ...data,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/ai-providers/models.ts && git commit -m "feat: add ~35 free model registry across OpenRouter, Groq, Cerebras"
```

---

### Task 4: Create fallback logic (`src/lib/ai-providers/fallback.ts`)

**Files:**
- Create: `src/lib/ai-providers/fallback.ts`

- [ ] **Step 1: Create the fallback file**

```ts
// src/lib/ai-providers/fallback.ts

import { AI_MODELS, type AIModel } from "./models";

/**
 * Given a model that returned 429, find equivalent models on other providers.
 * Returns them in order, skipping the exhausted provider.
 */
export function getFallbackModels(
  failedModelId: string,
  exhaustedProviderIds: string[]
): AIModel[] {
  const model = AI_MODELS.find((m) => m.id === failedModelId);
  if (!model?.equivalentIds) return [];

  return model.equivalentIds
    .map((eqId) => AI_MODELS.find((m) => m.id === eqId))
    .filter((m): m is AIModel => !!m && !exhaustedProviderIds.includes(m.providerId));
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/ai-providers/fallback.ts && git commit -m "feat: add cross-provider fallback resolution for rate-limited models"
```

---

### Task 5: Create key resolution (`src/lib/ai-providers/keys.ts`)

**Files:**
- Create: `src/lib/ai-providers/keys.ts`

- [ ] **Step 1: Create the keys file**

```ts
// src/lib/ai-providers/keys.ts

import { getProvider } from "./providers";

/**
 * Resolve API key for a provider.
 * Priority: BYOK header > server environment variable.
 */
export function resolveKey(
  providerId: string,
  byokHeader?: string
): string | null {
  if (byokHeader?.trim()) return byokHeader.trim();

  const provider = getProvider(providerId);
  if (!provider) return null;

  const envVal = process.env[provider.envKey];
  return envVal?.trim() || null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/ai-providers/keys.ts && git commit -m "feat: add BYOK + env key resolution for AI providers"
```

---

### Task 6: Move shared utilities to `src/lib/ai-providers/`

**Files:**
- Create: `src/lib/ai-providers/sanitize.ts` (copy from `src/lib/openrouter/sanitize.ts`)
- Create: `src/lib/ai-providers/colors.ts` (copy from `src/lib/openrouter/colors.ts`)
- Create: `src/lib/ai-providers/profile-prompt.ts` (copy from `src/lib/openrouter/profile-prompt.ts`)
- Delete: `src/lib/openrouter/` (entire directory)

- [ ] **Step 1: Copy files to new location**

```bash
cd /Users/brooks/Desktop/zero-next && mkdir -p src/lib/ai-providers && cp src/lib/openrouter/sanitize.ts src/lib/ai-providers/sanitize.ts && cp src/lib/openrouter/colors.ts src/lib/ai-providers/colors.ts && cp src/lib/openrouter/profile-prompt.ts src/lib/ai-providers/profile-prompt.ts
```

- [ ] **Step 2: Remove old directory**

```bash
cd /Users/brooks/Desktop/zero-next && rm -rf src/lib/openrouter
```

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add -A src/lib/ai-providers/ src/lib/openrouter/ && git commit -m "refactor: move shared AI utilities from openrouter/ to ai-providers/"
```

---

### Task 7: Create AI gateway API route (`src/pages/api/tools/ai-gateway.ts`)

**Files:**
- Create: `src/pages/api/tools/ai-gateway.ts`

- [ ] **Step 1: Create the gateway route**

```ts
// src/pages/api/tools/ai-gateway.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getModelById, type AIModel } from "src/lib/ai-providers/models";
import { getProvider, type Provider } from "src/lib/ai-providers/providers";
import { getFallbackModels } from "src/lib/ai-providers/fallback";
import { resolveKey } from "src/lib/ai-providers/keys";
import { sanitizeMessage } from "src/lib/ai-providers/sanitize";

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
    // Check for 429 to try fallback
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/api/tools/ai-gateway.ts && git commit -m "feat: add unified AI gateway with multi-provider fallback and BYOK support"
```

---

### Task 8: Update generate-profile to use new provider system

**Files:**
- Modify: `src/pages/api/tools/generate-profile.ts`

- [ ] **Step 1: Update the imports and provider creation**

Replace the entire file contents:

```ts
// src/pages/api/tools/generate-profile.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildProfilePrompt } from "src/lib/ai-providers/profile-prompt";
import { sanitizeOneLiner, sanitizeProfile } from "src/lib/ai-providers/sanitize";
import { DEFAULT_PROFILE_MODEL, getModelById } from "src/lib/ai-providers/models";
import { getProvider } from "src/lib/ai-providers/providers";
import { resolveKey } from "src/lib/ai-providers/keys";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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

  const model = getModelById(DEFAULT_PROFILE_MODEL);
  if (!model) {
    return res.status(500).json({ error: "Default profile model not found" });
  }

  const provider = getProvider(model.providerId);
  if (!provider) {
    return res.status(500).json({ error: "Provider not found" });
  }

  const apiKey = resolveKey(model.providerId);
  if (!apiKey) {
    return res.status(503).json({ error: `No API key for ${provider.name}` });
  }

  const client =
    provider.id === "openrouter"
      ? createOpenRouter({ apiKey })
      : createOpenAICompatible({ name: provider.id, baseURL: provider.baseUrl, apiKey });

  try {
    const { text } = await generateText({
      model: client(model.providerModelId),
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/api/tools/generate-profile.ts && git commit -m "refactor: update generate-profile to use new ai-providers registry"
```

---

### Task 9: Update Chat Sandbox page

**Files:**
- Modify: `src/pages/tools/chat.tsx`

This task updates imports, the model dropdown to use optgroups, the streaming function to call the gateway, and adds a BYOK keys panel.

- [ ] **Step 1: Rewrite chat.tsx with all changes**

Replace the entire file with the updated version. Key changes:
- Import from `src/lib/ai-providers/models` and `src/lib/ai-providers/colors`
- `streamCharacterResponse` calls `/api/tools/ai-gateway` instead of `/api/tools/chat`
- Sends `X-Provider-Key` header when BYOK key is available for the model's provider
- Model dropdown uses `<optgroup>` by provider
- BYOK panel in header (collapsible)
- Provider badge under model name in character strip

```ts
// src/pages/tools/chat.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  AI_MODELS,
  getModelById,
  getModelsGroupedByProvider,
} from "src/lib/ai-providers/models";
import { assignColor, assignEmoji } from "src/lib/ai-providers/colors";

/* ── Types ── */
type Character = {
  id: string;
  name: string;
  one_liner: string;
  profile: string;
  model: string;
  color: string;
  avatar_emoji: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  characterId?: string;
  characterName?: string;
  characterColor?: string;
  characterEmoji?: string;
  content: string;
  timestamp: number;
};

type StoredKeys = {
  openrouter?: string;
  groq?: string;
  cerebras?: string;
};

/* ── BYOK helpers ── */
function loadStoredKeys(): StoredKeys {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("ai-provider-keys") || "{}");
  } catch {
    return {};
  }
}

function saveStoredKeys(keys: StoredKeys) {
  localStorage.setItem("ai-provider-keys", JSON.stringify(keys));
}

/* ── API helpers ── */
async function fetchCharacters(): Promise<Character[]> {
  const res = await fetch("/api/tools/characters");
  if (!res.ok) throw new Error("Failed to fetch characters");
  return res.json();
}

async function createCharacterInDb(data: {
  name: string;
  one_liner: string;
  profile: string;
  model: string;
  color: string;
  avatar_emoji: string;
}): Promise<Character> {
  const res = await fetch("/api/tools/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create character");
  return res.json();
}

async function deleteCharacterFromDb(id: string): Promise<void> {
  await fetch(`/api/tools/characters?id=${id}`, { method: "DELETE" });
}

async function generateProfile(
  name: string,
  oneLiner: string
): Promise<string> {
  const res = await fetch("/api/tools/generate-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, oneLiner }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate profile");
  }
  const data = await res.json();
  return data.profile;
}

async function streamCharacterResponse(
  modelId: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  byokKeys?: StoredKeys
): Promise<void> {
  const model = getModelById(modelId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (model && byokKeys) {
    const providerKey =
      byokKeys[model.providerId as keyof StoredKeys];
    if (providerKey) {
      headers["X-Provider-Key"] = providerKey;
    }
  }

  const res = await fetch("/api/tools/ai-gateway", {
    method: "POST",
    headers,
    body: JSON.stringify({ modelId, systemPrompt, messages }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chat request failed");
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/* ── Unique ID generator ── */
let _msgId = 0;
function msgId(): string {
  return `msg-${Date.now()}-${++_msgId}`;
}

/* ── BYOK Keys Panel ── */
function BYOKPanel({
  keys,
  onUpdate,
}: {
  keys: StoredKeys;
  onUpdate: (keys: StoredKeys) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<StoredKeys>(keys);

  const providers = [
    { id: "openrouter" as const, name: "OpenRouter" },
    { id: "groq" as const, name: "Groq" },
    { id: "cerebras" as const, name: "Cerebras" },
  ];

  const handleSave = () => {
    saveStoredKeys(local);
    onUpdate(local);
  };

  const handleClear = (id: keyof StoredKeys) => {
    const next = { ...local };
    delete next[id];
    setLocal(next);
    saveStoredKeys(next);
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] border border-[#C5E7EA]/20 hover:bg-[#415557]/30 transition-colors"
      >
        API Keys
        {Object.values(keys).some(Boolean) && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#C5E7EA]/20 bg-[#1c2426] p-4 shadow-2xl z-50">
          <p className="text-xs text-[#DADBD9]/50 mb-3">
            Keys are stored in your browser only and sent directly to the
            provider.
          </p>
          {providers.map((p) => (
            <label key={p.id} className="block mb-2">
              <span className="text-xs text-[#DADBD9]/70 flex items-center gap-1.5">
                {p.name}
                {local[p.id] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </span>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="password"
                  value={local[p.id] || ""}
                  onChange={(e) =>
                    setLocal({ ...local, [p.id]: e.target.value })
                  }
                  placeholder={`${p.id} key`}
                  className="flex-1 rounded-md border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-1 text-xs text-[#DADBD9] placeholder-[#DADBD9]/30 focus:outline-none"
                />
                {local[p.id] && (
                  <button
                    onClick={() => handleClear(p.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
          ))}
          <button
            onClick={handleSave}
            className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Add Character Modal ── */
function AddCharacterModal({
  onClose,
  onCreated,
  existingColors,
  existingEmojis,
}: {
  onClose: () => void;
  onCreated: (c: Character) => void;
  existingColors: string[];
  existingEmojis: string[];
}) {
  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [modelId, setModelId] = useState(AI_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const modelGroups = getModelsGroupedByProvider();

  const handleCreate = async () => {
    if (!name.trim()) return setError("Give your character a name");
    if (!oneLiner.trim())
      return setError("Describe their personality in a sentence");
    setLoading(true);
    setError("");
    try {
      const profile = await generateProfile(name.trim(), oneLiner.trim());
      const color = assignColor(existingColors);
      const avatar_emoji = assignEmoji(existingEmojis);
      const character = await createCharacterInDb({
        name: name.trim(),
        one_liner: oneLiner.trim(),
        profile,
        model: modelId,
        color,
        avatar_emoji,
      });
      onCreated(character);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[#C5E7EA]/20 bg-[#1c2426] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#DADBD9] mb-4">
          New Character
        </h2>

        <label className="block mb-3">
          <span className="text-sm text-[#DADBD9]/70">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Captain Blackbeard"
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm text-[#DADBD9]/70">
            Personality (one-liner)
          </span>
          <input
            type="text"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="Sarcastic pirate who philosophizes about the sea"
            maxLength={280}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-[#DADBD9]/70">Model</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] focus:border-[#C5E7EA]/50 focus:outline-none"
          >
            {modelGroups.map((group) => (
              <optgroup key={group.providerId} label={group.providerName}>
                {group.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors disabled:opacity-50"
          >
            {loading ? "Generating profile..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page Component ── */
export default function ChatSandbox() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sendTo, setSendTo] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [streamingCharId, setStreamingCharId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [byokKeys, setByokKeys] = useState<StoredKeys>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchCharacters()
      .then(setCharacters)
      .catch(console.error)
      .finally(() => setLoading(false));
    setByokKeys(loadStoredKeys());
  }, []);

  const handleCharacterCreated = (c: Character) => {
    setCharacters((prev) => [c, ...prev]);
    setShowModal(false);
  };

  const handleDeleteCharacter = async (id: string) => {
    await deleteCharacterFromDb(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setMessages((prev) => prev.filter((m) => m.characterId !== id));
    if (sendTo === id) setSendTo("all");
  };

  const buildContext = (
    characterId: string
  ): { role: "user" | "assistant"; content: string }[] => {
    return messages.map((m) => {
      if (m.role === "user") {
        return { role: "user" as const, content: m.content };
      }
      if (m.characterId !== characterId) {
        return {
          role: "user" as const,
          content: `[${m.characterName}]: ${m.content}`,
        };
      }
      return { role: "assistant" as const, content: m.content };
    });
  };

  const sendToCharacter = async (character: Character, userMsg?: string) => {
    setStreamingCharId(character.id);
    const placeholder: ChatMessage = {
      id: msgId(),
      role: "assistant",
      characterId: character.id,
      characterName: character.name,
      characterColor: character.color,
      characterEmoji: character.avatar_emoji,
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, placeholder]);

    const context = buildContext(character.id);
    if (userMsg) {
      context.push({ role: "user", content: userMsg });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamCharacterResponse(
        character.model,
        character.profile,
        context,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        },
        controller.signal,
        byokKeys
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholder.id
            ? { ...m, content: m.content || "[Error: response failed]" }
            : m
        )
      );
    } finally {
      setStreamingCharId(null);
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || characters.length === 0) return;
    setInput("");

    const userMessage: ChatMessage = {
      id: msgId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (sendTo === "all") {
      for (const char of characters) {
        await sendToCharacter(char, text);
      }
    } else {
      const char = characters.find((c) => c.id === sendTo);
      if (char) await sendToCharacter(char, text);
    }
  };

  const handleNextRound = async (targetId?: string) => {
    if (targetId) {
      const char = characters.find((c) => c.id === targetId);
      if (char) await sendToCharacter(char);
    } else {
      for (const char of characters) {
        await sendToCharacter(char);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModelDisplayInfo = (modelIdStr: string) => {
    const model = getModelById(modelIdStr);
    if (model) {
      const providerNames: Record<string, string> = {
        openrouter: "OpenRouter",
        groq: "Groq",
        cerebras: "Cerebras",
      };
      return {
        name: model.displayName,
        provider: providerNames[model.providerId] || model.providerId,
      };
    }
    return { name: modelIdStr, provider: "" };
  };

  return (
    <main className="min-h-screen terrain-page-bg font-sans flex flex-col">
      <Head>
        <title>Chat Sandbox | Brooks Roley</title>
      </Head>

      {/* Header */}
      <header className="border-b border-[#C5E7EA]/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[#DADBD9]/50 hover:text-[#DADBD9] text-sm transition-colors"
          >
            &larr; Home
          </Link>
          <h1 className="text-lg font-semibold text-[#DADBD9]">
            Chat Sandbox
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <BYOKPanel keys={byokKeys} onUpdate={setByokKeys} />
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
          >
            + Add Character
          </button>
        </div>
      </header>

      {/* Character Strip */}
      {characters.length > 0 && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 flex gap-3 overflow-x-auto">
          {characters.map((c) => {
            const info = getModelDisplayInfo(c.model);
            return (
              <div
                key={c.id}
                className="flex-none flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[#415557]/30 transition-colors"
                style={{ borderColor: c.color + "40" }}
                onClick={() =>
                  setExpandedProfile(expandedProfile === c.id ? null : c.id)
                }
              >
                <span className="text-lg">{c.avatar_emoji}</span>
                <div>
                  <div className="font-medium text-[#DADBD9]">{c.name}</div>
                  <div className="text-xs text-[#DADBD9]/50">
                    {info.name}
                  </div>
                  {info.provider && (
                    <div className="text-[10px] text-[#DADBD9]/35">
                      via {info.provider}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCharacter(c.id);
                  }}
                  className="ml-2 text-[#DADBD9]/30 hover:text-red-400 transition-colors"
                  title="Remove character"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Profile View */}
      {expandedProfile && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 bg-[#415557]/10">
          <pre className="text-sm text-[#DADBD9]/80 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
            {characters.find((c) => c.id === expandedProfile)?.profile}
          </pre>
        </div>
      )}

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <p className="text-[#DADBD9]/40 text-sm text-center py-8">
            Loading characters...
          </p>
        )}
        {!loading && characters.length === 0 && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#DADBD9]/50 text-sm mb-2">
              No characters yet.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#C5E7EA] text-sm hover:underline"
            >
              Create your first character
            </button>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-[#C5E7EA]/15 text-[#DADBD9]"
                  : "border bg-[#415557]/20 text-[#DADBD9]"
              }`}
              style={
                m.role === "assistant"
                  ? { borderColor: (m.characterColor || "#666") + "40" }
                  : undefined
              }
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{m.characterEmoji}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: m.characterColor }}
                  >
                    {m.characterName}
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{m.content || "..."}</div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      {characters.length > 0 && (
        <div className="border-t border-[#C5E7EA]/10 px-4 py-3">
          <div className="flex gap-2 items-end">
            <select
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              className="rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-2 text-sm text-[#DADBD9] focus:outline-none"
            >
              <option value="all">All Characters</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.avatar_emoji} {c.name}
                </option>
              ))}
            </select>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-sm text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
              disabled={!!streamingCharId}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !!streamingCharId}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => handleNextRound()}
              disabled={!!streamingCharId || messages.length === 0}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-[#C5E7EA]/20 text-[#DADBD9]/70 hover:text-[#DADBD9] hover:bg-[#415557]/30 transition-colors disabled:opacity-50"
              title="All characters respond to the conversation"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AddCharacterModal
          onClose={() => setShowModal(false)}
          onCreated={handleCharacterCreated}
          existingColors={characters.map((c) => c.color)}
          existingEmojis={characters.map((c) => c.avatar_emoji)}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/tools/chat.tsx && git commit -m "feat: upgrade chat sandbox with multi-provider model dropdown and BYOK panel"
```

---

### Task 10: Delete old routes

**Files:**
- Delete: `src/pages/api/tools/chat.ts`
- Delete: `src/pages/api/tools/setup-characters.ts`

- [ ] **Step 1: Remove old files**

```bash
cd /Users/brooks/Desktop/zero-next && rm src/pages/api/tools/chat.ts src/pages/api/tools/setup-characters.ts
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add -A src/pages/api/tools/chat.ts src/pages/api/tools/setup-characters.ts && git commit -m "cleanup: remove old chat route and setup-characters migration"
```

---

### Task 11: Create Model Arena page

**Files:**
- Create: `src/pages/tools/model-arena.tsx`

- [ ] **Step 1: Create the Model Arena page**

```tsx
// src/pages/tools/model-arena.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  AI_MODELS,
  getModelById,
  getModelsGroupedByProvider,
  type AIModel,
} from "src/lib/ai-providers/models";

/* ── Types ── */
type StoredKeys = {
  openrouter?: string;
  groq?: string;
  cerebras?: string;
};

type StreamColumn = {
  modelId: string;
  content: string;
  ttft: number | null; // ms to first token
  totalTime: number | null; // ms total
  tokenEstimate: number;
  status: "idle" | "streaming" | "done" | "error";
  error?: string;
};

type BattleRecord = {
  modelA: string;
  modelB: string;
  winner: "a" | "b" | "tie";
  prompt: string;
  timestamp: number;
};

/* ── BYOK helpers (shared with chat) ── */
function loadStoredKeys(): StoredKeys {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("ai-provider-keys") || "{}");
  } catch {
    return {};
  }
}

function saveStoredKeys(keys: StoredKeys) {
  localStorage.setItem("ai-provider-keys", JSON.stringify(keys));
}

function loadBattleHistory(): BattleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("arena-battles") || "[]");
  } catch {
    return [];
  }
}

function saveBattleHistory(records: BattleRecord[]) {
  localStorage.setItem("arena-battles", JSON.stringify(records));
}

/* ── BYOK Panel (identical to chat) ── */
function BYOKPanel({
  keys,
  onUpdate,
}: {
  keys: StoredKeys;
  onUpdate: (keys: StoredKeys) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<StoredKeys>(keys);

  const providers = [
    { id: "openrouter" as const, name: "OpenRouter" },
    { id: "groq" as const, name: "Groq" },
    { id: "cerebras" as const, name: "Cerebras" },
  ];

  const handleSave = () => {
    saveStoredKeys(local);
    onUpdate(local);
  };

  const handleClear = (id: keyof StoredKeys) => {
    const next = { ...local };
    delete next[id];
    setLocal(next);
    saveStoredKeys(next);
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] border border-[#C5E7EA]/20 hover:bg-[#415557]/30 transition-colors"
      >
        API Keys
        {Object.values(keys).some(Boolean) && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#C5E7EA]/20 bg-[#1c2426] p-4 shadow-2xl z-50">
          <p className="text-xs text-[#DADBD9]/50 mb-3">
            Keys are stored in your browser only and sent directly to the
            provider.
          </p>
          {providers.map((p) => (
            <label key={p.id} className="block mb-2">
              <span className="text-xs text-[#DADBD9]/70 flex items-center gap-1.5">
                {p.name}
                {local[p.id] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </span>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="password"
                  value={local[p.id] || ""}
                  onChange={(e) =>
                    setLocal({ ...local, [p.id]: e.target.value })
                  }
                  placeholder={`${p.id} key`}
                  className="flex-1 rounded-md border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-1 text-xs text-[#DADBD9] placeholder-[#DADBD9]/30 focus:outline-none"
                />
                {local[p.id] && (
                  <button
                    onClick={() => handleClear(p.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
          ))}
          <button
            onClick={handleSave}
            className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Model Selector ── */
function ModelSelector({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const groups = getModelsGroupedByProvider();
  return (
    <label className="block">
      {label && (
        <span className="text-xs text-[#DADBD9]/50 mb-1 block">{label}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-1.5 text-sm text-[#DADBD9] focus:outline-none"
      >
        {groups.map((g) => (
          <optgroup key={g.providerId} label={g.providerName}>
            {g.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/* ── Streaming Column Display ── */
function StreamingColumn({ col }: { col: StreamColumn }) {
  const model = getModelById(col.modelId);
  const providerNames: Record<string, string> = {
    openrouter: "OpenRouter",
    groq: "Groq",
    cerebras: "Cerebras",
  };

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[#C5E7EA]/15 bg-[#415557]/10 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-[#DADBD9]">
            {model?.displayName || col.modelId}
          </div>
          {model && (
            <div className="text-[10px] text-[#DADBD9]/40">
              via {providerNames[model.providerId] || model.providerId}
            </div>
          )}
        </div>
        {col.status === "streaming" && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </div>

      <div className="flex-1 text-sm text-[#DADBD9]/80 whitespace-pre-wrap overflow-y-auto max-h-96 min-h-[120px]">
        {col.content || (col.status === "idle" ? "" : "...")}
        {col.error && (
          <span className="text-red-400 text-xs block mt-2">{col.error}</span>
        )}
      </div>

      {(col.ttft !== null || col.totalTime !== null) && (
        <div className="mt-3 pt-2 border-t border-[#C5E7EA]/10 flex gap-4 text-[10px] text-[#DADBD9]/40">
          {col.ttft !== null && <span>TTFT: {col.ttft}ms</span>}
          {col.totalTime !== null && <span>Total: {col.totalTime}ms</span>}
          {col.tokenEstimate > 0 && <span>~{col.tokenEstimate} tokens</span>}
        </div>
      )}
    </div>
  );
}

/* ── Leaderboard ── */
function Leaderboard({ battles }: { battles: BattleRecord[] }) {
  const [open, setOpen] = useState(false);
  if (battles.length === 0) return null;

  const stats = new Map<string, { wins: number; losses: number; ties: number }>();
  for (const b of battles) {
    for (const id of [b.modelA, b.modelB]) {
      if (!stats.has(id)) stats.set(id, { wins: 0, losses: 0, ties: 0 });
    }
    if (b.winner === "tie") {
      stats.get(b.modelA)!.ties++;
      stats.get(b.modelB)!.ties++;
    } else {
      const winnerId = b.winner === "a" ? b.modelA : b.modelB;
      const loserId = b.winner === "a" ? b.modelB : b.modelA;
      stats.get(winnerId)!.wins++;
      stats.get(loserId)!.losses++;
    }
  }

  const sorted = Array.from(stats.entries())
    .map(([id, s]) => ({
      id,
      ...s,
      total: s.wins + s.losses + s.ties,
      winRate: s.wins / (s.wins + s.losses + s.ties),
    }))
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="border-t border-[#C5E7EA]/10 mt-4 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-[#DADBD9]/50 hover:text-[#DADBD9]/70 transition-colors"
      >
        {open ? "Hide" : "Show"} Leaderboard ({battles.length} battles)
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {sorted.map((s) => {
            const model = getModelById(s.id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between text-xs text-[#DADBD9]/60 py-1"
              >
                <span className="truncate mr-2">
                  {model?.displayName || s.id}
                </span>
                <span className="flex-none">
                  {Math.round(s.winRate * 100)}% ({s.wins}W-{s.losses}L-
                  {s.ties}T)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function ModelArena() {
  const [mode, setMode] = useState<"compare" | "battle">("compare");
  const [prompt, setPrompt] = useState("");
  const [byokKeys, setByokKeys] = useState<StoredKeys>({});
  const [battles, setBattles] = useState<BattleRecord[]>([]);

  // Compare mode state
  const [modelA, setModelA] = useState(AI_MODELS[0].id);
  const [modelB, setModelB] = useState(
    AI_MODELS.length > 1 ? AI_MODELS[1].id : AI_MODELS[0].id
  );

  // Columns state
  const [columns, setColumns] = useState<StreamColumn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Battle mode state
  const [battleRevealed, setBattleRevealed] = useState(false);
  const [battleModelA, setBattleModelA] = useState("");
  const [battleModelB, setBattleModelB] = useState("");

  useEffect(() => {
    setByokKeys(loadStoredKeys());
    setBattles(loadBattleHistory());
  }, []);

  const streamToColumn = useCallback(
    async (
      modelId: string,
      promptText: string,
      colIndex: number,
      signal: AbortSignal,
      keys: StoredKeys
    ) => {
      const model = getModelById(modelId);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (model && keys) {
        const pk = keys[model.providerId as keyof StoredKeys];
        if (pk) headers["X-Provider-Key"] = pk;
      }

      const start = performance.now();
      let firstTokenTime: number | null = null;

      try {
        const res = await fetch("/api/tools/ai-gateway", {
          method: "POST",
          headers,
          body: JSON.stringify({
            modelId,
            messages: [{ role: "user", content: promptText }],
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json();
          setColumns((prev) => {
            const next = [...prev];
            next[colIndex] = {
              ...next[colIndex],
              status: "error",
              error: err.error || "Request failed",
            };
            return next;
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          if (firstTokenTime === null) {
            firstTokenTime = Math.round(performance.now() - start);
          }

          setColumns((prev) => {
            const next = [...prev];
            const col = next[colIndex];
            const newContent = col.content + chunk;
            next[colIndex] = {
              ...col,
              content: newContent,
              ttft: firstTokenTime,
              tokenEstimate: Math.round(newContent.split(/\s+/).length / 0.75),
              status: "streaming",
            };
            return next;
          });
        }

        const totalTime = Math.round(performance.now() - start);
        setColumns((prev) => {
          const next = [...prev];
          next[colIndex] = { ...next[colIndex], totalTime, status: "done" };
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setColumns((prev) => {
          const next = [...prev];
          next[colIndex] = {
            ...next[colIndex],
            status: "error",
            error: "Stream failed",
          };
          return next;
        });
      }
    },
    []
  );

  const handleCompare = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const initCols: StreamColumn[] = [
      { modelId: modelA, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
      { modelId: modelB, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
    ];
    setColumns(initCols);

    await Promise.all([
      streamToColumn(modelA, prompt.trim(), 0, controller.signal, byokKeys),
      streamToColumn(modelB, prompt.trim(), 1, controller.signal, byokKeys),
    ]);

    setIsRunning(false);
    abortRef.current = null;
  };

  const pickRandomModels = (): [string, string] => {
    const providers = ["openrouter", "groq", "cerebras"];
    // Try to pick from different providers
    const shuffled = [...AI_MODELS].sort(() => Math.random() - 0.5);
    const first = shuffled[0];
    const second =
      shuffled.find((m) => m.providerId !== first.providerId) || shuffled[1];
    return [first.id, second.id];
  };

  const handleBattle = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    setBattleRevealed(false);
    const controller = new AbortController();
    abortRef.current = controller;

    const [a, b] = pickRandomModels();
    setBattleModelA(a);
    setBattleModelB(b);

    const initCols: StreamColumn[] = [
      { modelId: a, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
      { modelId: b, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
    ];
    setColumns(initCols);

    await Promise.all([
      streamToColumn(a, prompt.trim(), 0, controller.signal, byokKeys),
      streamToColumn(b, prompt.trim(), 1, controller.signal, byokKeys),
    ]);

    setIsRunning(false);
    abortRef.current = null;
  };

  const handleVote = (winner: "a" | "b" | "tie") => {
    setBattleRevealed(true);
    const record: BattleRecord = {
      modelA: battleModelA,
      modelB: battleModelB,
      winner,
      prompt: prompt.trim(),
      timestamp: Date.now(),
    };
    const updated = [record, ...battles];
    setBattles(updated);
    saveBattleHistory(updated);
  };

  const handleSend = () => {
    if (mode === "compare") handleCompare();
    else handleBattle();
  };

  const handleClear = () => {
    setColumns([]);
    setBattleRevealed(false);
    abortRef.current?.abort();
    setIsRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bothDone = columns.length === 2 && columns.every((c) => c.status === "done" || c.status === "error");

  return (
    <main className="min-h-screen terrain-page-bg font-sans flex flex-col">
      <Head>
        <title>Model Arena | Brooks Roley</title>
      </Head>

      {/* Header */}
      <header className="border-b border-[#C5E7EA]/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[#DADBD9]/50 hover:text-[#DADBD9] text-sm transition-colors"
          >
            &larr; Home
          </Link>
          <h1 className="text-lg font-semibold text-[#DADBD9]">
            Model Arena
          </h1>
        </div>
        <BYOKPanel keys={byokKeys} onUpdate={setByokKeys} />
      </header>

      {/* Mode Tabs */}
      <div className="border-b border-[#C5E7EA]/10 px-4 py-2 flex gap-1">
        {(["compare", "battle"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              handleClear();
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? "bg-[#C5E7EA]/20 text-[#C5E7EA]"
                : "text-[#DADBD9]/50 hover:text-[#DADBD9]"
            }`}
          >
            {m === "compare" ? "Compare" : "Battle"}
          </button>
        ))}
      </div>

      {/* Model Selectors (Compare mode only) */}
      {mode === "compare" && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 grid grid-cols-2 gap-4">
          <ModelSelector value={modelA} onChange={setModelA} label="Model A" />
          <ModelSelector value={modelB} onChange={setModelB} label="Model B" />
        </div>
      )}

      {mode === "battle" && columns.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-[#DADBD9]/50">
            Type a prompt and hit Send. Two random models will compete
            blindly.
          </p>
        </div>
      )}

      {/* Streaming Columns */}
      {columns.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {columns.map((col, i) => {
              if (mode === "battle" && !battleRevealed) {
                // Show blind columns
                return (
                  <StreamingColumn
                    key={i}
                    col={{
                      ...col,
                      modelId: `Model ${i === 0 ? "A" : "B"}` as string,
                    }}
                  />
                );
              }
              return <StreamingColumn key={i} col={col} />;
            })}
          </div>

          {/* Battle voting */}
          {mode === "battle" && bothDone && !battleRevealed && (
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => handleVote("a")}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
              >
                A wins
              </button>
              <button
                onClick={() => handleVote("tie")}
                className="px-6 py-2 rounded-lg text-sm font-medium border border-[#C5E7EA]/20 text-[#DADBD9]/70 hover:text-[#DADBD9] transition-colors"
              >
                Tie
              </button>
              <button
                onClick={() => handleVote("b")}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
              >
                B wins
              </button>
            </div>
          )}

          {/* Battle reveal */}
          {mode === "battle" && battleRevealed && (
            <div className="text-center mt-4 text-sm text-[#DADBD9]/60">
              <p>
                Model A: <strong className="text-[#DADBD9]">{getModelById(battleModelA)?.displayName || battleModelA}</strong>
                {" | "}
                Model B: <strong className="text-[#DADBD9]">{getModelById(battleModelB)?.displayName || battleModelB}</strong>
              </p>
            </div>
          )}

          {/* Re-run / Clear */}
          {bothDone && (
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={handleSend}
                className="px-4 py-1.5 rounded-lg text-xs text-[#DADBD9]/50 hover:text-[#DADBD9] border border-[#C5E7EA]/15 transition-colors"
              >
                Re-run
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-1.5 rounded-lg text-xs text-[#DADBD9]/50 hover:text-[#DADBD9] border border-[#C5E7EA]/15 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Leaderboard */}
          {mode === "battle" && <Leaderboard battles={battles} />}
        </div>
      )}

      {/* Empty state when no columns */}
      {columns.length === 0 && mode === "compare" && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#DADBD9]/40">
            Pick two models, type a prompt, and compare responses.
          </p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-[#C5E7EA]/10 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt to compare models..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-sm text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
            disabled={isRunning}
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isRunning}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/tools/model-arena.tsx && git commit -m "feat: add Model Arena page with side-by-side compare and blind battle modes"
```

---

### Task 12: Add Model Arena card to homepage

**Files:**
- Modify: `src/pages/index.tsx`

- [ ] **Step 1: Add Model Arena card after the Chat Sandbox card**

In `src/pages/index.tsx`, after the Chat Sandbox card's closing `</div>` (around line 135), add a new card. The Featured section should become a 3-column grid on larger screens or we can keep the 2-column grid and just add a 5th card.

Insert after the Chat Sandbox `</div>` (line 135) and before the `</PhysicsField>` (line 136):

```tsx
              <div data-physics-item className="physics-field-item">
                <Reveal delay={500}>
                  <TiltCard>
                    <Link href="/tools/model-arena" className={cardBase}>
                      <div className="aspect-[2.2/1] relative overflow-hidden flex items-center justify-center bg-[#415557]/34">
                        <div className="flex items-center gap-3 text-2xl opacity-60">
                          <span>&#x2694;&#xFE0F;</span><span>&#x1F916;</span><span>&#x1F3C6;</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c2426] via-[#1c2426]/72 to-transparent" />
                      </div>
                      <div className="relative px-5 pb-5 -mt-8">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          Model Arena <ArrowIcon />
                        </h3>
                        <p className="mt-1 text-sm text-[#DADBD9]/68">
                          Compare AI models side by side. Blind battles, speed stats, leaderboard.
                        </p>
                      </div>
                      <div className="tilt-highlight" />
                    </Link>
                  </TiltCard>
                </Reveal>
              </div>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/index.tsx && git commit -m "feat: add Model Arena card to homepage featured section"
```

---

### Task 13: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
cd /Users/brooks/Desktop/zero-next && yarn lint
```

Expected: No errors. Fix any issues found.

- [ ] **Step 2: Run build**

```bash
cd /Users/brooks/Desktop/zero-next && yarn build
```

Expected: Build succeeds. Fix any TypeScript or import errors.

- [ ] **Step 3: Fix any issues found in steps 1-2, commit fixes**

```bash
cd /Users/brooks/Desktop/zero-next && git add -A && git commit -m "fix: resolve lint and build issues"
```

(Skip this step if no issues were found.)

---

### Task 14: Manual testing checklist

- [ ] **Step 1: Start dev server and test**

```bash
cd /Users/brooks/Desktop/zero-next && yarn dev
```

Verify:
1. `/` — Homepage loads, Model Arena card appears alongside Chat Sandbox card
2. `/tools/chat` — Model dropdown shows ~35 models grouped by provider (OpenRouter, Groq, Cerebras). BYOK panel opens/closes. Creating a character works. Streaming responses work via `/api/tools/ai-gateway`.
3. `/tools/model-arena` — Compare mode: pick 2 models, enter prompt, both stream in parallel with TTFT and total time. Battle mode: random models chosen, blind columns shown, vote reveals identities and saves to localStorage leaderboard.
4. API Keys panel saves/clears keys in localStorage, green dot appears when key is set
5. Old routes `/api/tools/chat` and `/api/tools/setup-characters` return 404
