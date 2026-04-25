/**
 * Monte Carlo simulation runner.
 * Runs N game simulations and aggregates score distributions.
 */
import type { EnginePlayer } from "./stat-mapper";
import { simulateGameTS, type SimScore } from "./engine-bridge";

export interface SimulationInput {
  homeRoster: EnginePlayer[];
  awayRoster: EnginePlayer[];
  simCount: number;
  ticksPerSim: number;
  baseSeed?: number;
}

export interface SimulationResult {
  simCount: number;
  medianSpread: number;
  meanSpread: number;
  stddev: number;
  homeWinPct: number;
  scores: { homeScore: number; awayScore: number; spread: number }[];
  homeSynergies: SimScore["synergies"];
  awaySynergies: SimScore["synergies"];
}

export function runMonteCarloSim(input: SimulationInput): SimulationResult {
  const { homeRoster, awayRoster, simCount, ticksPerSim, baseSeed = 1 } = input;
  const scores: SimulationResult["scores"] = [];
  let homeSynergies: SimScore["synergies"] = [];
  let awaySynergies: SimScore["synergies"] = [];

  for (let i = 0; i < simCount; i++) {
    const seed = baseSeed + i;
    const result = simulateGameTS(homeRoster, awayRoster, seed, ticksPerSim);

    // Capture synergies from first sim (same roster = same synergies)
    if (i === 0) {
      homeSynergies = result.synergies;
      // Run reverse for away synergies
      const awayResult = simulateGameTS(awayRoster, homeRoster, seed + 100000, ticksPerSim);
      awaySynergies = awayResult.synergies;
    }

    const spread = result.homeScore - result.awayScore;
    scores.push({ homeScore: result.homeScore, awayScore: result.awayScore, spread });
  }

  const spreads = scores.map((s) => s.spread).sort((a, b) => a - b);
  const mid = Math.floor(spreads.length / 2);
  const medianSpread = spreads.length % 2 === 0
    ? (spreads[mid - 1] + spreads[mid]) / 2
    : spreads[mid];

  const meanSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const variance = spreads.reduce((s, v) => s + (v - meanSpread) ** 2, 0) / spreads.length;
  const stddev = Math.sqrt(variance);
  const homeWins = scores.filter((s) => s.spread > 0).length;
  const homeWinPct = homeWins / simCount;

  return {
    simCount,
    medianSpread: Math.round(medianSpread * 10) / 10,
    meanSpread: Math.round(meanSpread * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    homeWinPct: Math.round(homeWinPct * 1000) / 1000,
    scores,
    homeSynergies,
    awaySynergies,
  };
}
