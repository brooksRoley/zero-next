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

/** Canonical key for an undirected edge (endpoints sorted, joined by "|"). */
export function edgeKey(a: NodeId, b: NodeId): EdgeKey {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

/** Normalize/de-duplicate a list of edges to canonical form. */
export function canonicalEdges(edges: Edge[]): Edge[] {
  const seen = new Set<EdgeKey>();
  const out: Edge[] = [];
  for (const e of edges) {
    if (e.a === e.b) continue; // drop self-loops
    const key = edgeKey(e.a, e.b);
    if (seen.has(key)) continue;
    seen.add(key);
    const [a, b] = e.a <= e.b ? [e.a, e.b] : [e.b, e.a];
    out.push({ a, b });
  }
  return out;
}

/** True if `edges` connect the two terminals (undirected reachability). */
export function connected(terminals: [NodeId, NodeId], edges: Edge[]): boolean {
  const [start, goal] = terminals;
  if (start === goal) return true;
  const adj = new Map<NodeId, NodeId[]>();
  const add = (u: NodeId, v: NodeId) => {
    const list = adj.get(u);
    if (list) list.push(v);
    else adj.set(u, [v]);
  };
  for (const e of edges) {
    if (e.a === e.b) continue;
    add(e.a, e.b);
    add(e.b, e.a);
  }
  const seen = new Set<NodeId>([start]);
  const stack: NodeId[] = [start];
  while (stack.length) {
    const cur = stack.pop() as NodeId;
    if (cur === goal) return true;
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        stack.push(nxt);
      }
    }
  }
  return false;
}

/**
 * Is `edgeSet` a tree that spans exactly `vertexSet`? i.e. connected, acyclic,
 * and touches every vertex in vertexSet (and no others). A tree on n vertices
 * has exactly n-1 edges; combined with "spans all n vertices in one component"
 * this implies acyclicity, so we only check edge count + single component.
 */
function isSpanningTree(edgeSet: Edge[], vertexSet: Set<NodeId>): boolean {
  const n = vertexSet.size;
  if (n === 0) return false;
  if (edgeSet.length !== n - 1) return false;
  // Union-find over vertexSet.
  const parent = new Map<NodeId, NodeId>();
  for (const v of vertexSet) parent.set(v, v);
  const find = (x: NodeId): NodeId => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as NodeId;
    let c = x;
    while (parent.get(c) !== c) {
      const nxt = parent.get(c) as NodeId;
      parent.set(c, r);
      c = nxt;
    }
    return r;
  };
  for (const e of edgeSet) {
    if (!vertexSet.has(e.a) || !vertexSet.has(e.b)) return false;
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra === rb) return false; // cycle → not a tree
    parent.set(ra, rb);
  }
  // All vertices must be in a single component.
  const root = find([...vertexSet][0]);
  for (const v of vertexSet) if (find(v) !== root) return false;
  return true;
}

/**
 * If two edge-disjoint trees each spanning a common vertex set W ⊇ {terminals}
 * exist over `edges`, return them; otherwise `{ exists: false }`.
 *
 * This is the Lehman condition for the Shannon switching game: offense (the
 * connector) has a forced win as the SECOND player iff the graph contains a
 * subgraph H (on vertex set W containing both terminals) with two edge-disjoint
 * spanning trees. Note it is NOT sufficient for the two trees to merely each
 * connect the terminals — they must span the same vertex set (see the triangle
 * counterexample). List elements are treated as DISTINCT edges (parallels are
 * meaningful and are not de-duplicated here).
 */
// 3^14 ≈ 4.8M iterations, well under ~200ms — comfortably above the
// documented "≤ ~10 edges" real-board assumption while still catching a
// future oversized hand-authored level before it hangs a player's tab.
const MAX_EDGES_FOR_BRUTE_FORCE = 14;

export function twoEdgeDisjointTerminalTrees(
  edges: Edge[],
  terminals: [NodeId, NodeId]
): { exists: boolean; trees?: [Edge[], Edge[]] } {
  // Work on the raw edges (keep parallels). Drop self-loops only.
  const es = edges.filter((e) => e.a !== e.b);
  const [t0, t1] = terminals;
  const n = es.length;
  if (n > MAX_EDGES_FOR_BRUTE_FORCE) {
    throw new Error(
      `twoEdgeDisjointTerminalTrees: ${n} edges exceeds the brute-force limit of ` +
        `${MAX_EDGES_FOR_BRUTE_FORCE} (3^${n} assignments would be evaluated). ` +
        `This solver is 3^n and only safe for small hand-authored levels.`
    );
  }
  // Assign each edge to group 0 (unused), 1 (tree A), or 2 (tree B): 3^n.
  const pow3 = Math.pow(3, n);
  for (let code = 0; code < pow3; code++) {
    const treeA: Edge[] = [];
    const treeB: Edge[] = [];
    const vertsA = new Set<NodeId>();
    const vertsB = new Set<NodeId>();
    let c = code;
    for (let i = 0; i < n; i++) {
      const g = c % 3;
      c = Math.floor(c / 3);
      const e = es[i];
      if (g === 1) {
        treeA.push(e);
        vertsA.add(e.a);
        vertsA.add(e.b);
      } else if (g === 2) {
        treeB.push(e);
        vertsB.add(e.a);
        vertsB.add(e.b);
      }
    }
    if (treeA.length === 0 || treeB.length === 0) continue;
    if (vertsA.size !== vertsB.size) continue;
    if (!vertsA.has(t0) || !vertsA.has(t1)) continue;
    let sameVerts = true;
    for (const v of vertsA) {
      if (!vertsB.has(v)) {
        sameVerts = false;
        break;
      }
    }
    if (!sameVerts) continue;
    if (!isSpanningTree(treeA, vertsA)) continue;
    if (!isSpanningTree(treeB, vertsB)) continue;
    return { exists: true, trees: [treeA, treeB] };
  }
  return { exists: false };
}

/** Contract edge `e` (merge b into a); drop resulting self-loops. */
function contract(
  edges: Edge[],
  terminals: [NodeId, NodeId],
  e: Edge
): { edges: Edge[]; terminals: [NodeId, NodeId] } {
  const keep = e.a;
  const gone = e.b;
  const map = (id: NodeId): NodeId => (id === gone ? keep : id);
  const out: Edge[] = [];
  for (const x of edges) {
    const a = map(x.a);
    const b = map(x.b);
    if (a === b) continue; // self-loop (includes e itself + parallels)
    out.push({ a, b });
  }
  return { edges: out, terminals: [map(terminals[0]), map(terminals[1])] };
}

/**
 * True if offense (as the player who must connect the terminals) has a forced
 * win from the empty board under optimal play — the Lehman verdict, equivalent
 * to the existence of two edge-disjoint spanning connections between terminals.
 *
 * Accounts for who moves first:
 * - Offense moving SECOND (firstMove === "defense"): Lehman's second-player
 *   condition — two edge-disjoint terminal-spanning trees exist.
 * - Offense moving FIRST (default): offense wins iff it wins even as the second
 *   player, OR there exists a first edge it can secure (contract) such that the
 *   remaining position is a second-player win.
 */
export function offenseHasForcedWin(level: Level): boolean {
  const edges = canonicalEdges(level.edges);
  const terminals = level.terminals;
  const firstMove: Turn = level.firstMove ?? "offense";

  const winsAsSecond = (es: Edge[], ts: [NodeId, NodeId]): boolean =>
    ts[0] === ts[1] || twoEdgeDisjointTerminalTrees(es, ts).exists;

  if (firstMove === "defense") {
    // Offense moves second.
    return winsAsSecond(edges, terminals);
  }

  // Offense moves first: an extra tempo can only help the connector.
  if (winsAsSecond(edges, terminals)) return true;
  for (const e of edges) {
    // Securing e connects the terminals outright.
    if (edgeKey(e.a, e.b) === edgeKey(terminals[0], terminals[1])) return true;
    const c = contract(edges, terminals, e);
    if (winsAsSecond(c.edges, c.terminals)) return true;
  }
  return false;
}

/**
 * A minimum-size set of edges whose removal disconnects the terminals (the
 * min-cut). Used to highlight/name the losing cut in the teaching overlay.
 */
export function minimalCut(edges: Edge[], terminals: [NodeId, NodeId]): Edge[] {
  const es = canonicalEdges(edges);
  if (!connected(terminals, es)) return [];
  const n = es.length;
  // Ascending subset size → first disconnecting subset is a minimum cut.
  for (let k = 1; k <= n; k++) {
    const combo: number[] = [];
    const found = pickCut(es, terminals, n, k, 0, combo);
    if (found) return found;
  }
  return es.slice(); // removing everything must disconnect (unreachable in practice)
}

/** Recursively try every size-k subset of edge indices as a cut. */
function pickCut(
  es: Edge[],
  terminals: [NodeId, NodeId],
  n: number,
  k: number,
  start: number,
  combo: number[]
): Edge[] | null {
  if (combo.length === k) {
    const removed = new Set(combo);
    const remaining = es.filter((_, i) => !removed.has(i));
    if (!connected(terminals, remaining)) {
      return combo.map((i) => es[i]);
    }
    return null;
  }
  for (let i = start; i < n; i++) {
    combo.push(i);
    const res = pickCut(es, terminals, n, k, i + 1, combo);
    if (res) return res;
    combo.pop();
  }
  return null;
}

/** Build the initial GameState for a level (all edges free, firstMove's turn). */
export function initialState(level: Level): GameState {
  const states: Record<EdgeKey, EdgeState> = {};
  for (const e of canonicalEdges(level.edges)) {
    states[edgeKey(e.a, e.b)] = "free";
  }
  return { states, turn: level.firstMove ?? "offense" };
}
