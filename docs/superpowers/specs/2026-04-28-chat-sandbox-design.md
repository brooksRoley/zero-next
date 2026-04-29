# Chat Sandbox — `/tools/chat`

Multi-character AI chat sandbox powered by free OpenRouter models. Users create characters with generated "Enigmatic Writer" persona profiles, then chat with them individually or watch them riff off each other in directed rounds.

**Livelihood stream:** SaaS micro-tools (Rung 5 path — free tier now, premium characters/persistence later)

## Architecture

- **Page:** `src/pages/tools/chat.tsx`
- **API — chat:** `src/pages/api/tools/chat.ts` — proxies to OpenRouter via AI SDK, streams responses
- **API — characters:** `src/pages/api/tools/characters.ts` — CRUD for saved character profiles
- **API — profile gen:** `src/pages/api/tools/generate-profile.ts` — generates Enigmatic Writer profiles from one-liners
- **Config:** `src/lib/openrouter/models.ts` — hardcoded free model registry
- **Database:** Neon Postgres `characters` table
- **Dependencies:** `ai` (AI SDK core), `@ai-sdk/openai` (OpenRouter-compatible provider)

## Data Model

### `characters` table (Neon Postgres)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | VARCHAR(100) | Display name |
| `one_liner` | VARCHAR(280) | Original persona input |
| `profile` | TEXT | Generated Enigmatic Writer markdown |
| `model` | VARCHAR(200) | OpenRouter model ID |
| `color` | VARCHAR(7) | Hex color, auto-assigned |
| `avatar_emoji` | VARCHAR(10) | Auto-assigned emoji avatar |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

No `user_id` — no auth in v1. Characters are device-scoped via client-side ID tracking.

No conversation persistence — chat history is ephemeral React state.

## Free Model Registry (v1)

| Display Name | Model ID | Context |
|---|---|---|
| NVIDIA Nemotron 3 Nano Omni | `nvidia/nemotron-3-nano-omni-free` | 256K |
| Poolside Laguna XS.2 | `poolside/laguna-xs.2-free` | 131K |
| Poolside Laguna M.1 | `poolside/laguna-m.1-free` | 131K |

Nemotron is the default profile generator model.

## Enigmatic Writer Profile Format

Generated from a one-liner via meta-prompt. Becomes the character's system prompt.

```markdown
# {Character Name}

## Voice
Tone, cadence, speech style.

## Worldview
How they see the world, core beliefs.

## Personality
- Trait 1
- Trait 2
- Trait 3

## Speech Patterns
- Verbal habits, catchphrases
- Sentence structure preferences

## Boundaries
- What they won't do or say
- Hard character limits
```

## UI Layout

1. **Header bar** — "Chat Sandbox" title + "Add Character" button
2. **Character strip** — horizontal row of character cards (emoji, name, model, color dot). Click to view/edit profile. X to remove from session.
3. **Chat log** — shared vertical thread. Messages styled with character color + avatar. User messages neutral.
4. **Input area** — text field + send-to picker (specific character or "All") + "Next Round" button

### Adding a Character

1. Click "Add Character"
2. Modal: name, one-liner persona, model dropdown
3. "Create" triggers profile generation (loading spinner)
4. Card appears in strip, character joins conversation

### Conversation Modes

- **Direct message** — user picks a character from dropdown, sends message, that character responds
- **Broadcast** — user sends to "All", every character responds sequentially
- **Next Round** — user picks who speaks next (individual or "All"). Characters respond in round-robin order, each seeing prior responses. Responses stream in real time.

## Prompt Injection Protection

Server-side sanitization at three points:

1. **One-liner input** — reject suspicious patterns ("ignore previous instructions", encoded directives), validate length
2. **Generated profile** — sanitize before saving, strip override attempts
3. **Chat messages** — scan user messages before forwarding to API

## Content Policy

R-rated / mature content allowed. No PG-13 constraint on character personas or conversation.

## Rate Limiting

No hard caps in v1. Graceful error handling when OpenRouter rate limits are hit — friendly message to the user.

## Styling

Dark forest theme consistent with site palette. Character colors auto-assigned from a curated set that reads well on dark backgrounds.
