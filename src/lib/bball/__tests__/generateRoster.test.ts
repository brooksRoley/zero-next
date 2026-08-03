import { describe, it, expect } from "vitest";
import {
  generateRoster,
  costCounts,
  zToRating,
  DEFAULT_TARGET_SIZE,
} from "src/lib/bball/generateRoster";
import { parseByAthletePage, parseStandingsPage } from "src/lib/bball/espn";
import type { EspnSeasonStats, EspnRosterStatus } from "src/lib/bball/espn";

function player(overrides: Partial<EspnSeasonStats> & { id: number }): EspnSeasonStats {
  return {
    name: `Player ${overrides.id}`,
    age: 25,
    teamNickname: null,
    gamesPlayed: 70,
    avgMinutes: 30,
    avgPoints: 15,
    avgRebounds: 5,
    avgAssists: 4,
    avgSteals: 1,
    avgBlocks: 0.5,
    avgTurnovers: 2,
    avgFgm: 5.5,
    avgFga: 12,
    avgFg3m: 1.8,
    avgFg3a: 5,
    avgFtm: 2.2,
    avgFta: 2.8,
    fgPct: 0.46,
    fg3Pct: 0.36,
    ftPct: 0.78,
    ...overrides,
  };
}

/** A pool with stat spread: ids 1..n, points scaling with id. */
function scaledPool(n: number): EspnSeasonStats[] {
  return Array.from({ length: n }, (_, i) =>
    player({
      id: i + 1,
      avgPoints: 5 + i * (25 / n),
      avgAssists: 1 + i * (8 / n),
      avgSteals: 0.5 + i * (1.5 / n),
      avgBlocks: 0.2 + i * (2 / n),
      avgRebounds: 3 + i * (8 / n),
    })
  );
}

const NO_STATUSES = new Map<number, EspnRosterStatus>();

describe("zToRating", () => {
  it("mirrors StatNormalizer::ConvertZScoreToGameStat", () => {
    expect(zToRating(0)).toBe(50);
    expect(zToRating(1)).toBe(70);
    expect(zToRating(-1)).toBe(30);
    expect(zToRating(10)).toBe(99); // clamped
    expect(zToRating(-10)).toBe(1); // clamped
  });
});

describe("costCounts", () => {
  it("sums exactly to the roster size with a TFT-shaped pyramid", () => {
    const counts = costCounts(96);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(96);
    expect(counts.get(5)).toBe(8);
    expect(counts.get(4)).toBe(13);
    expect(counts.get(3)).toBe(19);
    expect(counts.get(2)).toBe(26);
    expect(counts.get(1)).toBe(30);
  });

  it("holds for odd sizes", () => {
    for (const size of [50, 77, 120]) {
      const total = [...costCounts(size).values()].reduce((a, b) => a + b, 0);
      expect(total).toBe(size);
    }
  });
});

describe("generateRoster", () => {
  it("filters out players below the games/minutes thresholds", () => {
    const pool = [
      player({ id: 1 }),
      player({ id: 2, gamesPlayed: 5 }),
      player({ id: 3, avgMinutes: 8 }),
    ];
    const roster = generateRoster(pool, NO_STATUSES, { targetSize: 10 });
    expect(roster.map((p) => p.id)).toEqual([1]);
  });

  it("caps at targetSize, keeping the best composites", () => {
    const roster = generateRoster(scaledPool(200), NO_STATUSES, { targetSize: 96 });
    expect(roster).toHaveLength(96);
    // The pool scales with id, so the strongest ids (highest) survive the cut.
    const ids = roster.map((p) => p.id);
    expect(Math.min(...ids)).toBeGreaterThan(100);
  });

  it("distributes costs by quota and puts the best players at 5-cost", () => {
    const roster = generateRoster(scaledPool(200), NO_STATUSES, { targetSize: 96 });
    const byCost = (c: number) => roster.filter((p) => p.cost === c);
    expect(byCost(5)).toHaveLength(8);
    expect(byCost(4)).toHaveLength(13);
    expect(byCost(1)).toHaveLength(30);
    const bestId = 200; // highest composite in the scaled pool
    expect(byCost(5).some((p) => p.id === bestId)).toBe(true);
  });

  it("keeps all ratings within [1, 99] even with outliers", () => {
    const pool = [
      ...scaledPool(50),
      player({ id: 999, avgPoints: 200, avgAssists: 50, avgBlocks: 20, avgSteals: 10 }),
    ];
    const roster = generateRoster(pool, NO_STATUSES, { targetSize: 51 });
    for (const p of roster) {
      for (const v of Object.values(p.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
    const outlier = roster.find((p) => p.id === 999)!;
    expect(outlier.stats.shooting).toBe(99);
  });

  it("rates everyone 50 when the pool has zero variance", () => {
    const pool = [player({ id: 1 }), player({ id: 2 }), player({ id: 3 })];
    const roster = generateRoster(pool, NO_STATUSES, { targetSize: 3 });
    for (const p of roster) {
      expect(p.stats).toEqual({ shooting: 50, speed: 50, defense: 50 });
    }
  });

  it("takes team + injury from the current roster and marks unsigned players FA", () => {
    const statuses = new Map<number, EspnRosterStatus>([
      [1, { team: "LAL", injuryStatus: "Day-To-Day" }],
    ]);
    const pool = [
      player({ id: 1, avgPoints: 30 }),
      player({ id: 2, avgPoints: 10 }),
    ];
    const roster = generateRoster(pool, statuses, { targetSize: 2 });
    const signed = roster.find((p) => p.id === 1)!;
    const unsigned = roster.find((p) => p.id === 2)!;
    expect(signed.team).toBe("LAL");
    expect(signed.injury_status).toBe("Day-To-Day");
    expect(unsigned.team).toBe("FA");
    expect(unsigned.injury_status).toBe("");
    expect(unsigned.is_active).toBe(true); // free agents stay draftable
  });

  it("is deterministic and sorted by cost desc, then name", () => {
    const a = generateRoster(scaledPool(150), NO_STATUSES);
    const b = generateRoster(scaledPool(150), NO_STATUSES);
    expect(a).toEqual(b);
    expect(a).toHaveLength(DEFAULT_TARGET_SIZE);
    for (let i = 1; i < a.length; i++) {
      const prev = a[i - 1];
      const cur = a[i];
      expect(
        prev.cost > cur.cost ||
          (prev.cost === cur.cost && prev.name.localeCompare(cur.name) <= 0)
      ).toBe(true);
    }
  });

  it("returns an empty roster for an empty pool", () => {
    expect(generateRoster([], NO_STATUSES)).toEqual([]);
  });
});

describe("parseByAthletePage", () => {
  it("joins page-level stat labels to each athlete's value arrays", () => {
    const page = {
      categories: [
        { name: "general", names: ["gamesPlayed", "avgMinutes", "avgRebounds"] },
        {
          name: "offensive",
          names: [
            "avgPoints", "avgAssists",
            "avgFieldGoalsMade", "avgFieldGoalsAttempted",
            "avgThreePointFieldGoalsMade", "avgThreePointFieldGoalsAttempted",
            "avgFreeThrowsMade", "avgFreeThrowsAttempted",
          ],
        },
        { name: "defensive", names: ["avgSteals", "avgBlocks"] },
      ],
      athletes: [
        {
          athlete: { id: "3934672", displayName: "Jalen Brunson", age: 29, teamName: "Knicks" },
          categories: [
            { name: "general", values: [65, 35.1, 3.2] },
            { name: "offensive", values: [28.4, 6.1, 9.8, 20.5, 2.7, 7.2, 6.1, 7.3] },
            { name: "defensive", values: [1.2, 0.1] },
          ],
        },
        // Malformed entries are skipped, not fatal.
        { athlete: { displayName: "No Id" }, categories: [] },
      ],
    };
    const rows = parseByAthletePage(page);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 3934672,
      name: "Jalen Brunson",
      age: 29,
      teamNickname: "Knicks",
      gamesPlayed: 65,
      avgMinutes: 35.1,
      avgRebounds: 3.2,
      avgPoints: 28.4,
      avgAssists: 6.1,
      avgSteals: 1.2,
      avgBlocks: 0.1,
      avgTurnovers: 0,
      avgFgm: 9.8,
      avgFga: 20.5,
      avgFg3m: 2.7,
      avgFg3a: 7.2,
      avgFtm: 6.1,
      avgFta: 7.3,
      fgPct: 0,
      fg3Pct: 0,
      ftPct: 0,
    });
  });

  it("defaults missing stats to 0 and survives an empty page", () => {
    expect(parseByAthletePage({})).toEqual([]);
    const rows = parseByAthletePage({
      categories: [{ name: "offensive", names: ["avgPoints"] }],
      athletes: [
        { athlete: { id: 7, displayName: "Stats Missing" }, categories: [] },
      ],
    });
    expect(rows[0].avgPoints).toBe(0);
    expect(rows[0].gamesPlayed).toBe(0);
    expect(rows[0].avgFga).toBe(0);
    expect(rows[0].age).toBeNull();
    expect(rows[0].teamNickname).toBeNull();
  });

  it("converts ESPN's 0-100 percentages to 0-1 fractions", () => {
    const rows = parseByAthletePage({
      categories: [
        { name: "offensive", names: ["fieldGoalPct", "threePointFieldGoalPct", "freeThrowPct"] },
      ],
      athletes: [
        {
          athlete: { id: 1, displayName: "Shooter" },
          categories: [{ name: "offensive", values: [46.5, 36.2, 84.6] }],
        },
      ],
    });
    expect(rows[0].fgPct).toBeCloseTo(0.465);
    expect(rows[0].fg3Pct).toBeCloseTo(0.362);
    expect(rows[0].ftPct).toBeCloseTo(0.846);
  });
});

describe("parseStandingsPage", () => {
  it("flattens conference children into standings entries", () => {
    const page = {
      children: [
        {
          name: "Eastern Conference",
          standings: {
            entries: [
              {
                team: { displayName: "Detroit Pistons", abbreviation: "DET" },
                stats: [
                  { name: "wins", value: 60 },
                  { name: "losses", value: 22 },
                  { name: "winPercent", value: 0.7317 },
                  { name: "playoffSeed", value: 1 },
                  { name: "streak", displayValue: "W4" }, // non-numeric: ignored
                ],
              },
            ],
          },
        },
      ],
    };
    expect(parseStandingsPage(page)).toEqual([
      {
        teamName: "Detroit Pistons",
        teamAbbrev: "DET",
        conference: "Eastern Conference",
        wins: 60,
        losses: 22,
        winPercent: 0.7317,
        playoffSeed: 1,
      },
    ]);
    expect(parseStandingsPage({})).toEqual([]);
  });
});
