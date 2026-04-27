# Pente Online Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FCFS matchmaking queue where players play the adaptive bot while waiting, then confirm and transition to multiplayer when an opponent is found.

**Architecture:** New `useMatchmaking` hook manages Supabase queue row + realtime subscription. The pente.js page gains a `BOT_WHILE_QUEUING` state that runs a normal adaptive bot game with a persistent queue banner. Match confirmation uses an overlay modal with a 15-second countdown. Supabase `claim_match` RPC handles atomic match creation.

**Tech Stack:** Supabase (realtime, RPC), React hooks, existing BotWorkerManager + adaptive bot config, existing `useMultiplayerGame` hook.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/matchmaking_queue.sql` | **New** — DDL for `matchmaking_queue` table + `claim_match` RPC |
| `src/hooks/useMatchmaking.js` | **New** — Queue state machine, realtime subscription, opponent polling, match claim |
| `src/components/pente/QueueBanner.js` | **New** — Persistent "in queue" banner with leave button |
| `src/components/pente/MatchConfirmModal.js` | **New** — Match found overlay with accept/decline + 15s countdown |
| `src/pages/posts/pente.js` | **Modified** — Wire matchmaking into mode selector + game state machine |

**Unchanged:** `useMultiplayerGame.js`, `adaptiveBot.js`, `penteWorker.js`, `botWorker.js`, `usePlayerProfile.js`, all API routes.

---

### Task 1: Supabase SQL — `matchmaking_queue` table + `claim_match` RPC

**Files:**
- Create: `supabase/matchmaking_queue.sql`

- [ ] **Step 1: Write the SQL migration file**

```sql
-- supabase/matchmaking_queue.sql
-- Run this in Supabase SQL editor to create the matchmaking infrastructure.

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

-- Enable realtime on the table
alter publication supabase_realtime add table matchmaking_queue;

-- Atomic match claim RPC
-- Takes: claimer's player_id/name/elo, target queue row id
-- Returns: game_id on success, null on conflict
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
$$ language plpgsql security definer;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/matchmaking_queue.sql
git commit -m "feat(pente): add matchmaking_queue table and claim_match RPC SQL"
```

> **Note:** This SQL must be run manually in the Supabase SQL editor before the frontend features will work. The file serves as documentation and version control for the schema.

---

### Task 2: `useMatchmaking` hook

**Files:**
- Create: `src/hooks/useMatchmaking.js`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useMatchmaking.test.js`:

```js
import { renderHook, act } from '@testing-library/react'

// Mock supabase before importing the hook
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
const mockOn = jest.fn().mockReturnValue({ subscribe: mockSubscribe })
const mockChannel = jest.fn().mockReturnValue({ on: mockOn })
const mockRemoveChannel = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('src/lib/supabase', () => ({
  supabase: {
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    from: mockFrom,
    rpc: mockRpc,
  },
}))

import useMatchmaking from '../useMatchmaking'

describe('useMatchmaking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: from().select()... returns empty waiting list
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          neq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })
  })

  it('starts in idle status', () => {
    const { result } = renderHook(() =>
      useMatchmaking('player-1', 'Alice', 800)
    )
    expect(result.current.queueStatus).toBe('idle')
    expect(result.current.opponent).toBeNull()
    expect(result.current.matchedGameId).toBeNull()
  })

  it('exposes enterQueue and leaveQueue functions', () => {
    const { result } = renderHook(() =>
      useMatchmaking('player-1', 'Alice', 800)
    )
    expect(typeof result.current.enterQueue).toBe('function')
    expect(typeof result.current.leaveQueue).toBe('function')
    expect(typeof result.current.acceptMatch).toBe('function')
    expect(typeof result.current.declineMatch).toBe('function')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/hooks/__tests__/useMatchmaking.test.js --no-cache`
Expected: FAIL with "Cannot find module '../useMatchmaking'"

- [ ] **Step 3: Write the `useMatchmaking` hook**

```js
// src/hooks/useMatchmaking.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from 'src/lib/supabase'

const STALE_MINUTES = 10
const CONFIRM_SECONDS = 15
const POLL_INTERVAL_MS = 3000

export default function useMatchmaking(playerId, playerName, playerElo) {
  const [queueStatus, setQueueStatus] = useState('idle') // idle | queuing | matched | confirming
  const [opponent, setOpponent] = useState(null) // { name, elo }
  const [matchedGameId, setMatchedGameId] = useState(null)
  const [confirmTimer, setConfirmTimer] = useState(0)
  const [queueRowId, setQueueRowId] = useState(null)

  const channelRef = useRef(null)
  const pollRef = useRef(null)
  const timerRef = useRef(null)

  // Clean up realtime subscription
  const cleanupChannel = useCallback(() => {
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  // Clean up polling
  const cleanupPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Clean up confirm timer
  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Enter the matchmaking queue
  const enterQueue = useCallback(async () => {
    if (!supabase || !playerId || queueStatus !== 'idle') return

    // Upsert into queue
    const { data, error } = await supabase
      .from('matchmaking_queue')
      .insert({
        player_id: playerId,
        player_name: playerName || 'Anonymous',
        player_elo: playerElo,
        status: 'waiting',
      })
      .select('id')
      .single()

    if (error || !data) return

    const rowId = data.id
    setQueueRowId(rowId)
    setQueueStatus('queuing')

    // Subscribe to realtime changes on our queue row
    const channel = supabase
      .channel(`queue:${rowId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `id=eq.${rowId}`,
      }, (payload) => {
        const row = payload.new
        if (row.status === 'matched' && row.matched_game_id) {
          // We got matched by someone else's claim
          setMatchedGameId(row.matched_game_id)
          setQueueStatus('confirming')
          cleanupPoll()
          // We need opponent info — fetch from the game
          fetchOpponentFromGame(row.matched_game_id)
        }
      })
      .subscribe()

    channelRef.current = channel

    // Poll for waiting opponents to claim
    const poll = async () => {
      if (!supabase) return
      const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()
      const { data: waiters } = await supabase
        .from('matchmaking_queue')
        .select('id, player_id, player_name, player_elo')
        .eq('status', 'waiting')
        .neq('player_id', playerId)
        .gt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(1)

      if (!waiters || waiters.length === 0) return

      const target = waiters[0]
      const { data: gameId } = await supabase.rpc('claim_match', {
        p_claimer_id: playerId,
        p_claimer_name: playerName || 'Anonymous',
        p_claimer_elo: playerElo,
        p_target_queue_id: target.id,
      })

      if (gameId) {
        setOpponent({ name: target.player_name, elo: target.player_elo })
        setMatchedGameId(gameId)
        setQueueStatus('confirming')
        cleanupPoll()
      }
    }

    // First poll immediately, then on interval
    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
  }, [playerId, playerName, playerElo, queueStatus, cleanupPoll])

  // Fetch opponent info from the game row (when matched by the other player)
  const fetchOpponentFromGame = useCallback(async (gameId) => {
    if (!supabase) return
    const { data: game } = await supabase
      .from('games')
      .select('player_black, player_white, player_black_id, player_white_id')
      .eq('id', gameId)
      .single()

    if (!game) return

    // The opponent is whichever player isn't us
    if (game.player_black_id === playerId) {
      setOpponent({ name: game.player_white, elo: playerElo }) // approx
    } else {
      setOpponent({ name: game.player_black, elo: playerElo })
    }
  }, [playerId, playerElo])

  // Start confirm countdown when entering confirming state
  useEffect(() => {
    if (queueStatus !== 'confirming') {
      cleanupTimer()
      return
    }

    setConfirmTimer(CONFIRM_SECONDS)
    timerRef.current = setInterval(() => {
      setConfirmTimer(prev => {
        if (prev <= 1) {
          // Timeout — treat as decline
          handleDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return cleanupTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueStatus])

  // Accept match — navigate to game
  const acceptMatch = useCallback(() => {
    cleanupTimer()
    cleanupChannel()
    cleanupPoll()
    setQueueStatus('idle')
    // matchedGameId stays set — the page reads it to navigate
  }, [cleanupTimer, cleanupChannel, cleanupPoll])

  // Decline match — back to queuing
  const handleDecline = useCallback(async () => {
    cleanupTimer()
    const currentGameId = matchedGameId

    // Reset match state
    setOpponent(null)
    setMatchedGameId(null)
    setQueueStatus('idle')
    cleanupChannel()
    cleanupPoll()

    // Cancel the old queue row
    if (supabase && queueRowId) {
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueRowId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupTimer, cleanupChannel, cleanupPoll, queueRowId, matchedGameId])

  const declineMatch = useCallback(() => {
    handleDecline()
  }, [handleDecline])

  // Leave queue entirely
  const leaveQueue = useCallback(async () => {
    cleanupChannel()
    cleanupPoll()
    cleanupTimer()

    if (supabase && queueRowId) {
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueRowId)
    }

    setQueueStatus('idle')
    setOpponent(null)
    setMatchedGameId(null)
    setQueueRowId(null)
    setConfirmTimer(0)
  }, [cleanupChannel, cleanupPoll, cleanupTimer, queueRowId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannel()
      cleanupPoll()
      cleanupTimer()
    }
  }, [cleanupChannel, cleanupPoll, cleanupTimer])

  return {
    queueStatus,
    opponent,
    matchedGameId,
    confirmTimer,
    enterQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/hooks/__tests__/useMatchmaking.test.js --no-cache`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMatchmaking.js src/hooks/__tests__/useMatchmaking.test.js
git commit -m "feat(pente): add useMatchmaking hook with queue + realtime + claim"
```

---

### Task 3: `QueueBanner` component

**Files:**
- Create: `src/components/pente/QueueBanner.js`

- [ ] **Step 1: Write the component**

```js
// src/components/pente/QueueBanner.js
export default function QueueBanner({ onLeave }) {
  return (
    <div className="mx-3 mb-2 rounded-lg bg-cyan-900/30 border border-cyan-700/40 px-3 py-2 flex items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
      </span>
      <span className="text-xs text-cyan-200 flex-1">
        In queue — playing bot while waiting...
      </span>
      <button
        onClick={onLeave}
        className="text-xs px-2 py-1 rounded-md bg-forest-800/60 text-forest-300 hover:text-white hover:bg-forest-700/60 border border-forest-700/40 transition-colors"
      >
        Leave Queue
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pente/QueueBanner.js
git commit -m "feat(pente): add QueueBanner component"
```

---

### Task 4: `MatchConfirmModal` component

**Files:**
- Create: `src/components/pente/MatchConfirmModal.js`

- [ ] **Step 1: Write the component**

```js
// src/components/pente/MatchConfirmModal.js
export default function MatchConfirmModal({ opponent, confirmTimer, onAccept, onDecline }) {
  if (!opponent) return null

  const urgency = confirmTimer <= 5

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-forest-950/80 backdrop-blur-sm rounded-xl">
      <div className="bg-forest-900 border border-forest-700/60 rounded-xl p-5 max-w-xs w-full mx-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-white mb-1">Opponent found!</h3>
        <p className="text-xs text-forest-300 mb-4">
          <span className="text-white font-medium">{opponent.name}</span>
          {opponent.elo != null && (
            <span className="text-forest-400 ml-1">(~{opponent.elo} ELO)</span>
          )}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold text-sm hover:from-candy-400 hover:to-candy-500 transition-all"
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2 rounded-lg bg-forest-800 text-forest-300 text-sm border border-forest-700/40 hover:bg-forest-700/60 hover:text-white transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Countdown */}
        <div className="text-center">
          <span className={`text-xs font-mono ${urgency ? 'text-red-400' : 'text-forest-500'}`}>
            {confirmTimer}s
          </span>
          <div className="mt-1 h-1 rounded-full bg-forest-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${urgency ? 'bg-red-500' : 'bg-cyan-500'}`}
              style={{ width: `${(confirmTimer / 15) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pente/MatchConfirmModal.js
git commit -m "feat(pente): add MatchConfirmModal component"
```

---

### Task 5: Wire matchmaking into pente.js — imports and state

**Files:**
- Modify: `src/pages/posts/pente.js`

- [ ] **Step 1: Add imports**

At the top of pente.js, after the existing imports (line 23), add:

```js
import useMatchmaking from 'src/hooks/useMatchmaking';
import QueueBanner from 'src/components/pente/QueueBanner';
import MatchConfirmModal from 'src/components/pente/MatchConfirmModal';
```

- [ ] **Step 2: Add the `useMatchmaking` hook call**

After the `useMultiplayerGame` hook call (after line 145), add:

```js
  // ── Matchmaking state ──
  const mm = useMatchmaking(playerId, playerName, playerElo);
  const isQueuing = mm.queueStatus === 'queuing' || mm.queueStatus === 'confirming';
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): wire useMatchmaking hook into pente page"
```

---

### Task 6: Wire matchmaking into pente.js — mode switching and Online flow

**Files:**
- Modify: `src/pages/posts/pente.js`

- [ ] **Step 1: Modify `switchPreset` to start bot + queue when Online is selected**

Replace the existing online case in `switchPreset` (lines 484-488):

Old:
```js
    if (presetKey === 'online') {
      setGameMode(null);
      setBotInstances([]);
      return;
    }
```

New:
```js
    if (presetKey === 'online') {
      // Start adaptive bot game while queuing
      setGameMode(null);
      const bots = [new PenteBot(WHITE, 'expert', null)];
      setBotInstances(bots);
      resetLocalBoard();
      // Enter matchmaking queue
      mm.enterQueue();
      if (gameId) router.push('/posts/pente', undefined, { shallow: true });
      return;
    }
```

- [ ] **Step 2: Handle match acceptance — navigate to game**

After the `switchPreset` function (after line 510), add an effect to handle accepted matches:

```js
  // When a match is accepted and we have a game ID, navigate to it
  useEffect(() => {
    if (mm.queueStatus === 'idle' && mm.matchedGameId) {
      // Match was accepted — switch to online game
      setBotInstances([]);
      setBotThinking(false);
      setModePreset('online');
      router.push(`/posts/pente?game=${mm.matchedGameId}`, undefined, { shallow: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.queueStatus, mm.matchedGameId]);
```

- [ ] **Step 3: Handle leaving queue — clean up bots**

Wrap `leaveQueue` to also reset bot state. Add after the effect above:

```js
  const handleLeaveQueue = useCallback(() => {
    mm.leaveQueue();
    setBotInstances([]);
    setBotThinking(false);
    resetLocalBoard();
    setModePreset('local');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.leaveQueue]);
```

- [ ] **Step 4: Update `showLobby` condition**

Replace the `showLobby` line (line 526):

Old:
```js
  const showLobby   = mode === 'online' && !gameId;
```

New:
```js
  const showLobby = mode === 'online' && !gameId && !isQueuing;
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): wire Online mode to start bot game + enter queue"
```

---

### Task 7: Wire matchmaking into pente.js — queue banner and match modal UI

**Files:**
- Modify: `src/pages/posts/pente.js`

- [ ] **Step 1: Add QueueBanner to the header**

After the adaptive bot ELO display block (after line 639, the closing `</div>` and `)}` of the bot ELO section), add:

```jsx
        {/* Queue banner — shown while matchmaking */}
        {isQueuing && (
          <QueueBanner onLeave={handleLeaveQueue} />
        )}
```

- [ ] **Step 2: Add MatchConfirmModal overlaying the board**

Inside the board container `<div className="relative">` (around line 835), after the `InterventionCard` and training puzzle sections, before the closing `</div>` of the relative container, add:

```jsx
            {/* Match confirm overlay */}
            {mm.queueStatus === 'confirming' && (
              <MatchConfirmModal
                opponent={mm.opponent}
                confirmTimer={mm.confirmTimer}
                onAccept={mm.acceptMatch}
                onDecline={mm.declineMatch}
              />
            )}
```

- [ ] **Step 3: Show board (not lobby) when queuing**

The `showLobby` change from Task 6 already handles this — when queuing, `showLobby` is false so the board renders. The bot auto-play effect already runs because `botInstances` are set. Verify this works by checking that `!showLobby` is true when `isQueuing` is true.

- [ ] **Step 4: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): add queue banner and match confirm modal to game UI"
```

---

### Task 8: Post-game re-queue flow

**Files:**
- Modify: `src/pages/posts/pente.js`

- [ ] **Step 1: Add "Play Again (Queue)" button to the game-over drawer for online games**

In the game-over drawer section (around line 917), the current condition is `{gameOver && !isOnline && (`. We need a separate block for post-multiplayer-game results. After the existing game-over drawer closing tag (around line 1001), add:

```jsx
      {/* Post-multiplayer game result */}
      {isOnline && mp.gameStatus === 'finished' && (
        <div className="flex-shrink-0 border-t border-forest-700/40 bg-forest-900/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: mp.winner === 1 ? '#1a1a1a' : '#fff' }}
              />
              {mp.winner === mp.myColor ? 'You Win!' : 'You Lost'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Re-queue: go back to bot-while-waiting
                  router.push('/posts/pente', undefined, { shallow: true });
                  setModePreset('online');
                  const bots = [new PenteBot(WHITE, 'expert', null)];
                  setBotInstances(bots);
                  resetLocalBoard();
                  mm.enterQueue();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-candy-500 to-candy-600 text-white font-semibold hover:from-candy-400 hover:to-candy-500 transition-all"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  router.push('/posts/pente', undefined, { shallow: true });
                  setModePreset('local');
                  setGameMode(null);
                  setBotInstances([]);
                  resetLocalBoard();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-forest-700/60 text-white border border-forest-600 hover:bg-forest-600/60 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): add post-multiplayer re-queue flow"
```

---

### Task 9: Integration test — full flow verification

**Files:**
- No new files

- [ ] **Step 1: Verify the build compiles**

Run: `yarn build`
Expected: Build succeeds with no TypeScript or import errors.

- [ ] **Step 2: Manual smoke test checklist**

1. Start dev server: `yarn dev`
2. Navigate to `/posts/pente`
3. Click "Online" tab → should see board with bot game + queue banner (if Supabase is configured)
4. Click "Leave Queue" → should return to local mode
5. Click "Online" again → bot game starts, banner shows
6. Open a second browser tab with different player → second player enters queue
7. First player claims match → both see confirm modal with 15s countdown
8. Accept → both navigate to multiplayer game
9. Decline → bot game resumes, stays in queue
10. Let timer expire → treated as decline

- [ ] **Step 3: Commit any fixes**

If build or smoke test reveals issues, fix and commit.

---

### Task 10: Cleanup and final commit

**Files:**
- Possibly `src/pages/posts/pente.js` (if any cleanup needed)

- [ ] **Step 1: Run lint**

Run: `yarn lint`
Expected: No errors on modified files.

- [ ] **Step 2: Final verification build**

Run: `yarn build`
Expected: Clean build.

- [ ] **Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(pente): lint fixes for matchmaking feature"
```
