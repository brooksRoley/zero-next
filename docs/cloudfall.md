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
| `src/lib/games/cloudfall/dimensions.ts` | ~55 | Every size on screen: cell fit, well and frame, previews, aspect ratio |
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

## Dimensions

The engine owns the grid: 10 columns × 20 visible rows, plus 2 hidden rows above
where pieces spawn. `dimensions.ts` owns how big that grid is on a screen, and both
the full game and the Theater's backstage overlay read from it.

| Name | Value | Why |
|---|---|---|
| `CELL_MIN` / `CELL_MAX` | 14 / 32 px | Under 14 a piece is hard to read on a phone; over 32 the well no longer fits a 768 px-tall laptop with its chrome |
| `fitCell(vw, vh)` | whole px | The largest cell where the well, nav (64 px) and chrome fit. Chrome is 110 px on wide screens (instruction line) and 270 px on phones (title, score bar, touch pad). Width limits it only on phones, with a 16 px gutter each side. Whole pixels keep block edges crisp |
| `WIDE_MIN_W` | 1024 px | Side panels move beside the well |
| `WELL_FRAME` | 6 px | The 3 px border on each side, drawn outside the cells |
| `WELL_ASPECT` | 0.5 | The overlay is a CSS grid sized by `aspect-ratio`, so it scales with the viewport without measuring |
| `PREVIEW` | 44×26, 96×52, 120×60 | Bar, hold and next previews. Each is wider than tall so an I piece fits lying flat |

Measured: 390×844 gives a 25 px cell (500 px well); 1366×768 gives 29 px;
1440×900 and up hit the 32 px cap. `dimensions.test.ts` pins these.

## Shared with other games

Two pieces of Cloudfall's frame code were copied in a dozen components, so they
now live in `src/lib/ui/` for any game or backdrop to use:

- **`frameClock.ts`.** `startFrameClock(step, { maxStepMs, minFrameMs })` runs one
  `requestAnimationFrame` loop. Elapsed time is capped (100 ms by default) so a
  stalled tab never arrives as one huge gravity step, and `minFrameMs` caps
  backdrops at 30 fps. `createFixedStep(stepMs)` is the fixed-timestep
  accumulator for physics: frame time piles up and is spent in equal steps, so a
  simulation runs at the same speed on 60 Hz and 120 Hz screens. Cloudfall's
  engine doesn't need it, because gravity and lock delay already count elapsed
  ms. Physics that adds a fixed amount every frame (damping, velocity) does.
- **`canvas.ts`.** `fitCanvas(canvas, ctx, w, h, maxDpr)` sizes the backing store for
  the screen's pixel density and scales the context, so drawing code works in CSS
  pixels. The ratio is capped at 2 (1.5 for the sky), because a 3× screen costs 9×
  the fill for no visible gain on a soft backdrop.

Using them now: the Cloudfall page, the backstage overlay, the sky backdrop and
the home page's ridgelines. Next to adopt them, because they step per frame
today: `JumpshotSimulator`, `PhysicsField`, `PreText` and `luminous-flow`.

## Not yet measured

The player metric for this game starts at zero, because the game is new: first-session finish
rate (`game_end` / `game_start` for `game: 'cloudfall'`). `game_end` carries score, lines,
level, pieces and the game-over reason.
