-- supabase/migrations/0005_players_game_elo.sql
-- Splits the game rating out of the blended players.elo.
--
-- players.elo / peak_elo become puzzle-only ratings; game_elo / game_peak_elo
-- carry the game rating that ranked matchmaking (premium tier) will use.
-- Existing players are seeded from their blended rating so nobody restarts
-- at 800. Until this is applied, POST /api/pente/player silently drops the
-- game_elo fields (PGRST204 retry) and the game rating lives only in each
-- player's localStorage cache.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

alter table players
  add column if not exists game_elo integer,
  add column if not exists game_peak_elo integer;

-- Seed pre-split players from the blended rating (one-time backfill;
-- coalesce keeps re-runs from clobbering real game ratings).
update players
set game_elo      = coalesce(game_elo, elo, 800),
    game_peak_elo = coalesce(game_peak_elo, peak_elo, elo, 800)
where game_elo is null or game_peak_elo is null;

alter table players
  alter column game_elo set default 800,
  alter column game_peak_elo set default 800;
