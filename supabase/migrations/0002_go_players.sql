-- supabase/go_players.sql
-- Run this in the Supabase SQL editor to create the Go player profile table.
-- Mirrors the Pente `players` table; isolated so Go ELO is independent of Pente ELO.

create table if not exists go_players (
  id uuid primary key,
  name text not null default '',
  go_elo integer not null default 1000,
  peak_elo integer not null default 1000,
  puzzles_solved integer not null default 0,
  games_played integer not null default 0,
  games_won integer not null default 0,
  lesson_progress jsonb not null default '{}'::jsonb,
  solved_puzzles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists idx_go_players_last_seen
  on go_players (last_seen desc);

create index if not exists idx_go_players_go_elo
  on go_players (go_elo desc);

-- Row-level security, mirroring `players`: the API uses the anon key, so
-- reads, inserts and updates need explicit policies. Added when this file was
-- first actually applied (2026-10-15); idempotent via drop-if-exists.
alter table go_players enable row level security;
drop policy if exists "Go players are publicly readable" on go_players;
create policy "Go players are publicly readable" on go_players for select using (true);
drop policy if exists "Go players can insert their own row" on go_players;
create policy "Go players can insert their own row" on go_players for insert with check (true);
drop policy if exists "Go players can update their own row" on go_players;
create policy "Go players can update their own row" on go_players for update using (true) with check (true);
