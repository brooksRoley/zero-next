-- 0008_puzzle_bank.sql
-- The Pente `puzzle_bank` table: generated puzzles persisted by the Web
-- Worker's generator so they can be served again and rated by solve stats.
-- Written and read by /api/pente/puzzle-bank; `rating`, `rating_count`,
-- `times_served`, `times_solved` and `avg_solve_time_ms` are updated by
-- /api/pente/puzzle-attempts.
--
-- This file DOCUMENTS a table that was created by hand before migrations were
-- tracked. It was copied from the live schema on 2026-10-20
-- (information_schema.columns, pg_constraint, pg_indexes, pg_policies).
--
-- Known issue, recorded rather than fixed here: the update policy allows the
-- anon key to update any column, not just the stats columns its name implies.
-- See the README note under 0008.
--
-- Idempotent — safe to re-run; a no-op against the live table.

create table if not exists puzzle_bank (
  id uuid primary key default gen_random_uuid(),
  -- 19×19 board as nested arrays of 0 (empty), 1 (black), 2 (white).
  board jsonb not null,
  -- Accepted answers, each a { row, col } cell.
  solutions jsonb not null,
  player_to_move smallint not null check (player_to_move in (1, 2)),
  category text not null,
  difficulty smallint not null check (difficulty between 1 and 4),
  rating integer not null,
  title text default '',
  description text default '',
  hint text default '',
  explanation text default '',
  generated_by text default 'worker' check (generated_by in ('worker', 'curated')),
  times_served integer not null default 0,
  times_solved integer not null default 0,
  avg_solve_time_ms integer,
  created_at timestamptz not null default now(),
  -- How many attempts have recalibrated `rating` (its confidence).
  rating_count integer not null default 0
);

-- Serving picks puzzles in a rating window, least-served first.
create index if not exists puzzle_bank_rating_idx on puzzle_bank (rating);
create index if not exists puzzle_bank_category_idx on puzzle_bank (category);

alter table puzzle_bank enable row level security;
drop policy if exists "anon can read puzzle_bank" on puzzle_bank;
create policy "anon can read puzzle_bank" on puzzle_bank for select using (true);
drop policy if exists "anon can insert puzzle_bank" on puzzle_bank;
create policy "anon can insert puzzle_bank" on puzzle_bank for insert with check (true);
drop policy if exists "anon can update puzzle_bank stats" on puzzle_bank;
create policy "anon can update puzzle_bank stats" on puzzle_bank for update using (true) with check (true);
