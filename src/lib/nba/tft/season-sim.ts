import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";
import { simulateGameTS } from "src/lib/nba/sim/engine-bridge";
import type { SimSeasonResult } from "src/lib/nba/tft/schema";
import { ZONE_IDS } from "src/lib/nba/tft/zones";

export interface SeasonGame { home_team_id: number; away_team_id: number; }

export interface SeasonInput {
  rosters: Record<number, EnginePlayer[]>;    // team_id -> 5-player lineup
  schedule: SeasonGame[];
  replicates: number;
  ticksPerGame: number;
  baseSeed: number;
}

export function simulateSeason(input: SeasonInput): SimSeasonResult {
  const { rosters, schedule, replicates, ticksPerGame, baseSeed } = input;

  const winsAcc: Record<number, number> = {};
  const boxAcc: Record<number, { pts: number; reb: number; ast: number; fga: number; fga3: number; count: number }> = {};
  const binAcc: Record<number, Record<string, number>> = {};

  for (let r = 0; r < replicates; r++) {
    for (let g = 0; g < schedule.length; g++) {
      const game = schedule[g];
      const home = rosters[game.home_team_id];
      const away = rosters[game.away_team_id];
      if (!home || !away) continue;
      const seed = baseSeed + r * 100000 + g;
      const result = simulateGameTS(home, away, seed, ticksPerGame);

      const winner = result.homeScore > result.awayScore ? game.home_team_id : game.away_team_id;
      winsAcc[winner] = (winsAcc[winner] ?? 0) + 1;

      for (const line of result.playerLines) {
        const b = boxAcc[line.playerId] ??= { pts: 0, reb: 0, ast: 0, fga: 0, fga3: 0, count: 0 };
        b.pts += line.pts; b.reb += line.reb; b.ast += line.ast;
        b.fga += line.fga; b.fga3 += line.fga3; b.count += 1;
        const bins = binAcc[line.playerId] ??= {};
        for (const s of line.shots) bins[s.zoneId] = (bins[s.zoneId] ?? 0) + 1;
      }
    }
  }

  const teamWins: Record<number, number> = {};
  for (const [id, w] of Object.entries(winsAcc)) teamWins[Number(id)] = w / replicates;

  const playerBoxes: SimSeasonResult["playerBoxes"] = {};
  for (const [id, b] of Object.entries(boxAcc)) {
    playerBoxes[Number(id)] = {
      pts: b.pts / b.count, reb: b.reb / b.count, ast: b.ast / b.count,
      fga: b.fga / b.count, fga3: b.fga3 / b.count,
    };
  }

  const playerShotBins: SimSeasonResult["playerShotBins"] = {};
  for (const [id, bins] of Object.entries(binAcc)) {
    const total = Object.values(bins).reduce((s, v) => s + v, 0);
    const norm: Record<string, number> = {};
    for (const z of ZONE_IDS) norm[z] = total > 0 ? (bins[z] ?? 0) / total : 0;
    playerShotBins[Number(id)] = norm;
  }

  return { teamWins, playerBoxes, playerShotBins };
}
