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
| 0001 | `0001_matchmaking_queue.sql` | `matchmaking_queue` table + `claim_match()` RPC + realtime + RLS | ✅ 2026-10-15 (was marked live, but the table was missing) |
| 0002 | `0002_go_players.sql` | `go_players` table + indexes + RLS | ✅ 2026-10-15 (was marked live, but the table was missing: `/api/go/player` returned 500) |
| 0003 | `0003_players_daily_challenge.sql` | `players.daily_challenge` JSONB column | ✅ 2026-07-14 |
| 0004 | `0004_game_results.sql` | `game_results` table (per-game ELO history) | ✅ 2026-07-14 |
| 0005 | `0005_players_game_elo.sql` | `players.game_elo` + `game_peak_elo` (puzzle/game rating split) | ✅ 2026-07-14 |
| 0006 | `0006_puzzle_attempts.sql` | `puzzle_attempts` table + indexes (Pente) | ⏳ pending — **verify columns first** |
| 0007 | `0007_go_puzzle_attempts.sql` | `go_puzzle_attempts` table + indexes + RLS (Go) | ✅ 2026-10-15 (the table did not exist, so there was nothing to diff) |

### Before applying 0006

Update 2026-10-15: `go_puzzle_attempts` turned out **not** to exist live, so 0007
was applied as written (with RLS). The rest of this note now applies to 0006 only.

Both tables were believed to exist in the live database — they have been written to by
`/api/pente/puzzle-attempts` and `/api/go/puzzle-attempts` since well before this
repo tracked migrations. These two files exist to close that gap: the schema was
undocumented in version control, so nobody could tell what shape the live tables
were without opening the dashboard.

The column lists were **inferred from the API handlers that write them**, not read
off the live schema (the session that wrote them had no Supabase schema access).
So before running either file:

1. Diff it against the live table (`select column_name, data_type, is_nullable from
   information_schema.columns where table_name = 'puzzle_attempts';`).
2. Reconcile any difference **in the file**, so the tracked schema matches reality.
3. Then run it — `create table if not exists` makes it a no-op on the existing
   table, so applying it will *not* repair a column that is already wrong. That is
   the point: these files document, they do not migrate.

Related known gap: `puzzle_bank` (written by `/api/pente/puzzle-bank`) is also
live-but-untracked and still has no file here.

All three were applied 2026-07-14 via the Supabase MCP `apply_migration` tool (so
they also appear in the project's tracked migration history, not just the SQL
editor). Verified same day: the three new `players` columns exist, `game_results`
+ its index exist, all 16 existing players had `game_elo`/`game_peak_elo` seeded
from their blended rating, and the live `GET /api/pente/daily` flipped from
`{ supported: false }` to `{ "daily": {}, "supported": true }` with no code deploy.

**2026-10-15:** 0002 and 0007 were applied together via the Supabase MCP
`apply_migration` tool (migration `go_players_and_puzzle_attempts`), each with RLS
policies mirroring their Pente counterparts, since the API uses the anon key.
Verified the same day: live `GET /api/go/player` went from 500 (`Could not find
the table 'public.go_players'`) to 404 for an unknown id, a test POST created a
row (then deleted), and the Supabase security advisor reported no issues. The
audit that found this also showed `matchmaking_queue` (0001) missing from the
live DB despite being marked live. It was applied the same day (migrations
`matchmaking_queue` and `claim_match_security_invoker`), with RLS, a guarded
realtime step, and `claim_match` switched to `security invoker` with a pinned
`search_path` (the security advisor flagged the definer version as callable by
anon). Verified with two test players through the public REST API: queue insert
201, claim returned a game id (a second claim on the same row returned null),
the game had a 19×19 board in `in_progress`, cancel returned 204; all test rows
deleted, and the advisor reported no issues.
