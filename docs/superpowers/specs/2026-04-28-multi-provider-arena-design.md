# Multi-Provider AI Gateway & Model Arena — Design Spec

**Date:** 2026-04-28
**Status:** Draft
**Livelihood stream:** SaaS micro-tools

---

## Goal

Upgrade the chat sandbox from 3 OpenRouter models to ~50 free models across 3 providers (OpenRouter, Groq, Cerebras), and build a new Model Arena page at `/tools/model-arena` with side-by-side comparison and blind battle modes. All AI requests flow through a single gateway API route with auto-fallback on rate limits and optional BYOK (Bring Your Own Key) support.

---

## Architecture Overview

```
                      ┌──────────────┐
                      │   Browser     │
                      │              │
              ┌───────┴───────┐  ┌───┴────────────┐
              │ /tools/chat   │  │ /tools/model-   │
              │ (sandbox)     │  │ arena           │
              └───────┬───────┘  └───┬────────────┘
                      │              │
                      ▼              ▼
              ┌──────────────────────────┐
              │ POST /api/tools/         │
              │ ai-gateway               │
              │                          │
              │ • resolve provider+model │
              │ • resolve key (BYOK/env) │
              │ • sanitize input         │
              │ • stream response        │
              │ • fallback on 429        │
              └──────┬───┬───┬──────────┘
                     │   │   │
            ┌────────┘   │   └────────┐
            ▼            ▼            ▼
       OpenRouter      Groq       Cerebras
       (~30 free)    (15+ free)   (5 free)
```

---

## 1. Multi-Provider Registry (`src/lib/ai-providers/`)

### File Structure

```
src/lib/ai-providers/
  providers.ts       — provider definitions
  models.ts          — full model registry (~50 free models)
  fallback.ts        — cross-provider equivalent lookup + fallback selection
  keys.ts            — API key resolution (BYOK header > server env)
  sanitize.ts        — moved from src/lib/openrouter/sanitize.ts (unchanged)
  colors.ts          — moved from src/lib/openrouter/colors.ts (unchanged)
  profile-prompt.ts  — moved from src/lib/openrouter/profile-prompt.ts (unchanged)
```

### Provider Type

```ts
type Provider = {
  id: "openrouter" | "groq" | "cerebras";
  name: string;
  baseUrl: string;
  envKey: string; // e.g. "GROQ_API_KEY"
  rateLimit: { rpm: number; rpd: number };
};
```

Providers defined:

| id | baseUrl | envKey | Rate Limits |
|---|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | 20 RPM, 200 RPD per model |
| `groq` | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | 30 RPM, 1000 RPD |
| `cerebras` | `https://api.cerebras.ai/v1` | `CEREBRAS_API_KEY` | 30 RPM, 1M TPD |

### Model Type

```ts
type AIModel = {
  id: string;               // unique, e.g. "groq/llama-3.3-70b"
  providerId: string;
  providerModelId: string;  // what provider expects, e.g. "llama-3.3-70b-versatile"
  displayName: string;
  contextLength: number;
  capabilities: ("chat" | "vision" | "code")[];
  free: boolean;
  equivalentIds?: string[]; // cross-provider duplicates for fallback
};
```

### Model Roster (Tier 1 — ~50 models)

**OpenRouter (~30 free models):**
- NVIDIA Nemotron 3 Super (120B, 262K context)
- OpenAI GPT-OSS 120B / 20B
- Meta Llama 3.3 70B / Llama 4 Scout / Llama 4 Maverick
- Qwen3 Coder 480B / Qwen3 235B Thinking
- Google Gemma 4 31B / Gemma 3 27B / 12B / 4B
- Mistral Small 3.1 24B / Devstral 2 123B
- MiniMax M2.5
- Z.AI GLM 4.5 Air
- Arcee AI Trinity Large Preview
- Nous Hermes 3 405B
- inclusionAI Ling-2.6-flash
- Gemma 3n 4B / 2B
- OpenRouter Free Models Router (auto-select)

**Groq (15+ free models):**
- Llama 4 Scout (512K) / Llama 4 Maverick (256K)
- Llama 3.3 70B Versatile / Llama 3.1 8B Instant
- Qwen QwQ-32B
- GPT-OSS 120B / 20B
- DeepSeek R1 Distill 70B
- Mistral Saba 24B
- Gemma 2 9B IT

**Cerebras (5 free models):**
- Qwen3 235B A22B Instruct (64K, ~1400 tok/s)
- GPT-OSS 120B (~3000 tok/s)
- Qwen3 Coder 480B
- Llama 3.1 8B (~1800 tok/s)
- Z.AI GLM-4.7

### Fallback / Cross-Listing Map

Models that exist on multiple providers share `equivalentIds`. When provider A returns 429, the gateway tries provider B for the same model.

Cross-listed models:
- Llama 3.3 70B → OpenRouter, Groq
- Llama 4 Scout → OpenRouter, Groq
- Llama 4 Maverick → OpenRouter, Groq
- GPT-OSS 120B → OpenRouter, Groq, Cerebras
- GPT-OSS 20B → OpenRouter, Groq
- Llama 3.1 8B → Groq, Cerebras
- Qwen3 235B → OpenRouter, Cerebras
- Qwen3 Coder 480B → OpenRouter, Cerebras
- Mistral Small 3.1 → OpenRouter
- GLM 4.5/4.7 → OpenRouter, Cerebras

### Key Resolution (`keys.ts`)

```ts
function resolveKey(providerId: string, byokHeader?: string): string | null
```

1. If `X-Provider-Key` header is present and non-empty, use it
2. Else read `process.env[provider.envKey]`
3. If neither exists, return null (gateway returns 401)

---

## 2. AI Gateway API Route

**Path:** `POST /api/tools/ai-gateway`

### Request

```ts
{
  modelId: string;          // from registry, e.g. "groq/llama-3.3-70b"
  systemPrompt?: string;    // for character chat
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;       // default 2000
  temperature?: number;     // default 0.8
}

Headers:
  X-Provider-Key?: string   // optional BYOK
```

### Response

Streaming text via `pipeTextStreamToResponse`. On error:
- 400: bad request (missing fields, unknown model, sanitization failure)
- 401: no API key available for this provider
- 429: all providers exhausted for this model
- 502: upstream provider error

### Flow

1. Look up `modelId` in registry → get `AIModel` + `Provider`
2. Resolve API key via `keys.ts`
3. Sanitize last user message via `sanitize.ts`
4. Create SDK client using `@ai-sdk/openai-compatible` with provider's `baseUrl` + resolved key
5. Call `streamText()` and pipe to response
6. On 429 error: look up `equivalentIds`, try next provider that has a key
7. On all-providers-exhausted: return 429

### SDK Client Creation

All three providers are OpenAI-compatible. Use `@ai-sdk/openai-compatible`:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function createProviderClient(provider: Provider, apiKey: string) {
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey,
  });
}
```

OpenRouter stays on `@openrouter/ai-sdk-provider` (already installed) since it has specific features. Groq and Cerebras use the generic compatible client.

---

## 3. Chat Sandbox Upgrade

### Changes to `src/pages/tools/chat.tsx`

- **Model dropdown**: Replace flat list with optgroup-by-provider. Shows provider name as group header, models within. ~50 options total.
- **API endpoint**: `streamCharacterResponse` calls `/api/tools/ai-gateway` instead of `/api/tools/chat`
- **Provider badge**: Character strip shows small "via Groq" / "via Cerebras" text under model name
- **BYOK panel**: Collapsible "API Keys" section in the header. Three fields (OpenRouter, Groq, Cerebras). Values saved to localStorage under `ai-provider-keys`. Sent as `X-Provider-Key` header on requests matching that provider.

### Changes to `src/pages/api/tools/generate-profile.ts`

- Use the gateway's provider resolution internally instead of hardcoded `createOpenRouter`
- Default profile model stays the first OpenRouter model (or configurable)

### No Changes

- Character CRUD (`characters.ts`) — unchanged
- `characters` table schema — unchanged (model column stores string IDs)
- Conversation state management — unchanged
- UI layout structure — unchanged

---

## 4. Model Arena Page

**Path:** `/tools/model-arena`

### Layout

```
┌─────────────────────────────────────┐
│ ← Home    Model Arena    [API Keys] │
│─────────────────────────────────────│
│  [Compare]  [Battle]                │
│─────────────────────────────────────│
│                                     │
│   ┌─────────────┐ ┌─────────────┐  │
│   │  Model A     │ │  Model B     │ │
│   │  (streaming) │ │  (streaming) │ │
│   │              │ │              │ │
│   │  1.2s TTFT   │ │  0.3s TTFT   │ │
│   │  847 tokens  │ │  923 tokens  │ │
│   └─────────────┘ └─────────────┘  │
│                                     │
│─────────────────────────────────────│
│ [prompt input]              [Send]  │
└─────────────────────────────────────┘
```

### Mode 1: Side-by-Side Comparison

- User picks 2 or 3 models from dropdown selectors above each column
- Types prompt, hits Send
- Fires parallel requests to `/api/tools/ai-gateway` via `Promise.all`
- Each column streams independently, showing:
  - Model name + provider badge
  - Streaming response text
  - Time-to-first-token (measured client-side: time from fetch to first chunk)
  - Total response time
  - Approximate token count (word count / 0.75)
- "Re-run" button replays same prompt, "Clear" resets

### Mode 2: Blind Battle

- User types prompt, hits Send
- System randomly picks 2 models from the free pool, weighted to prefer different providers
- Responses stream in columns labeled "Model A" / "Model B" — no names
- After both complete, two buttons appear: "A wins" / "B wins" / "Tie"
- On vote: models revealed with names, provider, and speed stats
- Battle history stored in localStorage:
  ```ts
  type BattleRecord = {
    modelA: string;
    modelB: string;
    winner: "a" | "b" | "tie";
    prompt: string;
    timestamp: number;
  };
  ```
- Running leaderboard shown in a collapsible sidebar: model win rates from local battles

### Shared Components

- BYOK key panel — same component as chat sandbox, shared localStorage
- Model selector dropdown — shared component from `src/lib/ai-providers/`
- Streaming display column — reusable component with TTFT/speed metrics

---

## 5. BYOK (Bring Your Own Key) UX

### Storage

localStorage key: `ai-provider-keys`

```ts
type StoredKeys = {
  openrouter?: string;
  groq?: string;
  cerebras?: string;
};
```

### UI

Collapsible panel accessible from both chat sandbox and model arena headers. Shows:
- One input per provider with obscured display (type="password")
- "Save" persists to localStorage
- "Clear" removes a key
- Green dot indicator next to provider name when key is saved
- Disclaimer: "Keys are stored in your browser only and sent directly to the provider. We never log or store them."

### Request Flow

When a BYOK key exists for the target provider, the client sends it in the `X-Provider-Key` request header. The gateway uses it instead of the server env var. If the BYOK key is invalid (401 from upstream), the error surfaces to the user — no fallback to server key (that would leak the user's intent to use their own key).

---

## 6. Cleanup & Migration

### Delete
- `src/pages/api/tools/setup-characters.ts` — one-time migration, table exists
- `src/pages/api/tools/chat.ts` — replaced by ai-gateway

### Move (content unchanged, new paths)
- `src/lib/openrouter/sanitize.ts` → `src/lib/ai-providers/sanitize.ts`
- `src/lib/openrouter/colors.ts` → `src/lib/ai-providers/colors.ts`
- `src/lib/openrouter/profile-prompt.ts` → `src/lib/ai-providers/profile-prompt.ts`

### Replace
- `src/lib/openrouter/models.ts` → replaced by `src/lib/ai-providers/models.ts` (new registry)

### Delete after move
- `src/lib/openrouter/` directory (empty after moves)

### Update Imports
- `src/pages/tools/chat.tsx` — import from `src/lib/ai-providers/`
- `src/pages/api/tools/generate-profile.ts` — use new provider resolution
- `src/pages/api/tools/characters.ts` — no changes needed

### New Dependencies
- `@ai-sdk/openai-compatible` — generic OpenAI-compatible provider for Groq + Cerebras

### New Env Vars
- `GROQ_API_KEY` — free at groq.com, no credit card
- `CEREBRAS_API_KEY` — free at cerebras.ai, no credit card
- `OPENROUTER_API_KEY` — already exists

### Homepage
- Add Model Arena card to `src/pages/index.tsx` alongside existing Chat Sandbox card

### No Database Changes
- `characters` table unchanged
- Arena battle tallies are localStorage only

---

## Non-Goals (explicitly deferred)

- Tier 2 providers (Mistral, Google Gemini) — add later when Tier 1 is stable
- Server-side battle leaderboard / database persistence — localStorage first
- Paid model support via BYOK — free models only for now
- Chat history persistence — conversations remain ephemeral React state
- Model speed benchmarking database — client-side timing only
