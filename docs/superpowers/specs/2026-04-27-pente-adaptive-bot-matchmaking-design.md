# Pente Adaptive Bot & Online Matchmaking

**Date:** 2026-04-27
**Status:** Approved

## Overview

Two features for the Pente game platform:

1. **Adaptive Bot** — replaces fixed difficulty tiers with a single bot that continuously matches the player's ELO, providing a teaching-caliber opponent that grows with the player.
2. **Online Matchmaking Queue** — FCFS queue where players play against the adaptive bot while waiting, then confirm matches when an opponent is found.

---

## Feature 1: Adaptive Bot Engine

### Current State

Four fixed bot tiers in `BOT_LEVELS` (`src/components/PentePlayerbot.js`):

| Level | ELO | Depth | Time Budget | Blunder Rate |
|---|---|---|---|---|
| Beginner | 600 | 1 | 200ms | 15% |
| Intermediate | 1000 | 2 | 1000ms | 5% |
| Advanced | 1400 | 3 | 3000ms | 1% |
| Expert | 1800 | 4 | 5000ms | 0% |

### New: Continuous Calibration

**New file:** `src/lib/pente/adaptiveBot.js`

**`getAdaptiveBotConfig(playerElo, gamesPlayed)` → `{ searchDepth, timeBudgetMs, blunderRate, effectiveElo }`**

Uses the four existing `BOT_LEVELS` as anchor points and linearly interpolates between them for any ELO value.

- `searchDepth`: Continuous interpolation, rounded to nearest integer (1–4)
- `timeBudgetMs`: Linear interpolation (200–5000ms)
- `blunderRate`: Linear interpolation (0.25–0.0), clamped at 0

**New player ramp-up (gamesPlayed < 6):**

- `effectiveElo = playerElo - (200 * (1 - gamesPlayed / 5))`
- Game 0: bot plays 200 ELO below stated rating
- Game 5+: bot plays at true ELO
- An 800-rated new player faces a ~600-strength bot on their first game

**No changes to `penteWorker.js`** — it already accepts `searchDepth`, `timeBudgetMs`, `blunderRate` as parameters.

### UI Changes

- "vs Bot" mode: Remove difficulty dropdown. Show "Bot ELO: ~{effectiveElo}" label instead.
- Player just hits Play; bot strength is automatic.

---

## Feature 2: Online Matchmaking Queue

### Queue Table (`matchmaking_queue` in Supabase)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID, PK | Row ID |
| `player_id` | UUID | Player's profile ID |
| `player_name` | text | Display name |
| `player_elo` | integer | Current ELO at queue time |
| `status` | text | `waiting` / `matched` / `cancelled` |
| `matched_game_id` | UUID, nullable | Game ID once matched |
| `matched_with` | UUID, nullable | Opponent's player ID |
| `created_at` | timestamptz | When they entered queue |

### Match Flow

1. Player clicks "Online" → upserts into `matchmaking_queue` with status `waiting`
2. Client subscribes to realtime changes on their queue row
3. Client queries for other `waiting` rows — if one exists, calls Supabase RPC `claim_match(my_id, their_queue_id)` which atomically:
   - Verifies opponent row is still `waiting`
   - Creates a new `games` row with both players
   - Updates both queue rows to `matched` with the `matched_game_id`
4. Both clients see their row flip to `matched` via realtime → "Match found!" dialog
5. Accept → navigate to game. Decline/timeout (15s) → back to `waiting`, opponent re-queued
6. Cancel (leave queue) → status set to `cancelled`

**Stale cleanup:** Rows older than 10 minutes with status `waiting` are ignored by the claim query.

### Supabase RPC: `claim_match`

```sql
-- Atomic match creation to prevent race conditions
-- Takes: claimer's player_id, target queue row id
-- Returns: game_id on success, null on conflict
```

Runs in a transaction: checks target is still `waiting`, creates game, updates both queue rows.

---

## Feature 3: Waiting Room UX

### Flow

The "Online" mode tab is the unified entry point:

1. Player enters queue
2. Immediately starts a bot game using the adaptive bot — full game experience (board, eval bar, turns, captures)
3. Persistent banner: "In queue — playing bot while waiting..." with "Leave Queue" button
4. When match found:
   - Bot game pauses (worker stops computing)
   - Modal: "Opponent found! **{name}** (~{elo} ELO). Accept match?" with 15-second countdown
   - **Accept:** Board resets, transitions to multiplayer game
   - **Decline:** Modal closes, bot game resumes, stay in queue
   - **Timeout (15s):** Treated as decline

### Post-Game

After multiplayer match ends, show result screen + ELO change, then offer:
- "Play again" → re-queue, back to bot play while waiting
- "Back to menu" → leave queue

### No New Routes

Everything happens within `/posts/pente`. Mode selector, queue state, bot play, and multiplayer game all live on the same page.

---

## State Management

### New Hook: `useMatchmaking(playerId, playerName, playerElo)`

**Returns:**
- `queueStatus`: `idle` / `queuing` / `matched` / `confirming`
- `opponent`: `{ name, elo }` when matched
- `matchedGameId`: game UUID when confirmed
- `confirmTimer`: seconds remaining on accept dialog
- `enterQueue()`, `leaveQueue()`, `acceptMatch()`, `declineMatch()`

Manages Supabase queue row, realtime subscription, and polling for waiting opponents.

### Game Page State Machine

```
MODE_SELECT → (pick Online) → BOT_WHILE_QUEUING → MATCH_CONFIRM → MULTIPLAYER_GAME → POST_GAME
                                    ↑                    ↓ (decline/timeout)
                                    └────────────────────┘
```

- `BOT_WHILE_QUEUING`: Same board/game as vs Bot, plus queue banner. Uses `useMatchmaking` + adaptive bot config.
- `MATCH_CONFIRM`: Overlay modal on paused bot game.
- `MULTIPLAYER_GAME`: Switches to `useMultiplayerGame` hook.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/pente/adaptiveBot.js` | **New** — `getAdaptiveBotConfig()` |
| `src/hooks/useMatchmaking.js` | **New** — queue state + realtime subscription |
| `src/pages/posts/pente.js` | Modified — Online mode state machine, adaptive bot integration, queue banner, match confirm modal |
| `src/components/PentePlayerbot.js` | Modified — export `BOT_LEVELS` for anchor points (may keep legacy tiers as fallback) |

**Unchanged:**
- `public/penteWorker.js` — already accepts dynamic config
- `src/hooks/useMultiplayerGame.js` — already handles multiplayer lifecycle
- `src/hooks/usePlayerProfile.js` — already tracks ELO and gamesPlayed
- All existing API routes

**Supabase (manual):**
- Create `matchmaking_queue` table
- Create `claim_match` RPC function
