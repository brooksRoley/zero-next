/**
 * Synthesizes per-player 8-zone shot-origin distributions from public
 * aggregate stats (position, height, scoring volume, 3PA share).
 * Replaces the spec's raw stats.nba.com shot ingest — that endpoint died in
 * 2026. When real shot-chart data becomes available later, this module's
 * output is drop-in replaced without touching regression.ts.
 *
 * The "z" dimension is expected shot difficulty ∈ [0, 1] per zone, a proxy
 * for defender pressure (used later by regression as a 2nd-moment target).
 */
import { ZONE_IDS } from "src/lib/nba/tft/zones";

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export interface PlayerProfile {
  playerId: number;
  position: Position;
  heightInches: number;
  avgPoints: number;
  threePtRate: number; // 3PA / FGA
  fgPct: number;
  threePct: number;
}

export interface SpatialPrior {
  playerId: number;
  zoneShare: Record<string, number>;      // sums to 1
  zoneDifficulty: Record<string, number>; // ∈ [0, 1]
}

// League-average zone shares by position (hand-encoded from Basketball
// Reference aggregates, 2024-26 pooled). Rows sum to 1.
const POSITION_BASELINE: Record<Position, Record<string, number>> = {
  PG: { paint: 0.28, "left-mid": 0.06, "right-mid": 0.06,
        "left-corner-3": 0.05, "right-corner-3": 0.05,
        "left-wing-3": 0.13, "right-wing-3": 0.13, "top-of-key": 0.24 },
  SG: { paint: 0.24, "left-mid": 0.07, "right-mid": 0.07,
        "left-corner-3": 0.08, "right-corner-3": 0.08,
        "left-wing-3": 0.14, "right-wing-3": 0.14, "top-of-key": 0.18 },
  SF: { paint: 0.28, "left-mid": 0.08, "right-mid": 0.08,
        "left-corner-3": 0.09, "right-corner-3": 0.09,
        "left-wing-3": 0.13, "right-wing-3": 0.13, "top-of-key": 0.12 },
  PF: { paint: 0.42, "left-mid": 0.10, "right-mid": 0.10,
        "left-corner-3": 0.06, "right-corner-3": 0.06,
        "left-wing-3": 0.09, "right-wing-3": 0.09, "top-of-key": 0.08 },
  C:  { paint: 0.68, "left-mid": 0.08, "right-mid": 0.08,
        "left-corner-3": 0.02, "right-corner-3": 0.02,
        "left-wing-3": 0.04, "right-wing-3": 0.04, "top-of-key": 0.04 },
};

// Base difficulty per zone (0 = wide open, 1 = tightly contested).
const ZONE_BASE_DIFFICULTY: Record<string, number> = {
  paint: 0.75,          // paint is heavily contested at the NBA level
  "left-mid": 0.55, "right-mid": 0.55,
  "left-corner-3": 0.35, "right-corner-3": 0.35,
  "left-wing-3": 0.50, "right-wing-3": 0.50,
  "top-of-key": 0.60,   // primary handler zone, closeouts arrive fast
};

// Height override: 6'10"+ centers get an even stronger paint tilt regardless
// of position label (some listed PFs are effectively 5s).
const HEIGHT_PAINT_BONUS_INCHES = 82;

function tiltFor3PT(baseline: Record<string, number>, rate: number): Record<string, number> {
  // rate ≈ 0.35 is league average. Above → shift attempts from paint/mid to 3s.
  const shift = Math.max(-0.15, Math.min(0.35, rate - 0.35));
  const scale = 1 + shift;
  const threeIds = ["left-corner-3", "right-corner-3", "left-wing-3", "right-wing-3", "top-of-key"];
  const twoIds = ["paint", "left-mid", "right-mid"];
  const out: Record<string, number> = { ...baseline };
  for (const z of threeIds) out[z] = baseline[z] * scale;
  for (const z of twoIds) out[z] = baseline[z] * (2 - scale);
  return out;
}

function normalize(dist: Record<string, number>): Record<string, number> {
  const total = ZONE_IDS.reduce((s, z) => s + (dist[z] ?? 0), 0);
  const out: Record<string, number> = {};
  for (const z of ZONE_IDS) out[z] = (dist[z] ?? 0) / total;
  return out;
}

export function generateSpatialPrior(p: PlayerProfile): SpatialPrior {
  let dist = { ...POSITION_BASELINE[p.position] };
  dist = tiltFor3PT(dist, p.threePtRate);

  if (p.heightInches >= HEIGHT_PAINT_BONUS_INCHES) {
    // Bias 15% of non-paint mass into paint.
    const nonPaint = ZONE_IDS.filter((z) => z !== "paint");
    for (const z of nonPaint) {
      const move = dist[z] * 0.15;
      dist[z] -= move;
      dist.paint += move;
    }
  }

  const zoneShare = normalize(dist);
  return {
    playerId: p.playerId,
    zoneShare,
    zoneDifficulty: { ...ZONE_BASE_DIFFICULTY },
  };
}
