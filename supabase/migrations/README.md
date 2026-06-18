# Supabase migrations

Tracked schema changes for the **game-state** database (Pente / Go ELO, multiplayer,
daily challenge). This is the single source of truth for Supabase schema — schema
changes do **not** belong as comments inside API route files. If a feature needs a
new column or table, add a numbered file here and flip its row in the checklist below.

> **Scope:** Supabase only. The **business-side** tables (`leads`, `checkout_sessions`,
> `events`, `guestbook`, `bball_*`) live in **Neon** and self-apply at runtime via
> `CREATE TABLE IF NOT EXISTS` (see `src/pages/api/events.ts`, `src/pages/api/bball/setup.ts`).
> They are not tracked here because no manual step is ever required.

## How to apply

These run manually — there is no `supabase db push` wired up. To apply a pending migration:

1. Open the [Supabase SQL editor](https://supabase.com/dashboard/project/_/sql).
2. Paste the contents of the file, run it (every file is idempotent — safe to re-run).
3. Update the **Applied** column below to `✅ <date>` and commit.

## Status

| # | File | Adds | Applied |
|---|------|------|---------|
| baseline | _(pre-dates tracked migrations)_ | `players`, `games` tables | ✅ live |
| 0001 | `0001_matchmaking_queue.sql` | `matchmaking_queue` table + `claim_match()` RPC + realtime | ✅ live |
| 0002 | `0002_go_players.sql` | `go_players` table + indexes | ✅ live |
| 0003 | `0003_players_daily_challenge.sql` | `players.daily_challenge` JSONB column | ❌ **pending** |

### 0003 is pending

The Pente Daily Challenge (shipped 2026-06-17) writes streaks to `players.daily_challenge`,
which does not exist in production yet. `GET/POST /api/pente/daily` degrades gracefully —
it returns `{ supported: false }` and the client falls back to localStorage — so nothing
is broken, but **streaks are device-local until 0003 is applied.** Run the file above to
turn on cross-device streak sync. ~2 minutes, no code deploy needed.
