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
