/**
 * Monte Carlo simulation runner.
 * Runs N game simulations and aggregates score distributions and per-player stats.
 */
import type { EnginePlayer } from "./stat-mapper";
import { simulateGameTS, type SimScore, type SimGameResult } from "./engine-bridge";

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
  /**
   * Mean per-player box stats across all replicates.
   * Key is playerId. Values are per-game averages (sum / simCount).
   */
  playerBoxes: Record<number, { pts: number; reb: number; ast: number; fga: number; fga3: number }>;
  /**
   * Per-player shot distribution by zone, normalized to fractions (0..1).
   * Key is playerId; value maps zoneId → fraction of that player's total shots.
   */
  playerShotBins: Record<number, Record<string, number>>;
}

export function runMonteCarloSim(input: SimulationInput): SimulationResult {
  const { homeRoster, awayRoster, simCount, ticksPerSim, baseSeed = 1 } = input;
  const scores: SimulationResult["scores"] = [];
  let homeSynergies: SimScore["synergies"] = [];
  let awaySynergies: SimScore["synergies"] = [];

  // Accumulators for per-player aggregation
  // playerSums: playerId → running totals
  const playerSums = new Map<number, { pts: number; reb: number; ast: number; fga: number; fga3: number; games: number }>();
  // playerZoneSums: playerId → zoneId → shot count
  const playerZoneSums = new Map<number, Record<string, number>>();

  function ensurePlayer(id: number) {
    if (!playerSums.has(id)) {
      playerSums.set(id, { pts: 0, reb: 0, ast: 0, fga: 0, fga3: 0, games: 0 });
    }
    if (!playerZoneSums.has(id)) {
      playerZoneSums.set(id, {});
    }
  }

  for (let i = 0; i < simCount; i++) {
    const seed = baseSeed + i;
    const result: SimGameResult = simulateGameTS(homeRoster, awayRoster, seed, ticksPerSim);

    // Capture synergies from first sim (same roster = same synergies)
    if (i === 0) {
      homeSynergies = result.synergies;
      // Run reverse for away synergies
      const awayResult = simulateGameTS(awayRoster, homeRoster, seed + 100000, ticksPerSim);
      awaySynergies = awayResult.synergies;
    }

    const spread = result.homeScore - result.awayScore;
    scores.push({ homeScore: result.homeScore, awayScore: result.awayScore, spread });

    // Aggregate per-player stats for this replicate
    for (const line of result.playerLines) {
      ensurePlayer(line.playerId);
      const sums = playerSums.get(line.playerId)!;
      sums.pts += line.pts;
      sums.reb += line.reb;
      sums.ast += line.ast;
      sums.fga += line.fga;
      sums.fga3 += line.fga3;
      sums.games += 1;

      const zoneSums = playerZoneSums.get(line.playerId)!;
      for (const shot of line.shots) {
        zoneSums[shot.zoneId] = (zoneSums[shot.zoneId] ?? 0) + 1;
      }
    }
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

  // Build playerBoxes: mean stats per game appeared (divide by simCount, since every
  // player appears in every replicate)
  const playerBoxes: SimulationResult["playerBoxes"] = {};
  for (const [id, sums] of playerSums) {
    const n = sums.games; // = simCount for all starting players
    playerBoxes[id] = {
      pts:  Math.round((sums.pts  / n) * 10) / 10,
      reb:  Math.round((sums.reb  / n) * 10) / 10,
      ast:  Math.round((sums.ast  / n) * 10) / 10,
      fga:  Math.round((sums.fga  / n) * 10) / 10,
      fga3: Math.round((sums.fga3 / n) * 10) / 10,
    };
  }

  // Build playerShotBins: normalize zone counts to fractions
  const playerShotBins: SimulationResult["playerShotBins"] = {};
  for (const [id, zoneSums] of playerZoneSums) {
    const total = Object.values(zoneSums).reduce((a, b) => a + b, 0);
    if (total === 0) {
      playerShotBins[id] = {};
    } else {
      const bins: Record<string, number> = {};
      for (const [zone, count] of Object.entries(zoneSums)) {
        bins[zone] = Math.round((count / total) * 1000) / 1000;
      }
      playerShotBins[id] = bins;
    }
  }

  return {
    simCount,
    medianSpread: Math.round(medianSpread * 10) / 10,
    meanSpread: Math.round(meanSpread * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    homeWinPct: Math.round(homeWinPct * 1000) / 1000,
    scores,
    homeSynergies,
    awaySynergies,
    playerBoxes,
    playerShotBins,
  };
}
