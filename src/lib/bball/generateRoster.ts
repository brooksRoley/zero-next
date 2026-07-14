import type { RosterPlayer } from "src/lib/bball/roster";
import type { EspnSeasonStats, EspnRosterStatus } from "src/lib/bball/espn";

/**
 * Turns real season averages into the engine roster contract
 * (shared-core schema/engine_roster.schema.json).
 *
 * Ratings follow StatNormalizer::ConvertZScoreToGameStat exactly:
 * 50 + z*20, rounded, clamped [1, 99], with z computed over the qualified
 * pool. The schema's source metrics are approximated from what ESPN exposes:
 *  - shooting — z of points per game (schema-exact)
 *  - speed    — z of assists+steals (proxy: ESPN has no speed/tracking metric)
 *  - defense  — z of steals+blocks+rebounds (proxy for defensive win shares)
 *
 * Cost is the schema's salary-cap tiering replaced by composite-rank quotas:
 * we have no salary feed, and fixed tier sizes keep the shop's combine odds
 * stable no matter how the league's stat distribution shifts. Quotas shape
 * the pool like TFT: few 5-costs, a wide 1-cost floor.
 *
 * Team comes from the *current* ESPN roster, not the season stats — that is
 * the free-agency signal. Qualified players on no roster stay draftable as
 * team "FA" (no franchise synergy until they sign).
 */

export const DEFAULT_TARGET_SIZE = 96;
export const MIN_GAMES_PLAYED = 20;
export const MIN_AVG_MINUTES = 15;

/** Fraction of the roster at each cost, highest cost first. Sums to 1. */
const COST_SHARES: Array<[cost: number, share: number]> = [
  [5, 0.08],
  [4, 0.14],
  [3, 0.2],
  [2, 0.27],
  [1, 0.31],
];

function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  // Relative epsilon, not === 0: a uniform pool's mean can differ from its
  // values by 1 ulp, leaving std ~1e-16 and z exactly ±1 (rating 70/30).
  if (std < 1e-9 * Math.max(1, Math.abs(mean))) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

/** StatNormalizer::ConvertZScoreToGameStat — keep in sync with shared-core. */
export function zToRating(z: number): number {
  return Math.min(99, Math.max(1, Math.round(50 + z * 20)));
}

/** How many players land at each cost for a roster of `size`. */
export function costCounts(size: number): Map<number, number> {
  const counts = new Map<number, number>();
  let assigned = 0;
  for (const [cost, share] of COST_SHARES.slice(0, -1)) {
    const n = Math.round(size * share);
    counts.set(cost, n);
    assigned += n;
  }
  const [floorCost] = COST_SHARES[COST_SHARES.length - 1];
  counts.set(floorCost, Math.max(0, size - assigned));
  return counts;
}

export type GenerateOptions = {
  targetSize?: number;
  minGamesPlayed?: number;
  minAvgMinutes?: number;
};

export function generateRoster(
  stats: EspnSeasonStats[],
  statuses: Map<number, EspnRosterStatus>,
  options: GenerateOptions = {}
): RosterPlayer[] {
  const {
    targetSize = DEFAULT_TARGET_SIZE,
    minGamesPlayed = MIN_GAMES_PLAYED,
    minAvgMinutes = MIN_AVG_MINUTES,
  } = options;

  const pool = stats.filter(
    (p) => p.gamesPlayed >= minGamesPlayed && p.avgMinutes >= minAvgMinutes
  );
  if (pool.length === 0) return [];

  const zShoot = zScores(pool.map((p) => p.avgPoints));
  const zSpeed = zScores(pool.map((p) => 0.6 * p.avgAssists + 0.4 * p.avgSteals));
  const zDef = zScores(
    pool.map((p) => p.avgSteals + p.avgBlocks + 0.25 * p.avgRebounds)
  );

  const rated = pool.map((p, i) => ({
    player: p,
    shooting: zToRating(zShoot[i]),
    speed: zToRating(zSpeed[i]),
    defense: zToRating(zDef[i]),
    // Scoring drives price the way salary does; defense and playmaking split
    // the rest. Ties broken by name so output is deterministic.
    composite: 0.5 * zShoot[i] + 0.25 * zSpeed[i] + 0.25 * zDef[i],
  }));
  rated.sort(
    (a, b) => b.composite - a.composite || a.player.name.localeCompare(b.player.name)
  );

  const size = Math.min(targetSize, rated.length);
  const counts = costCounts(size);
  const roster: RosterPlayer[] = [];
  let index = 0;
  for (const [cost] of COST_SHARES) {
    const n = counts.get(cost) ?? 0;
    for (let k = 0; k < n && index < size; k++, index++) {
      const { player, shooting, speed, defense } = rated[index];
      const status = statuses.get(player.id);
      roster.push({
        id: player.id,
        name: player.name,
        team: status?.team || "FA",
        cost,
        is_active: true,
        injury_status: status?.injuryStatus ?? "",
        stats: { shooting, speed, defense },
      });
    }
  }

  roster.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
  return roster;
}
