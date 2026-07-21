import type { SpatialPrior } from "src/lib/nba/tft/spatial-priors";
import { boardToZone, BOARD_W, BOARD_H } from "src/lib/nba/tft/court-mapping";
import type { SchemeId } from "src/lib/nba/tft/scheme-effects";

export interface SchemeSignal {
  opponentToPct: number;
  opponentMidRate: number;
  opponent3paRate: number;
  opponentCorner3Rate: number;
}

export function inferScheme(sig: SchemeSignal): SchemeId {
  if (sig.opponentToPct > 0.15) return "blitz";
  if (sig.opponentMidRate > 0.40) return "drop";
  if (sig.opponentCorner3Rate < 0.05) return "ICE";
  if (sig.opponent3paRate > 0.45) return "zone";
  return "switch";
}

export interface FormationSpot { playerId: number; x: number; y: number; }

/**
 * Places each player at the board cell whose zone matches their dominant
 * spatial-prior zone. Collisions resolved by shifting laterally.
 */
export function buildFormation(priors: SpatialPrior[]): FormationSpot[] {
  const zoneToCells: Record<string, [number, number][]> = {};
  for (let x = 0; x < BOARD_W; x++) {
    for (let y = 0; y < BOARD_H / 2; y++) { // offensive half only
      const zone = boardToZone(x, y);
      (zoneToCells[zone] ??= []).push([x, y]);
    }
  }

  const used = new Set<string>();
  const spots: FormationSpot[] = [];
  for (const p of priors) {
    const dominant = Object.entries(p.zoneShare).sort((a, b) => b[1] - a[1])[0][0];
    const cells = zoneToCells[dominant] ?? [];
    let chosen: [number, number] | undefined;
    for (const c of cells) {
      const key = `${c[0]},${c[1]}`;
      if (!used.has(key)) { chosen = c; used.add(key); break; }
    }
    if (!chosen) {
      // Fall back to any free offensive cell
      outer: for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H / 2; y++) {
          const key = `${x},${y}`;
          if (!used.has(key)) { chosen = [x, y]; used.add(key); break outer; }
        }
      }
    }
    if (!chosen) throw new Error("No free board cell for formation");
    spots.push({ playerId: p.playerId, x: chosen[0], y: chosen[1] });
  }
  return spots;
}
