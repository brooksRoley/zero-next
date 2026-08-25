-- 0006_puzzle_attempts.sql
-- Creates the Pente `puzzle_attempts` table: one row per puzzle attempt,
-- solved or abandoned. Written by POST /api/pente/puzzle-attempts, which also
-- uses these rows to recalibrate `puzzle_bank.rating`.
--
-- Columns are derived from the insert in src/pages/api/pente/puzzle-attempts.js
-- (the `row` object) — that handler is the only writer.
--
-- No foreign keys, deliberately. The attempt write is fire-and-forget from the
-- client and must never block local progress, so a missing `players` row or a
-- generated puzzle that was never persisted to `puzzle_bank` should not turn an
-- insert into a 500. Referential tidiness is not worth losing the data point.
--
-- Idempotent — safe to re-run.

create table if not exists puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  -- players.id (UUID, matches the client's localStorage `pente_player_id`).
  player_id uuid not null,
  -- puzzle_bank.id when the puzzle was generated and persisted; null for
  -- curated catalog puzzles, which identify themselves via the slug below.
  puzzle_id uuid,
  puzzle_external_id text,
  -- The puzzle's rating at the time of the attempt (snapshot, not a live join).
  rating integer,
  solved boolean not null default false,
  attempts integer not null default 1,
  used_hint boolean not null default false,
  elo_before integer,
  elo_after integer,
  solve_time_ms integer,
  created_at timestamptz not null default now()
);

-- Per-player attempt history, newest first — the shape the profile UI reads.
create index if not exists idx_puzzle_attempts_player_created
  on puzzle_attempts (player_id, created_at desc);

-- Per-puzzle stats: solve rate and average solve time for one bank puzzle.
create index if not exists idx_puzzle_attempts_puzzle_id
  on puzzle_attempts (puzzle_id)
  where puzzle_id is not null;

-- Same lookup for curated catalog puzzles, which key off the slug instead.
create index if not exists idx_puzzle_attempts_external_id
  on puzzle_attempts (puzzle_external_id)
  where puzzle_external_id is not null;

-- Time-windowed rollups for /admin/analytics.
create index if not exists idx_puzzle_attempts_created_at
  on puzzle_attempts (created_at desc);
