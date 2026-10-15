-- 0001_matchmaking_queue.sql
-- Matchmaking for Pente online play: a queue table, realtime on it, and an
-- atomic claim_match() RPC. First actually applied 2026-10-15 (see README).
-- Idempotent: safe to re-run.

-- Queue table
create table if not exists matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  player_name text not null default 'Anonymous',
  player_elo integer not null default 800,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_game_id uuid,
  matched_with uuid,
  created_at timestamptz not null default now()
);

-- Index for fast waiting-player lookups
create index if not exists idx_queue_waiting
  on matchmaking_queue (status, created_at)
  where status = 'waiting';

-- Enable realtime on the table (guarded, so re-running doesn't fail)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matchmaking_queue'
  ) then
    alter publication supabase_realtime add table matchmaking_queue;
  end if;
end $$;

-- RLS, matching the other game tables: the client (anon key) reads the queue,
-- adds its own row, and cancels it.
alter table matchmaking_queue enable row level security;
drop policy if exists "Queue is publicly readable" on matchmaking_queue;
create policy "Queue is publicly readable" on matchmaking_queue for select using (true);
drop policy if exists "Anyone can join the queue" on matchmaking_queue;
create policy "Anyone can join the queue" on matchmaking_queue for insert with check (true);
drop policy if exists "Anyone can update a queue row" on matchmaking_queue;
create policy "Anyone can update a queue row" on matchmaking_queue for update using (true) with check (true);

-- Atomic match claim RPC
-- Takes: claimer's player_id/name/elo, target queue row id
-- Returns: game_id on success, null on conflict
-- Runs as the caller (security invoker): RLS already lets the anon role read and
-- update the queue and insert into games, so it needs no elevated rights.
create or replace function claim_match(
  p_claimer_id uuid,
  p_claimer_name text,
  p_claimer_elo integer,
  p_target_queue_id uuid
) returns uuid as $$
declare
  v_target record;
  v_game_id uuid;
begin
  -- Lock the target row and verify it's still waiting
  select * into v_target
    from matchmaking_queue
    where id = p_target_queue_id
      and status = 'waiting'
      and created_at > now() - interval '10 minutes'
    for update skip locked;

  if v_target is null then
    return null;
  end if;

  -- Don't match with yourself
  if v_target.player_id = p_claimer_id then
    return null;
  end if;

  -- Create a new game row (matches existing games table schema)
  insert into games (
    id, board, current_player,
    black_captures, white_captures, black_score, white_score,
    last_move, move_count, status, winner, win_reason,
    player_black_id, player_black, player_white_id, player_white,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    -- 19x19 empty board as JSON array
    (select jsonb_agg(row_arr) from (
      select jsonb_agg(0) as row_arr from generate_series(1, 19)
    ) sub cross join generate_series(1, 19)),
    1, -- BLACK goes first
    0, 0, 0, 0,
    null, 0, 'in_progress', null, null,
    v_target.player_id, v_target.player_name,
    p_claimer_id, p_claimer_name,
    now(), now()
  ) returning id into v_game_id;

  -- Update target queue row → matched
  update matchmaking_queue
    set status = 'matched',
        matched_game_id = v_game_id,
        matched_with = p_claimer_id
    where id = p_target_queue_id;

  -- Update claimer's queue row → matched (find their most recent waiting row)
  update matchmaking_queue
    set status = 'matched',
        matched_game_id = v_game_id,
        matched_with = v_target.player_id
    where player_id = p_claimer_id
      and status = 'waiting'
      and created_at > now() - interval '10 minutes';

  return v_game_id;
end;
$$ language plpgsql security invoker set search_path = public;
