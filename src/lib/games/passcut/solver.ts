/**
 * Pass & Cut — exact game-tree solver (memoized minimax) for the Shannon
 * switching game. Signatures are FROZEN (shared contract); implementer fills
 * bodies. Runs on the main thread — the board is tiny (< 3^10 states).
 */
import type { Edge, EdgeKey, EdgeState, GameState, Level, Turn, Winner } from "./graph";
import { canonicalEdges, connected, edgeKey } from "./graph";

/** Canonical, order-stable list of a level's edges (sorted by key). */
function levelEdges(level: Level): Edge[] {
  return canonicalEdges(level.edges)
    .slice()
    .sort((x, y) => (edgeKey(x.a, x.b) < edgeKey(y.a, y.b) ? -1 : 1));
}

/** Terminal test for a fully-known state, or null if the game is undecided. */
function terminalWinner(
  level: Level,
  edges: Edge[],
  states: Record<EdgeKey, EdgeState>
): Winner | null {
  const secured: Edge[] = [];
  const nonCut: Edge[] = [];
  for (const e of edges) {
    const s = states[edgeKey(e.a, e.b)];
    if (s === "secured") {
      secured.push(e);
      nonCut.push(e);
    } else if (s === "free") {
      nonCut.push(e);
    }
  }
  // Offense wins the instant its SECURED edges connect the terminals.
  if (connected(level.terminals, secured)) return "offense";
  // Defense wins when the un-cut graph can no longer connect the terminals.
  if (!connected(level.terminals, nonCut)) return "defense";
  return null;
}

/** Memo signature: edge states in canonical order + whose turn it is. */
function signature(edges: Edge[], states: Record<EdgeKey, EdgeState>, turn: Turn): string {
  let sig = "";
  for (const e of edges) {
    const s = states[edgeKey(e.a, e.b)];
    sig += s === "secured" ? "s" : s === "cut" ? "c" : "f";
  }
  return sig + "|" + turn;
}

function solveRec(
  level: Level,
  edges: Edge[],
  states: Record<EdgeKey, EdgeState>,
  turn: Turn,
  memo: Map<string, Winner>
): Winner {
  const terminal = terminalWinner(level, edges, states);
  if (terminal) return terminal;

  const key = signature(edges, states, turn);
  const cached = memo.get(key);
  if (cached) return cached;

  const mover: Turn = turn;
  const next: Turn = mover === "offense" ? "defense" : "offense";
  const setTo: EdgeState = mover === "offense" ? "secured" : "cut";

  let result: Winner = mover === "offense" ? "defense" : "offense"; // worst case for mover
  for (const e of edges) {
    const ek = edgeKey(e.a, e.b);
    if (states[ek] !== "free") continue;
    states[ek] = setTo;
    const w = solveRec(level, edges, states, next, memo);
    states[ek] = "free";
    if (w === mover) {
      result = mover; // mover can force a win
      break;
    }
  }
  // If there were no free edges, the terminal test above must have decided the
  // game already (secured connects, or non-cut cannot connect), so this loop is
  // only reached with at least one free move available.

  memo.set(key, result);
  return result;
}

/** Winner under optimal play from `state`. */
export function solveValue(level: Level, state: GameState): Winner {
  const edges = levelEdges(level);
  const working: Record<EdgeKey, EdgeState> = { ...state.states };
  const memo = new Map<string, Winner>();
  return solveRec(level, edges, working, state.turn, memo);
}

/** Optimal edge for defense to cut from `state`, or null if no free edges. */
export function bestDefenseMove(level: Level, state: GameState): Edge | null {
  return bestMove(level, state, "defense");
}

/** Optimal edge for offense to secure from `state` (used for hints), or null. */
export function bestOffenseMove(level: Level, state: GameState): Edge | null {
  return bestMove(level, state, "offense");
}

/**
 * Shared optimal-move search for either side. Prefers a move that still yields
 * a win for `mover` under optimal continuation; if none exists (mover is losing
 * anyway) falls back to the first available free edge.
 */
function bestMove(level: Level, state: GameState, mover: Turn): Edge | null {
  const edges = levelEdges(level);
  const setTo: EdgeState = mover === "offense" ? "secured" : "cut";
  const next: Turn = mover === "offense" ? "defense" : "offense";
  const working: Record<EdgeKey, EdgeState> = { ...state.states };

  let fallback: Edge | null = null;
  for (const e of edges) {
    const ek = edgeKey(e.a, e.b);
    if (working[ek] !== "free") continue;
    if (fallback === null) fallback = e;
    const memo = new Map<string, Winner>();
    working[ek] = setTo;
    const w = solveRec(level, edges, working, next, memo);
    working[ek] = "free";
    if (w === mover) return e; // winning move
  }
  return fallback;
}
