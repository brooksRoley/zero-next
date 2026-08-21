import { describe, it, expect } from "vitest";
import {
  edgeKey,
  canonicalEdges,
  connected,
  twoEdgeDisjointTerminalTrees,
  minimalCut,
} from "../graph";
import type { Edge, NodeId } from "../graph";

const E = (a: NodeId, b: NodeId): Edge => ({ a, b });

/** Does `set` (as edges) disconnect `terminals` when removed from `all`? */
function disconnectsAfterRemoval(
  all: Edge[],
  terminals: [NodeId, NodeId],
  cut: Edge[]
): boolean {
  const cutKeys = new Set(cut.map((e) => edgeKey(e.a, e.b)));
  const remaining = all.filter((e) => !cutKeys.has(edgeKey(e.a, e.b)));
  return !connected(terminals, remaining);
}

describe("edgeKey", () => {
  it("sorts endpoints and joins with |", () => {
    expect(edgeKey("PG", "C")).toBe("C|PG");
    expect(edgeKey("C", "PG")).toBe("C|PG");
    expect(edgeKey("a", "a")).toBe("a|a");
  });
});

describe("canonicalEdges", () => {
  it("normalizes orientation and de-duplicates", () => {
    const out = canonicalEdges([E("t", "s"), E("s", "t"), E("s", "w")]);
    expect(out).toHaveLength(2);
    const keys = out.map((e) => edgeKey(e.a, e.b)).sort();
    expect(keys).toEqual(["s|t", "s|w"]);
    // every edge is stored with a <= b
    for (const e of out) expect(e.a <= e.b).toBe(true);
  });

  it("drops self-loops", () => {
    expect(canonicalEdges([E("s", "s"), E("s", "t")])).toHaveLength(1);
  });
});

describe("connected", () => {
  const edges = [E("s", "w"), E("w", "t")];

  it("finds a path through intermediate nodes", () => {
    expect(connected(["s", "t"], edges)).toBe(true);
  });

  it("returns false when no path exists", () => {
    expect(connected(["s", "t"], [E("s", "w")])).toBe(false);
  });

  it("returns true for identical terminals", () => {
    expect(connected(["s", "s"], [])).toBe(true);
  });

  it("returns false on an empty edge set with distinct terminals", () => {
    expect(connected(["s", "t"], [])).toBe(false);
  });
});

describe("twoEdgeDisjointTerminalTrees", () => {
  it("is TRUE on K4 (two edge-disjoint spanning trees exist)", () => {
    // K4 on {s,t,a,b} — a classic winnable (Short wins as 2nd player) board.
    const k4 = [
      E("s", "t"),
      E("s", "a"),
      E("s", "b"),
      E("t", "a"),
      E("t", "b"),
      E("a", "b"),
    ];
    const res = twoEdgeDisjointTerminalTrees(k4, ["s", "t"]);
    expect(res.exists).toBe(true);
    const [t1, t2] = res.trees!;
    // The two trees must be edge-disjoint...
    const k1 = new Set(t1.map((e) => edgeKey(e.a, e.b)));
    for (const e of t2) expect(k1.has(edgeKey(e.a, e.b))).toBe(false);
    // ...and each must actually connect the terminals.
    expect(connected(["s", "t"], t1)).toBe(true);
    expect(connected(["s", "t"], t2)).toBe(true);
  });

  it("is TRUE for a doubled direct lane between terminals", () => {
    // Two parallel s-t edges: securable no matter which one defense cuts.
    const res = twoEdgeDisjointTerminalTrees([E("s", "t"), E("s", "t")], ["s", "t"]);
    expect(res.exists).toBe(true);
  });

  it("is FALSE on a triangle (paths exist but not two spanning trees)", () => {
    // s-t, s-w, w-t: two edge-disjoint PATHS exist, yet Short loses as 2nd
    // player. The condition must reject this (the key counterexample).
    const triangle = [E("s", "t"), E("s", "w"), E("w", "t")];
    expect(twoEdgeDisjointTerminalTrees(triangle, ["s", "t"]).exists).toBe(false);
  });

  it("is FALSE on a single path", () => {
    expect(
      twoEdgeDisjointTerminalTrees([E("s", "w"), E("w", "t")], ["s", "t"]).exists
    ).toBe(false);
  });

  it("throws instead of silently hanging when the edge count exceeds the brute-force limit", () => {
    // The solver is 3^n; 15 edges would be 3^15 ≈ 14.3M assignments per call.
    // A future hand-authored level exceeding the documented "≤ ~10 edges"
    // assumption must fail loudly, not freeze the tab.
    const oversized: Edge[] = [];
    for (let i = 0; i < 15; i++) oversized.push(E(`n${i}`, `n${i + 1}`));
    expect(() => twoEdgeDisjointTerminalTrees(oversized, ["n0", "n15"])).toThrow(
      /exceeds the brute-force limit/
    );
  });

  it("still succeeds exactly at the limit (14 edges)", () => {
    const atLimit: Edge[] = [];
    for (let i = 0; i < 14; i++) atLimit.push(E(`n${i}`, `n${i + 1}`));
    expect(() =>
      twoEdgeDisjointTerminalTrees(atLimit, ["n0", "n14"])
    ).not.toThrow();
  });
});

describe("minimalCut", () => {
  it("returns a genuine minimum disconnecting set on a triangle (size 2)", () => {
    const triangle = [E("s", "t"), E("s", "w"), E("w", "t")];
    const cut = minimalCut(triangle, ["s", "t"]);
    expect(cut).toHaveLength(2);
    expect(disconnectsAfterRemoval(triangle, ["s", "t"], cut)).toBe(true);
    // No single edge can disconnect a 2-edge-connected pair → confirms minimality.
    for (const e of triangle) {
      expect(disconnectsAfterRemoval(triangle, ["s", "t"], [e])).toBe(false);
    }
  });

  it("returns a size-1 cut on a single path", () => {
    const path = [E("s", "w"), E("w", "t")];
    const cut = minimalCut(path, ["s", "t"]);
    expect(cut).toHaveLength(1);
    expect(disconnectsAfterRemoval(path, ["s", "t"], cut)).toBe(true);
  });

  it("returns an empty cut when terminals are already disconnected", () => {
    expect(minimalCut([E("s", "w")], ["s", "t"])).toHaveLength(0);
  });
});
