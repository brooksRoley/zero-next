/**
 * Read & React — curated concept campaign as data.
 *
 * Each level is a zero-sum matchup: offense `plays` (rows) vs defense `schemes`
 * (columns). `makeGrid[play][scheme]` is the scheme-adjusted make% for that
 * matchup; the EV matrix the solver/game use is derived as make% × points, so
 * make% is the single source of truth (it also drives random shot resolution).
 *
 * Numbers are grounded in the TFT `ZONES` base efficiencies (paint ~0.62 x 2,
 * corner-3 ~0.39 x 3, mid ~0.42 x 2) shifted by each scheme's intent (drop
 * protects the paint, blitz walls the paint but concedes threes, etc.).
 *
 * `intendedType` is validated against the real solver in levels.test.ts:
 * "dominant" → the equilibrium offense mix is ~pure; "mixed" → no single play
 * carries ~all the weight (you must vary your looks).
 */
import type { Matrix } from "./matrixGame";

export interface RRPlay {
  id: string;
  label: string;
  pts: 2 | 3;
}

export interface RRScheme {
  id: string;
  label: string;
}

export interface RRLevel {
  id: string;
  title: string;
  concept: string;
  plays: RRPlay[];
  schemes: RRScheme[];
  /** makeGrid[playIndex][schemeIndex] = make probability in [0,1]. */
  makeGrid: number[][];
  teaching: string;
  intendedType: "dominant" | "mixed";
  /** Possessions in the series. Default 12. */
  possessions: number;
}

/** Derived EV payoff matrix (points to offense): make% × play points. */
export function evMatrix(level: RRLevel): Matrix {
  return level.makeGrid.map((row, i) => row.map((p) => p * level.plays[i].pts));
}

const PAINT: RRPlay = { id: "paint", label: "Attack the Paint", pts: 2 };
const MID: RRPlay = { id: "mid", label: "Mid-Range Pull-Up", pts: 2 };
const CORNER3: RRPlay = { id: "corner3", label: "Kick to the Corner 3", pts: 3 };

export const LEVELS: RRLevel[] = [
  {
    id: "take-the-open-shot",
    title: "Take the Open Shot",
    concept: "dominant strategy",
    plays: [PAINT, MID],
    schemes: [
      { id: "drop", label: "Drop" },
      { id: "switch", label: "Switch" },
    ],
    makeGrid: [
      [0.56, 0.6], // Paint: 1.12, 1.20
      [0.44, 0.42], // Mid: 0.88, 0.84
    ],
    teaching:
      "Not every read is a mind game. Here attacking the paint beats the mid-range pull-up against BOTH coverages — it's a dominant strategy. When one play wins no matter what the defense does, you don't mix: you take it every possession. (The defense's best answer, Drop, still can't get you under 1.12 points a trip.)",
    intendedType: "dominant",
    possessions: 10,
  },
  {
    id: "pick-your-poison",
    title: "Pick Your Poison",
    concept: "no dominant strategy — you must mix",
    plays: [PAINT, CORNER3],
    schemes: [
      { id: "pack", label: "Pack the Paint" },
      { id: "chase", label: "Chase Shooters" },
    ],
    makeGrid: [
      [0.42, 0.62], // Paint: 0.84 vs pack, 1.24 vs chase
      [0.39, 0.25], // Corner3: 1.17 vs pack, 0.75 vs chase
    ],
    teaching:
      "The paint is your best shot (1.24) — but only if the defense is chasing shooters. Pack the paint and the corner three becomes the value play. Neither shot wins against both coverages, so there's no single right answer: you have to mix, and keep the defense guessing. Spam your favorite and a smart defense will sit on it.",
    intendedType: "mixed",
    possessions: 12,
  },
  {
    id: "three-bad-options",
    title: "Three Bad Options",
    concept: "3×3 equilibrium",
    plays: [PAINT, CORNER3, MID],
    schemes: [
      { id: "drop", label: "Drop" },
      { id: "blitz", label: "Blitz" },
      { id: "ice", label: "ICE" },
    ],
    makeGrid: [
      [0.5, 0.36, 0.62], // Paint: 1.00, 0.72, 1.24
      [0.36, 0.46, 0.3], // Corner3: 1.08, 1.38, 0.90
      [0.45, 0.48, 0.44], // Mid: 0.90, 0.96, 0.88
    ],
    teaching:
      "Three plays, three coverages, and every play has a coverage that eats it. The defense will drift toward whatever you lean on, so the equilibrium spreads your shots across more than one option. Read the reveal at the end: the winning mix isn't 'always the highest-EV shot' — it's the blend the defense can't key on.",
    intendedType: "mixed",
    possessions: 14,
  },
  {
    id: "the-trap",
    title: "The Trap",
    concept: "the flashiest shot is the most exploitable",
    plays: [PAINT, MID],
    schemes: [
      { id: "help", label: "Help Off" },
      { id: "wall", label: "Wall the Paint" },
    ],
    makeGrid: [
      [0.62, 0.36], // Paint: 1.24 vs help, 0.72 vs wall
      [0.4, 0.48], // Mid: 0.80 vs help, 0.96 vs wall
    ],
    teaching:
      "That 1.24-point paint attack is the juiciest number on the board — and it's a trap. Live on it and the defense walls the paint, dragging you to 0.72. The steady mid-range isn't sexy, but it's your bread and butter here; the optimal blend leans on it and mixes the paint in only about a quarter of the time — as a change-up to keep the wall honest, not as your base. Sometimes the highest-EV shot is the one you can least afford to force.",
    intendedType: "mixed",
    possessions: 12,
  },
  {
    id: "blitz-and-kick",
    title: "Blitz & Kick",
    concept: "reading a specific scheme",
    plays: [PAINT, CORNER3],
    schemes: [
      { id: "drop", label: "Drop" },
      { id: "blitz", label: "Blitz" },
    ],
    makeGrid: [
      [0.6, 0.38], // Paint: 1.20 vs drop, 0.76 vs blitz
      [0.35, 0.45], // Corner3: 1.05 vs drop, 1.35 vs blitz
    ],
    teaching:
      "A blitz sends a second defender at the ball to wall off the paint — but that defender comes from somewhere, and here it's the corner. Attack the paint against a Drop; when they blitz, kick to the open corner three (1.35). This is the real read the TFT engine models: every scheme takes something away and gives something up.",
    intendedType: "mixed",
    possessions: 12,
  },
];
