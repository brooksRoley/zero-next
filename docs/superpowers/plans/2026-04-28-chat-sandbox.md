# Chat Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-character AI chat sandbox at `/tools/chat` where users create characters backed by free OpenRouter models, each with a generated Enigmatic Writer persona profile, and interact via direct messages, broadcasts, or directed rounds.

**Architecture:** Pages Router page + three API routes (chat streaming, character CRUD, profile generation) + Neon Postgres `characters` table + `@openrouter/ai-sdk-provider` for streaming. Conversation state is ephemeral React state; only characters persist.

**Tech Stack:** `ai` (AI SDK), `@openrouter/ai-sdk-provider`, Neon Postgres via `src/lib/db.ts`, Next.js Pages Router, TypeScript, Tailwind CSS.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/openrouter/models.ts` | Free model registry — display names, model IDs, context lengths |
| `src/lib/openrouter/sanitize.ts` | Prompt injection sanitizer for inputs, profiles, and chat messages |
| `src/lib/openrouter/profile-prompt.ts` | Meta-prompt template for generating Enigmatic Writer profiles |
| `src/lib/openrouter/colors.ts` | Character color + emoji auto-assignment |
| `src/pages/api/tools/characters.ts` | GET/POST/DELETE for character CRUD |
| `src/pages/api/tools/generate-profile.ts` | POST: generates Enigmatic Writer profile from one-liner |
| `src/pages/api/tools/chat.ts` | POST: streams a chat response for a single character |
| `src/pages/tools/chat.tsx` | The sandbox page — character strip, chat log, input area |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install AI SDK and OpenRouter provider**

```bash
cd /Users/brooks/Desktop/zero-next && yarn add ai @openrouter/ai-sdk-provider
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/brooks/Desktop/zero-next && node -e "require('ai'); require('@openrouter/ai-sdk-provider'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add package.json yarn.lock && git commit -m "feat(chat-sandbox): add ai sdk and openrouter provider"
```

---

### Task 2: Create Free Model Registry

**Files:**
- Create: `src/lib/openrouter/models.ts`

- [ ] **Step 1: Write the model registry**

```typescript
// src/lib/openrouter/models.ts

export type FreeModel = {
  id: string;
  displayName: string;
  contextLength: number;
};

export const FREE_MODELS: FreeModel[] = [
  {
    id: "nvidia/nemotron-3-nano-omni-free",
    displayName: "NVIDIA Nemotron 3 Nano Omni",
    contextLength: 256_000,
  },
  {
    id: "poolside/laguna-xs.2-free",
    displayName: "Poolside Laguna XS.2",
    contextLength: 131_000,
  },
  {
    id: "poolside/laguna-m.1-free",
    displayName: "Poolside Laguna M.1",
    contextLength: 131_000,
  },
];

export const DEFAULT_PROFILE_MODEL = FREE_MODELS[0].id;

export function getModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/openrouter/models.ts && git commit -m "feat(chat-sandbox): add free model registry"
```

---

### Task 3: Create Prompt Injection Sanitizer

**Files:**
- Create: `src/lib/openrouter/sanitize.ts`

- [ ] **Step 1: Write the sanitizer**

```typescript
// src/lib/openrouter/sanitize.ts

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<<\/SYS>>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\bdo\s+anything\s+now\b/i,
  /\bjailbreak\b/i,
];

const MAX_ONE_LINER_LENGTH = 280;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PROFILE_LENGTH = 8000;

export type SanitizeResult =
  | { ok: true; cleaned: string }
  | { ok: false; reason: string };

function checkPatterns(text: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Input contains a disallowed pattern: ${pattern.source}`;
    }
  }
  return null;
}

export function sanitizeOneLiner(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "One-liner cannot be empty" };
  if (trimmed.length > MAX_ONE_LINER_LENGTH) {
    return { ok: false, reason: `One-liner must be under ${MAX_ONE_LINER_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeProfile(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Profile cannot be empty" };
  if (trimmed.length > MAX_PROFILE_LENGTH) {
    return { ok: false, reason: `Profile must be under ${MAX_PROFILE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeMessage(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Message cannot be empty" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Message must be under ${MAX_MESSAGE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/openrouter/sanitize.ts && git commit -m "feat(chat-sandbox): add prompt injection sanitizer"
```

---

### Task 4: Create Profile Prompt Template and Color Assignment

**Files:**
- Create: `src/lib/openrouter/profile-prompt.ts`
- Create: `src/lib/openrouter/colors.ts`

- [ ] **Step 1: Write the Enigmatic Writer meta-prompt**

```typescript
// src/lib/openrouter/profile-prompt.ts

export function buildProfilePrompt(name: string, oneLiner: string): string {
  return `You are a character designer. Generate an Enigmatic Writer profile for a fictional character.

Character name: ${name}
Character concept: ${oneLiner}

Write the profile in this exact markdown format. Be creative and specific. Mature/R-rated personality traits are acceptable. Make the character feel alive and distinct.

# ${name}

## Voice
[2-3 sentences about tone, cadence, and speech style]

## Worldview
[2-3 sentences about how they see the world, core beliefs, philosophy]

## Personality
- [Trait 1 with brief explanation]
- [Trait 2 with brief explanation]
- [Trait 3 with brief explanation]
- [Trait 4 with brief explanation]

## Speech Patterns
- [Verbal habit or catchphrase]
- [Sentence structure preference]
- [How they address others]

## Boundaries
- Never breaks character
- [One thing they refuse to do]
- [One topic they avoid]

Write ONLY the markdown profile. No preamble, no explanation.`;
}
```

- [ ] **Step 2: Write the color and emoji assignment module**

```typescript
// src/lib/openrouter/colors.ts

const COLORS = [
  "#E57373", // red
  "#64B5F6", // blue
  "#81C784", // green
  "#FFB74D", // orange
  "#BA68C8", // purple
  "#4DD0E1", // cyan
  "#F06292", // pink
  "#AED581", // lime
  "#FFD54F", // amber
  "#7986CB", // indigo
];

const EMOJIS = [
  "🎭", "🐉", "🦊", "👻", "🤖", "🧙", "🎪", "🦉", "🐺", "🌙",
  "🔮", "⚡", "🎸", "🗡️", "🌊", "🦁", "🐙", "🎩", "💀", "🌺",
];

export function assignColor(existingColors: string[]): string {
  const available = COLORS.filter((c) => !existingColors.includes(c));
  if (available.length > 0) return available[0];
  return COLORS[existingColors.length % COLORS.length];
}

export function assignEmoji(existingEmojis: string[]): string {
  const available = EMOJIS.filter((e) => !existingEmojis.includes(e));
  if (available.length > 0) return available[0];
  return EMOJIS[existingEmojis.length % EMOJIS.length];
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/lib/openrouter/profile-prompt.ts src/lib/openrouter/colors.ts && git commit -m "feat(chat-sandbox): add enigmatic writer prompt and color assignment"
```

---

### Task 5: Create `characters` Table in Neon

**Files:**
- Modify: `src/pages/api/tools/characters.ts` (created in Task 6, but migration runs first)

- [ ] **Step 1: Create the migration API route to bootstrap the table**

Create a temporary setup route that creates the table. We'll delete it after running it once.

```typescript
// src/pages/api/tools/setup-characters.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await sql`
    CREATE TABLE IF NOT EXISTS characters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      one_liner VARCHAR(280) NOT NULL,
      profile TEXT NOT NULL,
      model VARCHAR(200) NOT NULL,
      color VARCHAR(7) NOT NULL,
      avatar_emoji VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  res.status(200).json({ success: true, message: "characters table created" });
}
```

- [ ] **Step 2: Run the dev server and hit the setup endpoint**

```bash
cd /Users/brooks/Desktop/zero-next && yarn dev &
sleep 3
curl -X POST http://localhost:3000/api/tools/setup-characters
```

Expected: `{"success":true,"message":"characters table created"}`

- [ ] **Step 3: Delete the setup route after confirming the table exists**

Delete `src/pages/api/tools/setup-characters.ts`.

- [ ] **Step 4: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add -A && git commit -m "feat(chat-sandbox): create characters table in neon"
```

---

### Task 6: Create Characters CRUD API Route

**Files:**
- Create: `src/pages/api/tools/characters.ts`

- [ ] **Step 1: Write the characters API route**

```typescript
// src/pages/api/tools/characters.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const characters = await sql`
      SELECT id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      FROM characters
      ORDER BY created_at DESC
    `;
    return res.status(200).json(characters);
  }

  if (req.method === "POST") {
    const { name, one_liner, profile, model, color, avatar_emoji } = req.body;

    if (!name?.trim() || !one_liner?.trim() || !profile?.trim() || !model?.trim()) {
      return res.status(400).json({ error: "name, one_liner, profile, and model are required" });
    }

    const character = (
      await sql`
        INSERT INTO characters (name, one_liner, profile, model, color, avatar_emoji)
        VALUES (${name.trim()}, ${one_liner.trim()}, ${profile.trim()}, ${model.trim()}, ${color}, ${avatar_emoji})
        RETURNING id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      `
    )[0];

    return res.status(201).json(character);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id query parameter is required" });
    }

    await sql`DELETE FROM characters WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  if (req.method === "PUT") {
    const { id, profile } = req.body;
    if (!id || !profile?.trim()) {
      return res.status(400).json({ error: "id and profile are required" });
    }

    const updated = (
      await sql`
        UPDATE characters SET profile = ${profile.trim()}, updated_at = now()
        WHERE id = ${id}
        RETURNING id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      `
    )[0];

    if (!updated) return res.status(404).json({ error: "Character not found" });
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 2: Verify with curl**

```bash
curl http://localhost:3000/api/tools/characters
```

Expected: `[]` (empty array)

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/api/tools/characters.ts && git commit -m "feat(chat-sandbox): add characters CRUD api route"
```

---

### Task 7: Create Profile Generation API Route

**Files:**
- Create: `src/pages/api/tools/generate-profile.ts`

- [ ] **Step 1: Write the profile generation endpoint**

```typescript
// src/pages/api/tools/generate-profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildProfilePrompt } from "src/lib/openrouter/profile-prompt";
import { sanitizeOneLiner, sanitizeProfile } from "src/lib/openrouter/sanitize";
import { DEFAULT_PROFILE_MODEL } from "src/lib/openrouter/models";

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
      model: openrouter(DEFAULT_PROFILE_MODEL),
      prompt: buildProfilePrompt(name.trim(), sanitized.cleaned),
      maxTokens: 1500,
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
cd /Users/brooks/Desktop/zero-next && git add src/pages/api/tools/generate-profile.ts && git commit -m "feat(chat-sandbox): add profile generation api route"
```

---

### Task 8: Create Chat Streaming API Route

**Files:**
- Create: `src/pages/api/tools/chat.ts`

- [ ] **Step 1: Write the chat streaming endpoint**

This uses `pipeTextStreamToResponse` which works with the Pages Router `res` object (Node.js `ServerResponse`).

```typescript
// src/pages/api/tools/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { sanitizeMessage } from "src/lib/openrouter/sanitize";
import { getModelById } from "src/lib/openrouter/models";

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

  const model = getModelById(modelId);
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
      model: openrouter(modelId),
      system: systemPrompt,
      messages,
      maxTokens: 2000,
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/api/tools/chat.ts && git commit -m "feat(chat-sandbox): add streaming chat api route"
```

---

### Task 9: Build the Chat Sandbox Page — Types and State

**Files:**
- Create: `src/pages/tools/chat.tsx`

- [ ] **Step 1: Write the page with types, state management, and API helpers**

```typescript
// src/pages/tools/chat.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { FREE_MODELS } from "src/lib/openrouter/models";

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

async function generateProfile(name: string, oneLiner: string): Promise<string> {
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
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/tools/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
```

This is the first half of the file — types, helpers, and utilities. The component itself comes in the next step.

- [ ] **Step 2: Commit partial page**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/tools/chat.tsx && git commit -m "feat(chat-sandbox): scaffold chat page with types and api helpers"
```

---

### Task 10: Build the Chat Sandbox Page — Add Character Modal

**Files:**
- Modify: `src/pages/tools/chat.tsx`

- [ ] **Step 1: Add the AddCharacterModal component to the bottom of the file (before the default export, which we'll add in Task 11)**

Append this after the `msgId` function:

```typescript
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
  const [modelId, setModelId] = useState(FREE_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return setError("Give your character a name");
    if (!oneLiner.trim()) return setError("Describe their personality in a sentence");
    setLoading(true);
    setError("");
    try {
      const profile = await generateProfile(name.trim(), oneLiner.trim());
      const { assignColor, assignEmoji } = await import("src/lib/openrouter/colors");
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
        <h2 className="text-lg font-semibold text-[#DADBD9] mb-4">New Character</h2>

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
          <span className="text-sm text-[#DADBD9]/70">Personality (one-liner)</span>
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
            {FREE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/tools/chat.tsx && git commit -m "feat(chat-sandbox): add character modal component"
```

---

### Task 11: Build the Chat Sandbox Page — Main Component

**Files:**
- Modify: `src/pages/tools/chat.tsx`

- [ ] **Step 1: Add the main ChatSandbox component as the default export at the bottom of the file**

```typescript
/* ── Main Page Component ── */
export default function ChatSandbox() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sendTo, setSendTo] = useState<string>("all"); // character id or "all"
  const [showModal, setShowModal] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [streamingCharId, setStreamingCharId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load saved characters on mount
  useEffect(() => {
    fetchCharacters()
      .then(setCharacters)
      .catch(console.error)
      .finally(() => setLoading(false));
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

  // Build conversation context for a character (what they "see")
  const buildContext = (characterId: string): { role: "user" | "assistant"; content: string }[] => {
    return messages.map((m) => {
      if (m.role === "user") {
        return { role: "user" as const, content: m.content };
      }
      // Other characters' messages appear as user messages with attribution
      if (m.characterId !== characterId) {
        return { role: "user" as const, content: `[${m.characterName}]: ${m.content}` };
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
              m.id === placeholder.id ? { ...m, content: m.content + chunk } : m
            )
          );
        },
        controller.signal
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

  return (
    <main className="min-h-screen terrain-page-bg font-sans flex flex-col">
      <Head>
        <title>Chat Sandbox | Brooks Roley</title>
      </Head>

      {/* Header */}
      <header className="border-b border-[#C5E7EA]/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#DADBD9]/50 hover:text-[#DADBD9] text-sm transition-colors">
            &larr; Home
          </Link>
          <h1 className="text-lg font-semibold text-[#DADBD9]">Chat Sandbox</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
        >
          + Add Character
        </button>
      </header>

      {/* Character Strip */}
      {characters.length > 0 && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 flex gap-3 overflow-x-auto">
          {characters.map((c) => (
            <div
              key={c.id}
              className="flex-none flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[#415557]/30 transition-colors"
              style={{ borderColor: c.color + "40" }}
              onClick={() => setExpandedProfile(expandedProfile === c.id ? null : c.id)}
            >
              <span className="text-lg">{c.avatar_emoji}</span>
              <div>
                <div className="font-medium text-[#DADBD9]">{c.name}</div>
                <div className="text-xs text-[#DADBD9]/50">
                  {FREE_MODELS.find((m) => m.id === c.model)?.displayName || c.model}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(c.id); }}
                className="ml-2 text-[#DADBD9]/30 hover:text-red-400 transition-colors"
                title="Remove character"
              >
                &times;
              </button>
            </div>
          ))}
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
          <p className="text-[#DADBD9]/40 text-sm text-center py-8">Loading characters...</p>
        )}
        {!loading && characters.length === 0 && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#DADBD9]/50 text-sm mb-2">No characters yet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#C5E7EA] text-sm hover:underline"
            >
              Create your first character
            </button>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
                  <span className="text-xs font-medium" style={{ color: m.characterColor }}>
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

- [ ] **Step 2: Run lint to verify no errors**

```bash
cd /Users/brooks/Desktop/zero-next && yarn lint
```

Expected: No errors (warnings OK).

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/tools/chat.tsx && git commit -m "feat(chat-sandbox): build main chat sandbox page component"
```

---

### Task 12: Add Chat Sandbox Link to Homepage

**Files:**
- Modify: `src/pages/index.tsx`

- [ ] **Step 1: Read the current index.tsx to find where to add a card link**

Read the full file to find the section where interactive experiences are linked (the card grid).

- [ ] **Step 2: Add a TiltCard link for Chat Sandbox**

Add a card in the appropriate section with this structure:

```tsx
<div data-physics-item className="physics-field-item">
  <Reveal delay={/* next delay value */}>
    <TiltCard>
      <Link href="/tools/chat" className={cardBase}>
        <div className="px-5 py-5">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Chat Sandbox <ArrowIcon />
          </h3>
          <p className="mt-1 text-sm text-[#DADBD9]/68">
            Create AI characters and watch them interact.
          </p>
        </div>
        <div className="tilt-highlight" />
      </Link>
    </TiltCard>
  </Reveal>
</div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next && git add src/pages/index.tsx && git commit -m "feat(chat-sandbox): add chat sandbox card to homepage"
```

---

### Task 13: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/brooks/Desktop/zero-next && yarn dev
```

- [ ] **Step 2: Test character creation**

1. Navigate to `http://localhost:3000/tools/chat`
2. Click "Add Character"
3. Enter name "Captain Blackbeard", one-liner "Sarcastic pirate who philosophizes about the sea", pick any model
4. Click Create — wait for profile to generate
5. Verify the character card appears in the strip

- [ ] **Step 3: Test chat**

1. Type a message and send to the character
2. Verify streaming response appears in the chat log with the character's color and emoji
3. Add a second character
4. Send to "All" — verify both respond sequentially
5. Click "Next Round" — verify characters respond to the conversation

- [ ] **Step 4: Test persistence**

1. Refresh the page
2. Verify characters reload from the database

- [ ] **Step 5: Test edge cases**

1. Try creating a character with an empty name — verify validation error
2. Try sending an empty message — verify it's blocked
3. Delete a character — verify it disappears

- [ ] **Step 6: Final commit if any fixes needed**

```bash
cd /Users/brooks/Desktop/zero-next && git add -A && git commit -m "fix(chat-sandbox): smoke test fixes"
```
