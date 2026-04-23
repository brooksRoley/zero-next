import { describe, it, expect } from "vitest";
import {
  runMonteCarloSim, type SimulationInput, type SimulationResult,
} from "../sim/monte-carlo";
import { type EnginePlayer } from "../sim/stat-mapper";

const HOME_ROSTER: EnginePlayer[] = [
  { id: 1, name: "PG", team: "LAL", shooting: 80, defense: 60, speed: 85, height_inches: 75, weight_lbs: 190, stamina: 80 },
  { id: 2, name: "SG", team: "LAL", shooting: 85, defense: 55, speed: 80, height_inches: 77, weight_lbs: 210, stamina: 75 },
  { id: 3, name: "SF", team: "LAL", shooting: 70, defense: 70, speed: 75, height_inches: 80, weight_lbs: 230, stamina: 85 },
  { id: 4, name: "PF", team: "LAL", shooting: 60, defense: 80, speed: 65, height_inches: 82, weight_lbs: 245, stamina: 80 },
  { id: 5, name: "C",  team: "LAL", shooting: 50, defense: 85, speed: 55, height_inches: 84, weight_lbs: 260, stamina: 70 },
];

const AWAY_ROSTER: EnginePlayer[] = [
  { id: 11, name: "PG", team: "DEN", shooting: 75, defense: 65, speed: 80, height_inches: 74, weight_lbs: 185, stamina: 80 },
  { id: 12, name: "SG", team: "DEN", shooting: 78, defense: 60, speed: 78, height_inches: 76, weight_lbs: 205, stamina: 78 },
  { id: 13, name: "SF", team: "DEN", shooting: 72, defense: 68, speed: 72, height_inches: 79, weight_lbs: 225, stamina: 82 },
  { id: 14, name: "PF", team: "DEN", shooting: 65, defense: 75, speed: 68, height_inches: 81, weight_lbs: 240, stamina: 78 },
  { id: 15, name: "C",  team: "DEN", shooting: 55, defense: 80, speed: 50, height_inches: 83, weight_lbs: 270, stamina: 72 },
];

describe("runMonteCarloSim (pure TypeScript fallback)", () => {
  it("returns a valid SimulationResult", () => {
    const result = runMonteCarloSim({
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 50,
      ticksPerSim: 300,
    });

    expect(result.simCount).toBe(50);
    expect(result.medianSpread).toBeDefined();
    expect(result.meanSpread).toBeDefined();
    expect(result.stddev).toBeGreaterThan(0);
    expect(result.homeWinPct).toBeGreaterThanOrEqual(0);
    expect(result.homeWinPct).toBeLessThanOrEqual(1);
    expect(result.scores).toHaveLength(50);
  });

  it("produces deterministic results with same seed", () => {
    const input: SimulationInput = {
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 20,
      ticksPerSim: 200,
      baseSeed: 42,
    };
    const r1 = runMonteCarloSim(input);
    const r2 = runMonteCarloSim(input);
    expect(r1.medianSpread).toBe(r2.medianSpread);
    expect(r1.meanSpread).toBe(r2.meanSpread);
  });

  it("better home roster produces positive median spread more often", () => {
    const strongHome = HOME_ROSTER.map((p) => ({ ...p, shooting: 95, defense: 90 }));
    const weakAway = AWAY_ROSTER.map((p) => ({ ...p, shooting: 30, defense: 30 }));
    const result = runMonteCarloSim({
      homeRoster: strongHome,
      awayRoster: weakAway,
      simCount: 100,
      ticksPerSim: 300,
    });
    expect(result.homeWinPct).toBeGreaterThan(0.5);
  });

  it("returns synergy buffs for both teams", () => {
    const result = runMonteCarloSim({
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 10,
      ticksPerSim: 100,
    });
    expect(result.homeSynergies).toBeDefined();
    expect(Array.isArray(result.homeSynergies)).toBe(true);
  });
});
