-- 0007_go_puzzle_attempts.sql
-- Creates the Go `go_puzzle_attempts` table: one row per Go puzzle attempt.
-- Written by POST /api/go/puzzle-attempts and counted by /admin/analytics.
--
-- Columns are derived from the insert in src/pages/api/go/puzzle-attempts.js
-- (the `row` object) — that handler is the only writer.
--
-- Kept isolated from the Pente `puzzle_attempts` table for the same reason
-- `go_players` is isolated from `players` (see 0002): Go ELO is an independent
-- ladder, and the two puzzle catalogs identify puzzles differently — Go always
-- uses a catalog slug ('capture-corner'), never a generated UUID.
--
-- No foreign keys, deliberately: the client POSTs fire-and-forget and treats
-- local state as the source of truth, so an insert must not fail on a
-- `go_players` row that has not been upserted yet.
--
-- Idempotent — safe to re-run.

create table if not exists go_puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  -- go_players.id (UUID, matches the client's local Go player id).
  player_id uuid not null,
  -- Catalog slug from src/lib/go/puzzles.js — text, not a UUID.
  puzzle_id text not null,
  -- The puzzle's rating at the time of the attempt (snapshot).
  puzzle_rating integer,
  solved boolean not null default false,
  used_hint boolean not null default false,
  elo_before integer,
  elo_after integer,
  solve_time_ms integer,
  created_at timestamptz not null default now()
);

-- Per-player attempt history, newest first.
create index if not exists idx_go_puzzle_attempts_player_created
  on go_puzzle_attempts (player_id, created_at desc);

-- Per-puzzle solve rate across all players.
create index if not exists idx_go_puzzle_attempts_puzzle_id
  on go_puzzle_attempts (puzzle_id);

-- Time-windowed rollups for /admin/analytics.
create index if not exists idx_go_puzzle_attempts_created_at
  on go_puzzle_attempts (created_at desc);
