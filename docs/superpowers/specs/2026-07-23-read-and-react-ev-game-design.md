# Read & React — EV matrix game (design spec)

**Date:** 2026-07-23
**Route:** `/games/read-and-react`
**Livelihood:** Rung 2 (games/dwell) + Rung 1 signal (game theory + expected value, sports-tech register).

## Concept

A zero-sum matrix game in a jersey. Rows = **offense plays**, columns = **defense schemes**;
each cell is the **expected points** (EV) of that matchup, grounded in the TFT `ZONES`
(`makePct × pts`) shifted by each scheme's coverage. Optimal play is a **mixed-strategy
equilibrium** (von Neumann minimax): you must vary your looks or a smart defense keys on you.

## Mode (decided)

A **~12-possession series** vs an **adaptive defense**. Each possession: the player picks a
play; the defense **best-responds to the player's tendencies so far** (fictitious play, with a
smoothed early game so it doesn't insta-counter move 1); the shot **resolves randomly** by the
scheme-adjusted make% → 0/2/3 real points. A live readout shows realized points vs the
**equilibrium benchmark** (`V × possessions`). Spam one play → the defense counters and points
crater. End-of-level **reveals the equilibrium mix + game value V** and why the predictable
pick got punished.

## Architecture — modules (each independently testable)

```
src/lib/games/readreact/matrixGame.ts   // pure zero-sum solver + best-response
src/lib/games/readreact/defense.ts      // adaptive bot (smoothed best-response-to-history)
src/lib/games/readreact/levels.ts       // curated campaign as data
src/lib/games/readreact/__tests__/      // solver, defense, level-equilibrium guard
src/components/games/ReadReactBoard.tsx  // play-caller UI: shot buttons, ticker, points vs benchmark
src/pages/games/read-and-react.tsx       // campaign, localStorage, equilibrium reveal, /funding frame
```

### Two distinct "smart" pieces (on purpose)
- **Exact-ish equilibrium solver** (`matrixGame.ts`): `solveZeroSum(A)` via **fictitious play**
  (converges to the value for zero-sum games; Robinson 1951). Used for the benchmark `V` and the
  end-of-level reveal. Cross-checked in tests against known games (RPS → 0/uniform, matching
  pennies → 0, dominant → pure) and against each level's `intendedType`.
- **In-game defense** (`defense.ts`): exact **best-response to the player's smoothed empirical
  play frequency** each possession — so the player's choices actually change the outcome (agency +
  the lesson). `bestResponseColumn(A, rowMix)` is a trivial exact argmin.

### Level data model
`RRLevel`: `plays[]` (id, label, pts 2|3), `schemes[]` (id, label), `makeGrid[play][scheme]`
(scheme-adjusted make%), `teaching`, `intendedType` ("dominant" | "mixed"), `possessions` (default 12).
EV matrix `A[i][j] = makeGrid[i][j] * plays[i].pts` is derived (single source of truth); it feeds
both the solver and random shot resolution.

## Campaign (~5–6 levels, concept per level)

dominant strategy (take the open shot) → no-dominant 2×2 (must mix) → 3×3 pick-your-poison →
a trap where the highest-single-EV shot is the most exploitable (mixing in a lower-EV shot raises
the floor) → a scheme-flavored level (blitz walls the paint but concedes threes). Numbers grounded
in `ZONES` base EV + scheme intent.

## Testing

- Solver on known games (RPS, matching pennies, dominant) within tolerance.
- `bestResponseColumn` exactness on hand matrices.
- Level guard: each level's solved equilibrium matches `intendedType` (dominant → ~pure row mix;
  mixed → no single row prob ≈ 1).
- jsdom component test: repeatedly calling the same play makes the defense counter it (its chosen
  scheme converges to that play's best-response column; the play's shown EV drops).

## Forward-compat (noted, not built)

The matrix engine is generic (any zero-sum payoff grid), so it backs future "pick your poison"
mechanics and slots into the NvN vision. v1 fixes the curated campaign.
