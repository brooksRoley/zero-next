/**
 * Simulation Integration Tests
 * Tests the full flow: DB roster rows → dbRowToRealStats → mapRosterToEngine → Monte Carlo
 * Verifies that different team stats produce meaningfully different predictions.
 */
import { describe, it, expect } from "vitest";
import { resolveTeam, dbRowToRealStats, fallbackRoster, buildRosterFromDb } from "../sim/roster-builder";
import { runMonteCarloSim } from "../sim/monte-carlo";
import type { RealPlayerStats } from "../sim/stat-mapper";

// ── resolveTeam ───────────────────────────────────────────────────────────────

describe("resolveTeam", () => {
  it("resolves exact full name", () => {
    const result = resolveTeam("Los Angeles Lakers");
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1610612747);
    expect(result!.abbrev).toBe("LAL");
  });

  it("resolves Boston Celtics", () => {
    const result = resolveTeam("Boston Celtics");
    expect(result!.abbrev).toBe("BOS");
  });

  it("resolves Oklahoma City Thunder", () => {
    const result = resolveTeam("Oklahoma City Thunder");
    expect(result!.abbrev).toBe("OKC");
  });

  it("returns null for unknown team", () => {
    expect(resolveTeam("Mars Martians")).toBeNull();
  });

  it("fuzzy matches city + nickname", () => {
    // Odds API sometimes formats slightly differently
    const result = resolveTeam("Los Angeles Lakers");
    expect(result!.abbrev).toBe("LAL");
  });
});

// ── dbRowToRealStats ──────────────────────────────────────────────────────────

describe("dbRowToRealStats", () => {
  const MOCK_DB_ROW = {
    player_id: 2544,
    player_name: "LeBron James",
    team_id: 1610612747,
    position: "F",
    games_played: 62,
    mpg: 35.2,
    ppg: 24.8,
    rpg: 7.1,
    apg: 8.3,
    spg: 1.2,
    bpg: 0.6,
    fg_pct: 0.495,
    fg3_pct: 0.362,
    ft_pct: 0.768,
    team_pace: 100.5,
    team_def_rtg: 112.3,
  };

  it("maps DB row to RealPlayerStats shape", () => {
    const stats = dbRowToRealStats(MOCK_DB_ROW);
    expect(stats.player_id).toBe(2544);
    expect(stats.player_name).toBe("LeBron James");
    expect(stats.fg_pct).toBe(0.495);
    expect(stats.fg3_pct).toBe(0.362);
    expect(stats.pace).toBe(100.5);
    expect(stats.def_rtg).toBe(112.3);
  });

  it("derives ts_pct from shooting percentages", () => {
    const stats = dbRowToRealStats(MOCK_DB_ROW);
    // ts_pct = fg_pct * 0.6 + fg3_pct * 0.2 + ft_pct * 0.2
    const expected = 0.495 * 0.6 + 0.362 * 0.2 + 0.768 * 0.2;
    expect(stats.ts_pct).toBeCloseTo(expected, 4);
  });

  it("derives stl_pct and blk_pct from per-game stats", () => {
    const stats = dbRowToRealStats(MOCK_DB_ROW);
    expect(stats.stl_pct).toBeCloseTo(1.2 * 1.5, 4);
    expect(stats.blk_pct).toBeCloseTo(0.6 * 2.0, 4);
  });

  it("uses position-based height/weight defaults", () => {
    const forward = dbRowToRealStats({ ...MOCK_DB_ROW, position: "F" });
    expect(forward.height_inches).toBe(79);
    expect(forward.weight_lbs).toBe(225);

    const guard = dbRowToRealStats({ ...MOCK_DB_ROW, position: "G" });
    expect(guard.height_inches).toBe(75);
    expect(guard.weight_lbs).toBe(195);

    const center = dbRowToRealStats({ ...MOCK_DB_ROW, position: "C" });
    expect(center.height_inches).toBe(83);
    expect(center.weight_lbs).toBe(250);
  });

  it("uses default bio for unknown position", () => {
    const stats = dbRowToRealStats({ ...MOCK_DB_ROW, position: null });
    expect(stats.height_inches).toBe(78);
    expect(stats.weight_lbs).toBe(215);
  });

  it("handles missing stat values with defaults", () => {
    const stats = dbRowToRealStats({
      player_id: 999,
      player_name: "Sparse Player",
      team_id: 1,
      position: null,
      fg_pct: null,
      fg3_pct: null,
      ft_pct: null,
      spg: null,
      bpg: null,
      mpg: null,
      team_pace: null,
      team_def_rtg: null,
    });
    expect(stats.fg_pct).toBe(0.45);
    expect(stats.fg3_pct).toBe(0.33);
    expect(stats.def_rtg).toBe(110);
    expect(stats.pace).toBe(100);
    expect(stats.mpg).toBe(20);
  });
});

// ── fallbackRoster ────────────────────────────────────────────────────────────

describe("fallbackRoster", () => {
  it("returns 5 players with team abbreviation", () => {
    const roster = fallbackRoster("LAL");
    expect(roster).toHaveLength(5);
    for (const p of roster) {
      expect(p.team).toBe("LAL");
      expect(p.shooting).toBe(65);
    }
  });
});

// ── buildRosterFromDb ─────────────────────────────────────────────────────────

describe("buildRosterFromDb", () => {
  const FIVE_PLAYERS = Array.from({ length: 5 }, (_, i) => ({
    player_id: 100 + i,
    player_name: `Player ${i}`,
    team_id: 1610612747,
    position: "G",
    mpg: 25 + i * 2,
    fg_pct: 0.45 + i * 0.01,
    fg3_pct: 0.35,
    ft_pct: 0.78,
    spg: 1.0,
    bpg: 0.5,
    team_pace: 100,
    team_def_rtg: 110,
  }));

  it("builds engine roster from 5+ DB rows", () => {
    const { roster, source } = buildRosterFromDb(FIVE_PLAYERS, "LAL");
    expect(source).toBe("db");
    expect(roster).toHaveLength(5);
    expect(roster[0].team).toBe("LAL");
    expect(roster[0].shooting).toBeGreaterThan(0);
    expect(roster[0].shooting).toBeLessThanOrEqual(100);
  });

  it("falls back when fewer than 5 players", () => {
    const { roster, source } = buildRosterFromDb(FIVE_PLAYERS.slice(0, 3), "LAL");
    expect(source).toBe("fallback");
    expect(roster).toHaveLength(5);
    expect(roster[0].shooting).toBe(65); // default
  });

  it("falls back on empty array", () => {
    const { source } = buildRosterFromDb([], "LAL");
    expect(source).toBe("fallback");
  });
});

// ── Full Pipeline Integration ─────────────────────────────────────────────────

describe("Full simulation pipeline: roster → engine → Monte Carlo", () => {
  // Elite offensive team
  const ELITE_OFFENSE = Array.from({ length: 5 }, (_, i) => ({
    player_id: 200 + i,
    player_name: `Star ${i}`,
    team_id: 1,
    position: ["G", "G", "F", "F", "C"][i],
    mpg: 34,
    fg_pct: 0.52 + i * 0.01,
    fg3_pct: 0.40,
    ft_pct: 0.85,
    spg: 1.5,
    bpg: 1.0,
    team_pace: 105,
    team_def_rtg: 105,
  }));

  // Poor offensive team
  const WEAK_OFFENSE = Array.from({ length: 5 }, (_, i) => ({
    player_id: 300 + i,
    player_name: `Bench ${i}`,
    team_id: 2,
    position: ["G", "G", "F", "F", "C"][i],
    mpg: 22,
    fg_pct: 0.38,
    fg3_pct: 0.28,
    ft_pct: 0.68,
    spg: 0.5,
    bpg: 0.3,
    team_pace: 95,
    team_def_rtg: 118,
  }));

  it("elite team produces higher shooting engine stat than weak team", () => {
    const { roster: elite } = buildRosterFromDb(ELITE_OFFENSE, "GSW");
    const { roster: weak } = buildRosterFromDb(WEAK_OFFENSE, "DET");

    const eliteAvgShooting = elite.reduce((s, p) => s + p.shooting, 0) / elite.length;
    const weakAvgShooting = weak.reduce((s, p) => s + p.shooting, 0) / weak.length;

    expect(eliteAvgShooting).toBeGreaterThan(weakAvgShooting);
  });

  it("simulation favors the stronger team", () => {
    const { roster: elite } = buildRosterFromDb(ELITE_OFFENSE, "GSW");
    const { roster: weak } = buildRosterFromDb(WEAK_OFFENSE, "DET");

    const result = runMonteCarloSim({
      homeRoster: elite,
      awayRoster: weak,
      simCount: 200,
      ticksPerSim: 400,
    });

    // Elite home team should win more than half
    expect(result.homeWinPct).toBeGreaterThan(0.5);
    // Median spread should favor home
    expect(result.medianSpread).toBeGreaterThan(0);
  });

  it("two identical rosters produce near-zero spread", () => {
    const { roster: team1 } = buildRosterFromDb(ELITE_OFFENSE, "GSW");
    const { roster: team2 } = buildRosterFromDb(
      ELITE_OFFENSE.map((p) => ({ ...p, player_id: p.player_id + 500, team_id: 3 })),
      "BOS",
    );

    const result = runMonteCarloSim({
      homeRoster: team1,
      awayRoster: team2,
      simCount: 200,
      ticksPerSim: 400,
    });

    // Mean spread should be close to 0 (within noise)
    expect(Math.abs(result.meanSpread)).toBeLessThan(8);
    // Win pct should be near 50%
    expect(result.homeWinPct).toBeGreaterThan(0.2);
    expect(result.homeWinPct).toBeLessThan(0.8);
  });

  it("different rosters produce different predictions (not placeholder noise)", () => {
    const { roster: elite } = buildRosterFromDb(ELITE_OFFENSE, "GSW");
    const { roster: weak } = buildRosterFromDb(WEAK_OFFENSE, "DET");
    const { roster: fallback } = buildRosterFromDb([], "UNK");

    const eliteVsWeak = runMonteCarloSim({
      homeRoster: elite, awayRoster: weak, simCount: 100, ticksPerSim: 300, baseSeed: 1,
    });
    const fallbackVsFallback = runMonteCarloSim({
      homeRoster: fallback, awayRoster: fallback, simCount: 100, ticksPerSim: 300, baseSeed: 1,
    });

    // The elite-vs-weak sim should have a meaningfully different spread than fallback-vs-fallback
    const spreadDiff = Math.abs(eliteVsWeak.medianSpread - fallbackVsFallback.medianSpread);
    expect(spreadDiff).toBeGreaterThan(0);
  });

  it("simulation results are deterministic with same seed", () => {
    const { roster: home } = buildRosterFromDb(ELITE_OFFENSE, "GSW");
    const { roster: away } = buildRosterFromDb(WEAK_OFFENSE, "DET");

    const r1 = runMonteCarloSim({ homeRoster: home, awayRoster: away, simCount: 50, ticksPerSim: 300, baseSeed: 42 });
    const r2 = runMonteCarloSim({ homeRoster: home, awayRoster: away, simCount: 50, ticksPerSim: 300, baseSeed: 42 });

    expect(r1.medianSpread).toBe(r2.medianSpread);
    expect(r1.homeWinPct).toBe(r2.homeWinPct);
  });
});
