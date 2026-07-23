import { describe, it, expect } from "vitest";
import {
  edgeKey,
  canonicalEdges,
  connected,
  initialState,
  offenseHasForcedWin,
} from "../graph";
import type { Edge, EdgeState, GameState, Level, NodeId, Winner } from "../graph";
import { solveValue, bestDefenseMove, bestOffenseMove } from "../solver";

const E = (a: NodeId, b: NodeId): Edge => ({ a, b });

/** Build a bare Level; node positions are irrelevant to the engine. */
function mkLevel(
  id: string,
  edges: Edge[],
  terminals: [NodeId, NodeId],
  intendedWinner: Winner,
  firstMove?: "offense" | "defense"
): Level {
  const ids = new Set<NodeId>();
  for (const e of edges) {
    ids.add(e.a);
    ids.add(e.b);
  }
  return {
    id,
    title: id,
    concept: "test",
    nodes: [...ids].map((n) => ({ id: n, label: n, x: 0, y: 0 })),
    edges,
    terminals,
    teaching: "",
    firstMove,
    intendedWinner,
  };
}

/** Winner if the game is decided in this state, else null. */
function decided(level: Level, state: GameState): Winner | null {
  const edges = canonicalEdges(level.edges);
  const secured: Edge[] = [];
  const nonCut: Edge[] = [];
  for (const e of edges) {
    const s = state.states[edgeKey(e.a, e.b)];
    if (s === "secured") {
      secured.push(e);
      nonCut.push(e);
    } else if (s === "free") {
      nonCut.push(e);
    }
  }
  if (connected(level.terminals, secured)) return "offense";
  if (!connected(level.terminals, nonCut)) return "defense";
  return null;
}

/** Play both sides with their optimal move functions; return the winner. */
function playOptimally(level: Level): Winner {
  let state = initialState(level);
  for (let guard = 0; guard < 100; guard++) {
    const d = decided(level, state);
    if (d) return d;
    const mv =
      state.turn === "offense"
        ? bestOffenseMove(level, state)
        : bestDefenseMove(level, state);
    if (!mv) break;
    const setTo: EdgeState = state.turn === "offense" ? "secured" : "cut";
    state = {
      states: { ...state.states, [edgeKey(mv.a, mv.b)]: setTo },
      turn: state.turn === "offense" ? "defense" : "offense",
    };
  }
  // Fallback: resolve by the terminal rule on the final state.
  return decided(level, state) ?? "defense";
}

// --- Hand-authored boards ---------------------------------------------------

// K4 on {s,t,a,b}: offense wins even moving SECOND (two edge-disjoint trees).
const k4Edges = [
  E("s", "t"),
  E("s", "a"),
  E("s", "b"),
  E("t", "a"),
  E("t", "b"),
  E("a", "b"),
];
const k4OffenseSecond = mkLevel("k4-2nd", k4Edges, ["s", "t"], "offense", "defense");
const k4OffenseFirst = mkLevel("k4-1st", k4Edges, ["s", "t"], "offense", "offense");

// Triangle: offense moving FIRST wins (grab the direct lane); moving SECOND loses.
const triEdges = [E("s", "t"), E("s", "w"), E("w", "t")];
const triangleOffenseFirst = mkLevel("tri-1st", triEdges, ["s", "t"], "offense", "offense");
const triangleOffenseSecond = mkLevel("tri-2nd", triEdges, ["s", "t"], "defense", "defense");

// Single path s-w-t: defense wins regardless of who moves first.
const pathEdges = [E("s", "w"), E("w", "t")];
const pathOffenseFirst = mkLevel("path-1st", pathEdges, ["s", "t"], "defense", "offense");

// Two independent 2-edge paths s-w-t and s-x-t: defense still wins (each path
// needs two secures but defense cuts the second link of whichever path offense
// commits to). A good "looks winnable, isn't" board.
const twoPathEdges = [E("s", "w"), E("w", "t"), E("s", "x"), E("x", "t")];
const twoPathOffenseFirst = mkLevel("2path-1st", twoPathEdges, ["s", "t"], "defense", "offense");

const allBoards = [
  k4OffenseSecond,
  k4OffenseFirst,
  triangleOffenseFirst,
  triangleOffenseSecond,
  pathOffenseFirst,
  twoPathOffenseFirst,
];

describe("solveValue — matches intended winner", () => {
  for (const level of allBoards) {
    it(`${level.id} → ${level.intendedWinner}`, () => {
      expect(solveValue(level, initialState(level))).toBe(level.intendedWinner);
    });
  }
});

describe("defense-forced boards: solver never loses on defense", () => {
  for (const level of [triangleOffenseSecond, pathOffenseFirst, twoPathOffenseFirst]) {
    it(`${level.id}: optimal defense wins`, () => {
      expect(solveValue(level, initialState(level))).toBe("defense");
      expect(playOptimally(level)).toBe("defense");
    });
  }
});

describe("offense-forced boards: offense wins under optimal play", () => {
  for (const level of [k4OffenseSecond, k4OffenseFirst, triangleOffenseFirst]) {
    it(`${level.id}: optimal offense wins`, () => {
      expect(solveValue(level, initialState(level))).toBe("offense");
      expect(playOptimally(level)).toBe("offense");
    });
  }
});

describe("offenseHasForcedWin agrees with minimax on every board", () => {
  for (const level of allBoards) {
    it(`${level.id}`, () => {
      const theorem = offenseHasForcedWin(level);
      const minimax = solveValue(level, initialState(level)) === "offense";
      expect(theorem).toBe(minimax);
    });
  }
});

describe("best-move helpers", () => {
  it("returns null when no free edges remain", () => {
    const level = pathOffenseFirst;
    const state: GameState = {
      states: { [edgeKey("s", "w")]: "cut", [edgeKey("w", "t")]: "cut" },
      turn: "defense",
    };
    expect(bestDefenseMove(level, state)).toBeNull();
    expect(bestOffenseMove(level, state)).toBeNull();
  });

  it("offense picks the winning direct lane on the triangle", () => {
    const mv = bestOffenseMove(triangleOffenseFirst, initialState(triangleOffenseFirst));
    expect(mv).not.toBeNull();
    expect(edgeKey(mv!.a, mv!.b)).toBe(edgeKey("s", "t"));
  });
});
