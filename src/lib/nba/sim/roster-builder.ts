/**
 * Converts DB roster rows into RealPlayerStats for the simulation engine.
 * Bridges the gap between what the gold tables store and what stat-mapper expects.
 */
import { mapRosterToEngine, type EnginePlayer, type RealPlayerStats } from "./stat-mapper";
import { NBA_TEAMS } from "../teams-static";

/** Row shape returned by `getTeamRosterForSim` — one player's gold-layer
 *  per-game stats plus their team's pace/def_rtg context. */
export type RosterSimRow = {
  player_id: number | string;
  player_name: string;
  team_id: number | string;
  position?: string | null;
  games_played?: number | string | null;
  mpg?: number | string | null;
  ppg?: number | string | null;
  rpg?: number | string | null;
  apg?: number | string | null;
  spg?: number | string | null;
  bpg?: number | string | null;
  fg_pct?: number | string | null;
  fg3_pct?: number | string | null;
  ft_pct?: number | string | null;
  team_pace?: number | string | null;
  team_def_rtg?: number | string | null;
};

/** Resolve "Los Angeles Lakers" → team_id + abbreviation */
export function resolveTeam(fullName: string): { id: number; abbrev: string } | null {
  const team = NBA_TEAMS.find((t) => t.full_name === fullName);
  if (team) return { id: team.id, abbrev: team.abbreviation };
  // Fallback: partial match on city + nickname
  const lower = fullName.toLowerCase();
  const fuzzy = NBA_TEAMS.find(
    (t) => lower.includes(t.city.toLowerCase()) && lower.includes(t.nickname.toLowerCase()),
  );
  return fuzzy ? { id: fuzzy.id, abbrev: fuzzy.abbreviation } : null;
}

// Position-based defaults for height/weight when DB lacks bio data
const POSITION_DEFAULTS: Record<string, { height_inches: number; weight_lbs: number }> = {
  G: { height_inches: 75, weight_lbs: 195 },
  F: { height_inches: 79, weight_lbs: 225 },
  C: { height_inches: 83, weight_lbs: 250 },
  "G-F": { height_inches: 77, weight_lbs: 210 },
  "F-G": { height_inches: 77, weight_lbs: 210 },
  "F-C": { height_inches: 81, weight_lbs: 240 },
  "C-F": { height_inches: 81, weight_lbs: 240 },
};

const DEFAULT_BIO = { height_inches: 78, weight_lbs: 215 };

/**
 * Convert a DB roster row (from getTeamRosterForSim) into RealPlayerStats.
 * Derives missing advanced stats from available per-game data.
 */
export function dbRowToRealStats(row: RosterSimRow): RealPlayerStats {
  const bio = POSITION_DEFAULTS[row.position ?? ""] ?? DEFAULT_BIO;
  const fgPct = Number(row.fg_pct) || 0.45;
  const fg3Pct = Number(row.fg3_pct) || 0.33;
  const ftPct = Number(row.ft_pct) || 0.75;
  const mpg = Number(row.mpg) || 20;

  // Estimate TS% as weighted blend of shooting percentages
  const tsPct = fgPct * 0.6 + fg3Pct * 0.2 + ftPct * 0.2;

  // Convert per-game steals/blocks to pseudo-percentages (league avg ~1.0 stl, ~0.5 blk)
  const stlPct = (Number(row.spg) || 0.8) * 1.5;
  const blkPct = (Number(row.bpg) || 0.4) * 2.0;

  return {
    player_id: Number(row.player_id),
    player_name: String(row.player_name),
    team_id: Number(row.team_id),
    fg_pct: fgPct,
    ts_pct: tsPct,
    fg3_pct: fg3Pct,
    def_rtg: Number(row.team_def_rtg) || 110,
    stl_pct: stlPct,
    blk_pct: blkPct,
    pace: Number(row.team_pace) || 100,
    mpg,
    age: 27, // Default — bio data not in current schema
    height_inches: bio.height_inches,
    weight_lbs: bio.weight_lbs,
  };
}

/** Fallback roster when DB has no data for a team */
export function fallbackRoster(teamAbbrev: string): EnginePlayer[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: `${teamAbbrev} Player ${i + 1}`,
    team: teamAbbrev,
    shooting: 65,
    defense: 60,
    speed: 65,
    height_inches: 78,
    weight_lbs: 215,
    stamina: 75,
  }));
}

/**
 * Build an EnginePlayer[] roster from DB rows.
 * Returns fallback roster if fewer than 5 players available.
 */
export function buildRosterFromDb(rows: RosterSimRow[], teamAbbrev: string): { roster: EnginePlayer[]; source: "db" | "fallback" } {
  if (rows.length < 5) {
    return { roster: fallbackRoster(teamAbbrev), source: "fallback" };
  }
  const stats = rows.map(dbRowToRealStats);
  return { roster: mapRosterToEngine(stats, teamAbbrev), source: "db" };
}
