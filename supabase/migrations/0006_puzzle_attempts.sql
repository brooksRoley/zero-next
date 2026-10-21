-- 0006_puzzle_attempts.sql
-- The Pente `puzzle_attempts` table: one row per puzzle attempt, solved or
-- abandoned. Written by POST /api/pente/puzzle-attempts, which also uses these
-- rows to recalibrate `puzzle_bank.rating`.
--
-- This file DOCUMENTS a table that was created by hand before migrations were
-- tracked. It was reconciled against the live schema on 2026-10-20
-- (information_schema.columns, pg_indexes, pg_policies), replacing an earlier
-- version that was inferred from the API handler and got the id type, the
-- `attempts` type, the index names and the policies wrong.
--
-- No foreign keys, deliberately. The attempt write is fire-and-forget from the
-- client and must never block local progress, so a missing `players` row or a
-- generated puzzle that was never persisted to `puzzle_bank` should not turn an
-- insert into a 500. Referential tidiness is not worth losing the data point.
--
-- Idempotent — safe to re-run; a no-op against the live table.

create table if not exists puzzle_attempts (
  id bigint generated always as identity primary key,
  -- players.id (UUID, matches the client's localStorage `pente_player_id`).
  player_id uuid not null,
  -- puzzle_bank.id when the puzzle was generated and persisted; null for
  -- curated catalog puzzles, which identify themselves via the slug below.
  puzzle_id uuid,
  puzzle_external_id text,
  -- The puzzle's rating at the time of the attempt (snapshot, not a live join).
  rating integer,
  solved boolean not null default false,
  attempts smallint not null default 1,
  used_hint boolean not null default false,
  elo_before integer,
  elo_after integer,
  solve_time_ms integer,
  created_at timestamptz not null default now()
);

-- Per-player attempt history, newest first — the shape the profile UI reads.
create index if not exists puzzle_attempts_player_idx
  on puzzle_attempts (player_id, created_at desc);

-- Per-puzzle stats: solve rate and average solve time for one bank puzzle.
create index if not exists puzzle_attempts_puzzle_idx
  on puzzle_attempts (puzzle_id);

-- Row-level security: read and insert for the anon key the API uses.
alter table puzzle_attempts enable row level security;
drop policy if exists "anon can read puzzle_attempts" on puzzle_attempts;
create policy "anon can read puzzle_attempts" on puzzle_attempts for select using (true);
drop policy if exists "anon can insert puzzle_attempts" on puzzle_attempts;
create policy "anon can insert puzzle_attempts" on puzzle_attempts for insert with check (true);
