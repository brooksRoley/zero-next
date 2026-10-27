-- 0009: close the API-only tables to the public anon key.
--
-- PREREQUISITE — apply only after SUPABASE_SERVICE_ROLE_KEY is set in Vercel
-- (Production) and a deploy containing src/lib/supabase.ts's server-side
-- service-role client is live. Before that, the API routes still use the anon
-- key and every write below would start failing.
--
-- Why: the anon key ships in every page, and these policies let anyone holding
-- it read every player id and rewrite any player's rating, name or stats, any
-- bank puzzle's board and solutions, and the attempt/result logs — directly
-- over PostgREST, past every check in the API. Only the API routes touch these
-- tables (verified 2026-10-21: no browser code calls .from() on them), and the
-- service role bypasses RLS, so with no policies the API keeps working and the
-- public key gets nothing.
--
-- Left open on purpose: `games` and `matchmaking_queue` (the browser writes
-- them during multiplayer — src/hooks/useMultiplayerGame.js,
-- useMatchmaking.js) and `moves` SELECT (read by the board). Closing those needs
-- player auth first.
--
-- Idempotent: every drop is IF EXISTS; RLS stays enabled.

drop policy if exists "Players are publicly readable" on public.players;
drop policy if exists "Players can insert their own row" on public.players;
drop policy if exists "Players can update their own row" on public.players;

drop policy if exists "Go players are publicly readable" on public.go_players;
drop policy if exists "Go players can insert their own row" on public.go_players;
drop policy if exists "Go players can update their own row" on public.go_players;

drop policy if exists "anon can read puzzle_bank" on public.puzzle_bank;
drop policy if exists "anon can insert puzzle_bank" on public.puzzle_bank;
drop policy if exists "anon can update puzzle_bank stats" on public.puzzle_bank;

drop policy if exists "anon can read puzzle_attempts" on public.puzzle_attempts;
drop policy if exists "anon can insert puzzle_attempts" on public.puzzle_attempts;

drop policy if exists "anon can read go_puzzle_attempts" on public.go_puzzle_attempts;
drop policy if exists "anon can insert go_puzzle_attempts" on public.go_puzzle_attempts;

drop policy if exists "anon can read game_results" on public.game_results;
drop policy if exists "anon can insert game_results" on public.game_results;

drop policy if exists "Anyone can insert moves" on public.moves;

alter table public.players enable row level security;
alter table public.go_players enable row level security;
alter table public.puzzle_bank enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.go_puzzle_attempts enable row level security;
alter table public.game_results enable row level security;
alter table public.moves enable row level security;
