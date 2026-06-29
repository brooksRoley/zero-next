-- supabase/migrations/0003_players_daily_challenge.sql
-- Adds server-side persistence for the Pente Daily Challenge streak.
--
-- Backs GET/POST /api/pente/daily. Until this is applied that route returns
-- { supported: false } and streaks live only in the player's localStorage, so
-- a streak does not survive switching devices or clearing storage.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

alter table players
  add column if not exists daily_challenge jsonb not null default '{}'::jsonb;
