/**
 * Multi-objective regression loss for the TFT engine backtest.
 * Per spec §Regression harness: weighted sum of team-W/L MAE, per-player
 * box RMSE (normalized by league stddev), and per-player 8-bin shot
 * distribution Jensen-Shannon divergence.
 */
import { ZONE_IDS } from "src/lib/nba/tft/zones";

export type TeamWins = Record<number, number>;
export type PlayerBoxes = Record<number, { pts: number; reb: number; ast: number; fga: number; fga3: number }>;
export type PlayerShotBins = Record<number, Record<string, number>>;

const REGULAR_SEASON_GAMES = 82;
const MIN_MINUTES_FOR_BOX_LOSS = 500;

/** MAE of sim wins vs actual wins, divided by 82 (∈ [0, 1]). */
export function lossWL(sim: TeamWins, actual: TeamWins): number {
  const teams = Object.keys(actual).map(Number);
  if (teams.length === 0) return 0;
  const mae = teams.reduce((s, t) => s + Math.abs((sim[t] ?? 0) - actual[t]), 0) / teams.length;
  return mae / REGULAR_SEASON_GAMES;
}

// League-average stddevs, hand-encoded from 2024-26 pooled data.
const LEAGUE_STDDEV = { pts: 8.2, reb: 3.1, ast: 2.4 };

/** Normalized RMSE across (PTS/G, REB/G, AST/G) for players with >= minMinutes minutes. */
export function lossBox(sim: PlayerBoxes, actual: PlayerBoxes, minutes: Record<number, number>): number {
  const players = Object.keys(actual).map(Number)
    .filter((p) => (minutes[p] ?? 0) >= MIN_MINUTES_FOR_BOX_LOSS);
  if (players.length === 0) return 0;
  let sumSq = 0;
  for (const p of players) {
    const s = sim[p] ?? { pts: 0, reb: 0, ast: 0, fga: 0, fga3: 0 };
    const a = actual[p];
    sumSq += ((s.pts - a.pts) / LEAGUE_STDDEV.pts) ** 2;
    sumSq += ((s.reb - a.reb) / LEAGUE_STDDEV.reb) ** 2;
    sumSq += ((s.ast - a.ast) / LEAGUE_STDDEV.ast) ** 2;
  }
  return Math.sqrt(sumSq / (players.length * 3));
}

/**
 * Jensen-Shannon divergence between two normalized distributions over the 8 zones.
 * Returns value in [0, 1].
 * Handles edge cases: zero entries in either distribution are skipped in KL sum
 * (convention: 0 * log(0/x) = 0, 0 * log(x/0) excluded when mixture m[z] > 0
 * but p[z] = 0, which contributes 0 to kl(p, m) since p[z]=0).
 */
function jsDivergence(p: Record<string, number>, q: Record<string, number>): number {
  const m: Record<string, number> = {};
  for (const z of ZONE_IDS) m[z] = 0.5 * ((p[z] ?? 0) + (q[z] ?? 0));
  const kl = (a: Record<string, number>, b: Record<string, number>) => {
    let s = 0;
    for (const z of ZONE_IDS) {
      const av = a[z] ?? 0;
      const bv = b[z] ?? 0;
      // 0 * log(0 / bv) = 0 by convention; skip when av=0
      // bv=0 with av>0 would be log(av/0)=Infinity — but m[z] = 0.5*(p+q),
      // so if b=m then bv=0 only when both av=0 and qv=0, meaning av=0 too.
      if (av > 0 && bv > 0) s += av * Math.log2(av / bv);
    }
    return s;
  };
  return 0.5 * (kl(p, m) + kl(q, m));
}

/** Volume-weighted mean JS divergence across players. */
export function lossSpatial(sim: PlayerShotBins, actual: PlayerShotBins, volume: Record<number, number>): number {
  const players = Object.keys(actual).map(Number);
  if (players.length === 0) return 0;
  let sum = 0;
  let w = 0;
  for (const p of players) {
    const wt = volume[p] ?? 1;
    sum += wt * jsDivergence(sim[p] ?? {}, actual[p]);
    w += wt;
  }
  return w > 0 ? sum / w : 0;
}

export interface LossWeights { wl: number; box: number; spa: number; }
export interface LossParts { wl: number; box: number; spa: number; }

export function combinedLoss(parts: LossParts, weights: LossWeights): number {
  return weights.wl * parts.wl + weights.box * parts.box + weights.spa * parts.spa;
}

export const DEFAULT_WEIGHTS: LossWeights = { wl: 0.4, box: 0.4, spa: 0.2 };
