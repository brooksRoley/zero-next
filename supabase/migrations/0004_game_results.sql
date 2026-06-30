-- supabase/migrations/0004_game_results.sql
-- Per-game ELO history for Pente: one row per completed game, capturing the
-- ELO swing, the opponent, the mode, and the full move list.
--
-- Backs POST /api/pente/game-result and unlocks game history / replay (a
-- premium feature on the monetization roadmap). Until this is applied that
-- route returns { supported: false } and the client simply skips the write —
-- local ELO/profile sync (which never touches this table) is unaffected.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

create table if not exists game_results (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null,
  opponent_id   uuid,                            -- null for bot games
  opponent_type text not null default 'bot',     -- 'bot' | 'human'
  bot_level     text,                            -- BOT_LEVELS label, e.g. 'Expert'
  game_mode     text,                            -- GAME_MODES key, e.g. 'classic'
  winner        text,                            -- 'player' | 'opponent'
  elo_before    integer,
  elo_after     integer,
  moves         jsonb,
  created_at    timestamptz not null default now()
);

-- Fast "my recent games" lookups for the history/replay view.
create index if not exists game_results_player_id_created_at_idx
  on game_results (player_id, created_at desc);
