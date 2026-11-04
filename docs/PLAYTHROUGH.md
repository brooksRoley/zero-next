# Playthrough and tutorials for the game catalogue

Design, 2026-10-30. Nothing here is built yet. Build order and gating are at
the end.

## Why

The Theater lists eleven productions. A first-time visitor gets a playbill and
a board, and has to work out each game's rules alone. A hiring manager gets
the same thing and has no idea which parts are hard engineering. Only Go has a
real learn track (`/posts/go/learn/[stage]`), and Tend has its journal
chapters. Everything else teaches by rules paragraph, or not at all.

This design serves three readers at once:

1. **A first-time player.** Their first minute should already be fun, in any game.
2. **A hiring manager for a game-client or UI role.** They get a three-minute
   guided playthrough that shows the craft and ends at the resume.
3. **The builder.** Input-aware prompts, focus management and onboarding are
   game-client UI work, and this makes that work visible.

## Principles

These come from the delight philosophy and `docs/ART_DIRECTION.md`.

- **Teach by doing, one verb at a time.** Each step asks for one action and waits
  for the game to report it. No step is a wall of text. A step says at most 12 words.
- **The game is the teacher.** The coach points at the thing and names the verb.
  The game's own feedback (a capture, a severed lane, a won round) is the reward.
- **Specific or silent.** "Captured. That pair is gone for good." beats "Great job!"
- **Always skippable, never blocking.** Skip and Replay are on every step. A
  player who already knows the game is one press from the board.
- **Speaks the player's input.** Prompts name the device in hand: Click / Tap /
  Enter / Ⓐ. A prompt that says "click" to a gamepad player is a bug.
- **Remembers, never nags.** Progress goes to the play journal. A finished
  tutorial doesn't come back unless asked for. No streaks, no "you haven't played in…".
- **Reduced motion still teaches.** With motion off, the spotlight is a static
  outline and the copy carries everything.

## The shared system

One small library, so eleven games don't grow eleven tutorial engines.

```
src/lib/tutorial/
  types.ts       Step, Tutorial, InputKind
  runner.ts      pure state machine: current step, advance on matching event, skip, replay
  inputKind.ts   last-used input: pointer | touch | keyboard | gamepad (listens, never polls)
  glyphs.ts      verb x InputKind -> label ("place": Click / Tap / Enter / Ⓐ)
src/components/tutorial/
  Coach.tsx      the overlay: spotlight on a target, one line, Skip / Replay
  InputGlyph.tsx renders the right glyph for the current input
```

**A step:**

```ts
type Step = {
  id: string
  say: string                       // <= 12 words; the test enforces it
  target?: string                   // data-tutorial="…" on the element to spotlight
  verb?: Verb                       // drives the input glyph: place, select, confirm, drag…
  until: (e: GameEvent) => boolean  // advance when the game reports this
  after?: string                    // one line of specific feedback once it happens
}
```

- **Events, not timers.** Games already speak through `trackGame()` (game_start,
  game_end, puzzle_solved…). Tutorials add a local event bus with the finer verbs
  (`stone_placed`, `capture`, `lane_cut`), so a step advances when the thing
  actually happened.
- **Targets by attribute.** `data-tutorial="draft-bench"` on the element. A test
  renders each game and fails if a step's target is missing, so a refactor
  can't strand a tutorial.
- **Completion.** Finishing fires `tutorial_stage_complete` → play journal →
  the Theater shows a quiet "learned" mark. `visitorStats.ts` already counts these.
- **Gamepad.** The focus navigator from the controller-navigation campaign (D-pad
  moves focus, Ⓐ activates, Ⓑ backs out) drives the Coach's Skip/Replay and
  every tutorial target. Every tutorial must be completable with only a gamepad
  and only a keyboard; tests simulate both.

## Per-game first play

Three steps each: the core verb, the "aha", and one finish. These are drafted
from each game's playbill and code. **Confirm each by playing it** (the Players
rule) before building.

| Game | Verb | Step 1 | Step 2 (the aha) | Step 3 | Notes |
|---|---|---|---|---|---|
| Hardwood | draft, set scheme | Draft a player from the bench | Set a scheme, then watch round 1 resolve | Read the result line: "a ghost board, someone's saved squad" | The flagship. Also the tour's first stop. |
| Pente | place | Place a stone | Capture a pair (a set-up position) | Make four in a row: "they must block now" | Uses the existing minimax bot on easy. |
| Pente Puzzles | solve | Solve one curated easy puzzle | Use one hint from the ladder | See the ELO move | Already has an ELO; the tutorial only frames it. |
| Go | — | Link to the learn track | — | — | Don't duplicate. First visit offers "New to Go? A three-minute start." |
| Go Puzzles | solve | One life-and-death problem with the tutor | | | Reuses the Go tutor's asking style. |
| Pass & Cut | cut | Cut one defensive edge | Watch a passing lane open | Clear level 1 | Graph shown; the tour's second stop. |
| Read & React | pick | Pick a play | See the EV matrix reveal why | Beat the minimax once | The matrix is the lesson; spotlight it. |
| Playoff Moments | click the spot | Click where the play goes | See what history did | Next moment | Already one verb; one coach line is enough. |
| Nanu Pika TD | place, upgrade | Place a tower | Start the wave | Upgrade once | Campaign level 1 is the tutorial; add coach lines. |
| Tend | — | Existing journal chapters | — | — | Keep as is; add `data-tutorial` targets only. |
| Luminous Flow | move | "Move." | — | — | Not a game; one line, no steps. |

## The playthrough: "Director's cut"

A guided tour of the catalogue for someone deciding whether to hire the person
who built it. Reached from the Theater ("Take the three-minute tour") and the
Hardwood card on the home page. Route: `/theater/tour`.

**Three stops, about a minute each.** Each stop plays the game's own first-play
tutorial, with a **director's note** beside the board: two or three sentences
on what is happening under it, with a link to the code.

1. **Hardwood: the client and the engine.** Draft and fight one round. Note: a
   C++ engine compiled to WebAssembly, under a Vue client, inside a launcher that
   ships a one-line change as 16 KB of a 1.07 MB build.
2. **Pass & Cut: the solver.** Cut a lane. Note: the level is a graph, and a
   solver checks every level is winnable before it ships.
3. **Pente: the opponent.** Play five moves against the bot. Note: a minimax
   search runs in a Web Worker, so the board never stutters while it thinks.

**The end card** says what the tour showed in one line, then Resume and Email me.
No score, no "you completed the tour!".

The whole tour runs on a gamepad. A small line on the first stop says
"Controller connected: the whole tour works from here." That line is the
controller-navigation campaign's ship.

## Measuring it

Measure with what `analytics.ts` / `visitorStats.ts` already record; no new tracking:

- Tutorial completion rate per game (`tutorial_stage_complete` / `game_start`).
- Time to the first `game_end` for a first-time visitor, before and after.
- Tour: stops reached, and how many end-card visits go on to `/resume`.

## Build order

Each phase ships something a visitor can use on its own.

1. **Phase 1 is the controller navigation.** Build
   `inputKind`, `glyphs`, the focus navigator, and Coach on **Hardwood only**.
   Ship it, then write a devlog about it.
2. **Phase 2 is the tour,** with three stops and the director's notes. Link it
   from the Hardwood case study.
3. **Phase 3 is the rest of the catalogue,** one game per week. Each one gets a
   Players playtest row before it merges.

## Tests

- Every step's `say` is 12 words or fewer, and every `target` exists in its
  rendered game.
- Each tutorial can be completed by simulated pointer, keyboard and gamepad events.
- Skip is reachable from every step on all three input kinds.
- With reduced motion on, the Coach renders no animation and still shows every line.
- Glyphs: no step shows "Click" while the last input was a gamepad.
