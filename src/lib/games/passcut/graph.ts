/**
 * Pass & Cut — pure graph model for the Shannon switching game on a small
 * basketball passing graph. No React, no DOM. This file is the shared CONTRACT
 * between the engine (solver.ts) and the UI (levels.ts / PassCutBoard.tsx).
 *
 * The type definitions and function signatures below are FROZEN — implementers
 * fill the bodies but must not change the exported shapes.
 */

/** A player-node id, e.g. "PG", "SG", "SF", "PF", "C". */
export type NodeId = string;

/** A node with its half-court render position. x,y are normalized 0..100. */
export interface NodePos {
  id: NodeId;
  label: string;
  x: number;
  y: number;
}

/** An undirected candidate pass lane between two nodes. */
export interface Edge {
  a: NodeId;
  b: NodeId;
}

/** Canonical string key for an undirected edge, e.g. "C|PG" (endpoints sorted). */
export type EdgeKey = string;

/** Per-edge ownership during a game. */
export type EdgeState = "free" | "secured" | "cut";

export type Turn = "offense" | "defense";
export type Winner = "offense" | "defense";

/** A curated campaign level. */
export interface Level {
  id: string;
  title: string;
  /** Short concept tag, e.g. "paths", "connectivity", "min-cut". */
  concept: string;
  /** Exactly 5 nodes in v1. */
  nodes: NodePos[];
  /** Candidate pass lanes. */
  edges: Edge[];
  /** [inbounder, finisher-at-rim]. */
  terminals: [NodeId, NodeId];
  /** Plain-language note shown in the teaching overlay after a result. */
  teaching: string;
  /** Who moves first. Defaults to "offense" when omitted. */
  firstMove?: Turn;
  /** Author's intended optimal-play outcome; validated in tests. */
  intendedWinner: Winner;
}

/** Mutable game state: every edge's current ownership + whose turn it is. */
export interface GameState {
  states: Record<EdgeKey, EdgeState>;
  turn: Turn;
}

const NOT_IMPLEMENTED = "passcut/graph: not implemented";

/** Canonical key for an undirected edge (endpoints sorted, joined by "|"). */
export function edgeKey(_a: NodeId, _b: NodeId): EdgeKey {
  throw new Error(NOT_IMPLEMENTED);
}

/** Normalize/de-duplicate a list of edges to canonical form. */
export function canonicalEdges(_edges: Edge[]): Edge[] {
  throw new Error(NOT_IMPLEMENTED);
}

/** True if `edges` connect the two terminals (undirected reachability). */
export function connected(_terminals: [NodeId, NodeId], _edges: Edge[]): boolean {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * True if offense (as the player who must connect the terminals) has a forced
 * win from the empty board under optimal play — the Lehman verdict, equivalent
 * to the existence of two edge-disjoint spanning connections between terminals.
 */
export function offenseHasForcedWin(_level: Level): boolean {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * If two edge-disjoint trees each spanning both terminals exist over `edges`,
 * return them; otherwise `{ exists: false }`. Drives the "two ways to the rim"
 * teaching reveal.
 */
export function twoEdgeDisjointTerminalTrees(
  _edges: Edge[],
  _terminals: [NodeId, NodeId]
): { exists: boolean; trees?: [Edge[], Edge[]] } {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * A minimum-size set of edges whose removal disconnects the terminals (the
 * min-cut). Used to highlight/name the losing cut in the teaching overlay.
 */
export function minimalCut(_edges: Edge[], _terminals: [NodeId, NodeId]): Edge[] {
  throw new Error(NOT_IMPLEMENTED);
}

/** Build the initial GameState for a level (all edges free, firstMove's turn). */
export function initialState(_level: Level): GameState {
  throw new Error(NOT_IMPLEMENTED);
}
