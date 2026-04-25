/**
 * Maps real NBA player stats to engine 0-100 scale.
 * Calibration coefficients are the tuning target.
 */

export interface RealPlayerStats {
  player_id: number;
  player_name: string;
  team_id: number;
  fg_pct: number;      // 0-1
  ts_pct: number;      // 0-1 (True Shooting %)
  fg3_pct: number;     // 0-1
  def_rtg: number;     // ~95-120 (lower = better)
  stl_pct: number;     // 0-5ish
  blk_pct: number;     // 0-5ish
  pace: number;        // ~95-110
  mpg: number;         // 0-48
  age: number;
  height_inches: number;
  weight_lbs: number;
}

export interface EnginePlayer {
  id: number;
  name: string;
  team: string;
  shooting: number;    // 0-100
  defense: number;     // 0-100
  speed: number;       // 0-100
  height_inches: number;
  weight_lbs: number;
  stamina: number;     // 0-100
}

export interface CalibrationCoefficients {
  shooting: { ts_weight: number; fg_weight: number; fg3_weight: number; scale: number; offset: number };
  defense: { drtg_weight: number; stl_weight: number; blk_weight: number; drtg_center: number; scale: number };
  speed: { pace_weight: number; pace_center: number; age_penalty: number; scale: number };
  stamina: { mpg_weight: number; age_penalty: number; scale: number };
}

export const DEFAULT_COEFFICIENTS: CalibrationCoefficients = {
  shooting: { ts_weight: 0.4, fg_weight: 0.3, fg3_weight: 0.3, scale: 130, offset: 10 },
  defense: { drtg_weight: 0.5, stl_weight: 0.25, blk_weight: 0.25, drtg_center: 110, scale: 3.0 },
  speed: { pace_weight: 0.7, pace_center: 100, age_penalty: 0.5, scale: 5.0 },
  stamina: { mpg_weight: 2.0, age_penalty: 0.8, scale: 1.0 },
};

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

export function mapPlayerToEngine(
  player: RealPlayerStats,
  coeffs: CalibrationCoefficients = DEFAULT_COEFFICIENTS,
): EnginePlayer {
  const c = coeffs;

  // Shooting: weighted blend of TS%, FG%, FG3%, scaled to 0-100
  const shootingRaw =
    (player.ts_pct * c.shooting.ts_weight +
     player.fg_pct * c.shooting.fg_weight +
     player.fg3_pct * c.shooting.fg3_weight) *
    c.shooting.scale + c.shooting.offset;

  // Defense: inverse DRTG (lower = better) + steal/block blend
  const drtgScore = (c.defense.drtg_center - player.def_rtg) * c.defense.drtg_weight * c.defense.scale;
  const stealScore = player.stl_pct * c.defense.stl_weight * 10;
  const blockScore = player.blk_pct * c.defense.blk_weight * 10;
  const defenseRaw = 50 + drtgScore + stealScore + blockScore;

  // Speed: pace percentile + age decay
  const paceScore = (player.pace - c.speed.pace_center) * c.speed.pace_weight * c.speed.scale;
  const agePenalty = Math.max(0, (player.age - 28) * c.speed.age_penalty);
  const speedRaw = 60 + paceScore - agePenalty;

  // Stamina: MPG-based + age decay
  const staminaRaw = player.mpg * c.stamina.mpg_weight - Math.max(0, (player.age - 30) * c.stamina.age_penalty * 5);

  return {
    id: player.player_id,
    name: player.player_name,
    team: "",
    shooting: clamp(Math.round(shootingRaw)),
    defense: clamp(Math.round(defenseRaw)),
    speed: clamp(Math.round(speedRaw)),
    height_inches: player.height_inches,
    weight_lbs: player.weight_lbs,
    stamina: clamp(Math.round(staminaRaw)),
  };
}

export function mapRosterToEngine(
  players: RealPlayerStats[],
  teamAbbrev: string,
  coeffs: CalibrationCoefficients = DEFAULT_COEFFICIENTS,
): EnginePlayer[] {
  return players.map((p) => {
    const mapped = mapPlayerToEngine(p, coeffs);
    mapped.team = teamAbbrev;
    return mapped;
  });
}
