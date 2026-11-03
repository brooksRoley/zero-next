# Cloudfall: design note

Cloudfall (`/games/cloudfall`) is a falling-block puzzle under a bright sky. It
adds about 1,750 lines, so this note records where they go and why.

## Where the lines are

| File | Lines | Job |
|---|---|---|
| `src/lib/games/cloudfall/engine.ts` | ~410 | Every rule: the 10×20 well (+2 hidden rows), seven pieces, seven-piece bag, wall kicks, lock delay, line clears, scoring, levels, hold, game over, and the sentence that explains each outcome |
| `src/lib/games/cloudfall/__tests__/engine.test.ts` | ~290 | 28 tests over the engine |
| `src/components/games/cloudfall/paint.ts` | ~300 | Canvas drawing only: candy blocks, the well, previews, the sky and hills |
| `src/components/games/cloudfall/SkyBackdrop.tsx` | ~60 | The parallax backdrop canvas |
| `src/pages/games/cloudfall.tsx` | ~630 | Input (keys, held-key repeat, touch pad), the frame loop, the HUD, events, best score, layout |

## Decisions and tradeoffs

- **Pure engine, page draws.** Every engine function returns a new state, so the tests replay
  games from a seed and the page can't break a rule by accident. Cost: a state copy per move,
  which doesn't matter for a 220-cell board.
- **Game state lives in a ref, not React state.** The frame loop advances and draws the ref
  60 times a second; React re-renders only when the HUD (score, lines, level, queue, hold,
  status, latest event) changes. Putting the whole state in `useState` would re-render the page
  every frame.
- **Standard kick table.** Rotation uses the widely documented kick offsets, so the game feels
  the way experienced players expect. Kick offsets are mechanics, not trade dress; the name,
  look and copy are original.
- **Lock delay of 500 ms with 15 resets.** Without it, a piece locks as soon as it touches,
  which feels unfair at high levels. The reset cap stops a player stalling forever.
- **No T-spins, combos or back-to-back bonuses.** Scoring is 100/300/500/800 × level plus drop
  points. Each extra rule is something the instruction line would have to explain. Add them
  only if play data shows people come back for more depth.
- **Touch: six buttons, no swipes.** Buttons are 56 px tall, repeat while held, and don't steal
  focus. Swipes were left out because a swipe that is read as a tap rotates the wrong piece,
  and the player can't see why.
- **One instruction line.** It shows how to start, then the current goal ("Fill a row…",
  "3 more rows to level 2"), and for 3.5 s after a clear it shows the reason for the score
  ("Double! 2 rows cleared: 300 × level 1 = 300 points."). The game-over card gives the reason
  the game ended.
- **Keyboard grace after game over.** For 0.8 s after the game ends, Space and Enter are
  ignored, so a player still pressing hard drop sees the game-over card before "Play again"
  restarts.
- **Backdrop at 30 fps, device pixel ratio capped at 1.5.** The sky is behind the game, so it
  doesn't need full frame rate. It pauses while the tab is hidden and draws a single still frame
  under `prefers-reduced-motion`.

## Not yet measured

The player metric for this game starts at zero, because the game is new: first-session finish
rate (`game_end` / `game_start` for `game: 'cloudfall'`). `game_end` carries score, lines,
level, pieces and the game-over reason.
