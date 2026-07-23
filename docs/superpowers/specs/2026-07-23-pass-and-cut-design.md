# Pass & Cut — design spec

**Date:** 2026-07-23
**Route:** `/games/pass-and-cut`
**Livelihood:** Rung 2 (games / dwell → audience) + strong Rung 1 portfolio signal (a provably-correct game engine + a named theorem, sports-tech themed).

## Concept

A turn-based basketball game that IS the **Shannon switching game** on a small graph.
Five player-nodes sit at real half-court positions. Edges are candidate **pass lanes**.
Two terminals: the **inbounder (PG)** and the **finisher at the rim**.

- **You (offense)** *secure* one pass lane per turn.
- **Bot (defense)** *denies* one pass lane per turn.
- Secured lanes can't be denied.
- **Offense wins** the instant its secured lanes connect the two terminals.
- **Defense wins** when the un-denied graph can no longer connect them.

The teaching payload is **graph theory** (connectivity, paths, spanning trees, min-cut)
and the classic result: offense (moving second) has a guaranteed win **iff** two
edge-disjoint spanning connections between the terminals exist (Lehman's theorem).
Difficulty lives entirely in board design, never in bot mistakes.

## Delivery model

A **curated, finite concept campaign** — ~6–8 hand-authored levels, one concept each,
arcing: paths → connectivity → the winnable/unwinnable threshold → min-cut. After each
result a **teaching overlay** surfaces the "why" (names + highlights the cut on a loss;
can reveal the two edge-disjoint pass trees on a winnable board).

Progress persists in `localStorage` (like `education-tracker`). No Supabase in v1.
Every level frames a tip-jar link to `/funding`.

## Architecture — modules (each independently testable)

```
src/lib/games/passcut/graph.ts      // pure types + graph algorithms (CONTRACT — committed as stubs)
src/lib/games/passcut/solver.ts     // memoized exact minimax over edge states
src/lib/games/passcut/levels.ts     // curated campaign as data
src/lib/games/passcut/__tests__/    // vitest for graph + solver
src/components/games/PassCutBoard.tsx// SVG half-court board + interaction
src/pages/games/pass-and-cut.tsx     // page: campaign, teaching overlay, tip-jar frame
```

### Bot approach (decided)

**Exact game-tree solver.** Board is tiny (≤ ~10 edges → each edge `free|secured|cut`,
state space < 3^10). A memoized minimax computes the optimal move and the game value in
microseconds — provably optimal, no matroid code, **main thread (no Web Worker)**. A
separate analysis function computes the two-edge-disjoint-tree verdict + the minimal cut
purely to drive the teaching overlay.

## Interface contract (see `src/lib/games/passcut/graph.ts`)

Types: `NodeId`, `NodePos`, `Edge`, `EdgeKey`, `EdgeState`, `Level`, `GameState`, `Winner`.
Graph fns: `edgeKey`, `canonicalEdges`, `connected`, `offenseHasForcedWin`,
`twoEdgeDisjointTerminalTrees`, `minimalCut`.
Solver fns (solver.ts): `solveValue`, `bestDefenseMove`, `bestOffenseMove`.

Rules for the solver's terminal test, given a `GameState`:
- **offense wins** if the `secured` edges alone connect the two terminals.
- **defense wins** if the non-`cut` edges (secured ∪ free) cannot connect the terminals.
- otherwise recurse: offense turn picks a `free` edge → `secured`; defense turn picks a
  `free` edge → `cut`. Memoize on (sorted edge-state signature, turn).

`Level.intendedWinner` records the author's intended optimal-play outcome; integration
validates each authored level by asserting `solveValue(level, initialState) === intendedWinner`.

## Testing

vitest on the pure libs:
- `connected` correctness on known graphs.
- `twoEdgeDisjointTerminalTrees` verdict on known winnable/unwinnable graphs.
- `minimalCut` returns a genuine disconnecting set of minimum size.
- **solver optimality**: bot never loses a board where defense has a forced win; offense
  wins (under correct play) a board where offense has a forced win.
- every campaign level's `solveValue(initial) === intendedWinner`.

## Forward-compat (noted, not built)

`graph.ts`/`solver.ts` are parameterized by node count and terminal set, so the same engine
powers **1v1 → 5v5** later (bigger graphs). v1 fixes 5 nodes and the curated campaign.
