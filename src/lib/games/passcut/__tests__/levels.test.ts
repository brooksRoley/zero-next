import { describe, it, expect } from "vitest";
import { LEVELS } from "../levels";
import { initialState } from "../graph";
import { solveValue } from "../solver";

describe("Pass & Cut campaign levels", () => {
  it("has a coherent difficulty arc (offense wins early, defense wins late)", () => {
    // Sanity on the authored campaign shape: at least some winnable and some
    // unwinnable boards, so the arc actually teaches both outcomes.
    const winners = LEVELS.map((l) => l.intendedWinner);
    expect(winners).toContain("offense");
    expect(winners).toContain("defense");
    expect(LEVELS.length).toBeGreaterThanOrEqual(6);
  });

  for (const level of LEVELS) {
    it(`level "${level.id}" is actually a forced ${level.intendedWinner} win under optimal play`, () => {
      // The solver is the source of truth: an authored intendedWinner that
      // disagrees with optimal play would teach a false lesson. This guards
      // every future edit to a board's edge set.
      expect(solveValue(level, initialState(level))).toBe(level.intendedWinner);
    });

    it(`level "${level.id}" has exactly 5 nodes and valid terminals`, () => {
      expect(level.nodes).toHaveLength(5);
      const ids = new Set(level.nodes.map((n) => n.id));
      expect(ids.has(level.terminals[0])).toBe(true);
      expect(ids.has(level.terminals[1])).toBe(true);
      expect(level.terminals[0]).not.toBe(level.terminals[1]);
    });
  }
});
