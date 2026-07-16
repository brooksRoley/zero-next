/**
 * Ghost-poisoning regression tests for the board sanitizer.
 * Every stored board is served as a live opponent to other players, so the
 * sanitizer must make forged stats impossible — not just unlikely.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeBoard,
  teamSizeCap,
  starUpStats,
  STAT_CAP,
} from "src/lib/bball/validateBoard";
import type { RosterPlayer } from "src/lib/bball/roster";

const ROSTER: RosterPlayer[] = [
  {
    id: 1,
    name: "Steph Curry",
    team: "GSW",
    cost: 5,
    is_active: true,
    injury_status: "",
    stats: { shooting: 74, speed: 63, defense: 51 },
  },
  {
    id: 2,
    name: "Rudy Gobert",
    team: "MIN",
    cost: 4,
    is_active: true,
    injury_status: "",
    stats: { shooting: 35, speed: 47, defense: 72 },
  },
];

function legitUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: 17,
    rosterId: 1,
    name: "Steph Curry",
    team: "GSW",
    cost: 5,
    star: 1,
    x: 2,
    y: 3,
    stats: { shooting: 74, speed: 63, defense: 51 },
    ...overrides,
  };
}

function legitBoard(overrides: Record<string, unknown> = {}) {
  return {
    team_name: "You",
    offense: "spread_pnr",
    coverage: "drop",
    units: [legitUnit()],
    ...overrides,
  };
}

describe("sanitizeBoard", () => {
  it("accepts a legit board and preserves position, star, and schemes", () => {
    const result = sanitizeBoard(legitBoard(), 1, ROSTER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = result.board.units[0];
    expect(unit).toMatchObject({ rosterId: 1, name: "Steph Curry", cost: 5, star: 1, x: 2, y: 3 });
    expect(result.board.offense).toBe("spread_pnr");
    expect(result.board.coverage).toBe("drop");
    expect(result.board.team_name).toBe("You");
  });

  it("rebuilds forged stats from the roster (the poisoning vector)", () => {
    const board = legitBoard({
      units: [legitUnit({ stats: { shooting: 99, speed: 99, defense: 99 }, cost: 1, name: "Godmode" })],
    });
    const result = sanitizeBoard(board, 1, ROSTER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Stats, name, and cost all come from the server roster, never the client.
    expect(result.board.units[0].stats).toEqual({ shooting: 74, speed: 63, defense: 51 });
    expect(result.board.units[0].name).toBe("Steph Curry");
    expect(result.board.units[0].cost).toBe(5);
  });

  it("computes 2-star stats server-side with the ×1.8 cap-99 formula", () => {
    const board = legitBoard({
      units: [legitUnit({ star: 2, stats: { shooting: 99, speed: 99, defense: 99 } })],
    });
    const result = sanitizeBoard(board, 1, ROSTER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.units[0].stats).toEqual(starUpStats(ROSTER[0].stats));
    expect(result.board.units[0].stats.shooting).toBe(Math.min(STAT_CAP, Math.round(74 * 1.8)));
  });

  it("rejects unknown rosterIds", () => {
    const result = sanitizeBoard(legitBoard({ units: [legitUnit({ rosterId: 999 })] }), 1, ROSTER);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.error).toContain("unknown rosterId");
  });

  it("rejects star levels above 2 and non-numeric stars", () => {
    expect(sanitizeBoard(legitBoard({ units: [legitUnit({ star: 3 })] }), 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard(legitBoard({ units: [legitUnit({ star: "gold" })] }), 1, ROSTER).ok).toBe(false);
  });

  it("defaults a missing star to 1", () => {
    const unit = legitUnit();
    delete (unit as Record<string, unknown>).star;
    const result = sanitizeBoard(legitBoard({ units: [unit] }), 1, ROSTER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.units[0].star).toBe(1);
  });

  it("rejects positions off the 5x5 planning grid", () => {
    for (const pos of [{ x: 5, y: 0 }, { x: -1, y: 2 }, { x: 1.5, y: 2 }, { x: 0, y: "3" }]) {
      const result = sanitizeBoard(legitBoard({ units: [legitUnit(pos)] }), 1, ROSTER);
      expect(result.ok).toBe(false);
    }
  });

  it("enforces the per-round team size cap", () => {
    const four = [0, 1, 2, 3].map((i) => legitUnit({ x: i }));
    // Round 1 cap is 3 → reject; round 5 cap is 5 → accept.
    expect(sanitizeBoard(legitBoard({ units: four }), 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard(legitBoard({ units: four }), 5, ROSTER).ok).toBe(true);
  });

  it("rejects non-object boards and empty/absent unit arrays", () => {
    expect(sanitizeBoard(null, 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard([], 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard("units", 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard({ units: [] }, 1, ROSTER).ok).toBe(false);
    expect(sanitizeBoard({ team_name: "x" }, 1, ROSTER).ok).toBe(false);
  });

  it("strips control characters and truncates team_name; drops junk scheme ids", () => {
    const result = sanitizeBoard(
      legitBoard({
        team_name: "\x00<script>" + "x".repeat(100),
        offense: "DROP TABLE bball_runs;--",
        coverage: 42,
      }),
      1,
      ROSTER
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.team_name.length).toBeLessThanOrEqual(40);
    expect(result.board.team_name).not.toContain("\x00");
    expect(result.board.offense).toBeUndefined();
    expect(result.board.coverage).toBeUndefined();
  });

  it("drops unknown client fields from the stored board (whitelist rebuild)", () => {
    const result = sanitizeBoard(
      legitBoard({ is_bot: true, evil: { huge: "payload" } }),
      1,
      ROSTER
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.board).sort()).toEqual(["coverage", "offense", "team_name", "units"]);
    const unitKeys = Object.keys(result.board.units[0]).sort();
    expect(unitKeys).toEqual(["cost", "id", "name", "rosterId", "star", "stats", "team", "x", "y"]);
  });
});

describe("teamSizeCap", () => {
  it("grows 3 → 5 with rounds, capped at 5 (mirrors client economy.js)", () => {
    expect(teamSizeCap(1)).toBe(3);
    expect(teamSizeCap(2)).toBe(3);
    expect(teamSizeCap(3)).toBe(4);
    expect(teamSizeCap(5)).toBe(5);
    expect(teamSizeCap(10)).toBe(5);
  });
});
