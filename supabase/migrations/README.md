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
| 0003 | `0003_players_daily_challenge.sql` | `players.daily_challenge` JSONB column | ✅ 2026-07-14 |
| 0004 | `0004_game_results.sql` | `game_results` table (per-game ELO history) | ✅ 2026-07-14 |
| 0005 | `0005_players_game_elo.sql` | `players.game_elo` + `game_peak_elo` (puzzle/game rating split) | ✅ 2026-07-14 |

All three were applied 2026-07-14 via the Supabase MCP `apply_migration` tool (so
they also appear in the project's tracked migration history, not just the SQL
editor). Verified same day: the three new `players` columns exist, `game_results`
+ its index exist, all 16 existing players had `game_elo`/`game_peak_elo` seeded
from their blended rating, and the live `GET /api/pente/daily` flipped from
`{ supported: false }` to `{ "daily": {}, "supported": true }` with no code deploy.
