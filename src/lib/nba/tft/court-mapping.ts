/**
 * TFT board → NBA half-court zone. The board's offensive half (y=0..3, rows
 * near the basket) covers all 8 shot zones from the zones taxonomy. The
 * defensive half (y=4..7) mirrors offensively but is only used by the
 * scheme layer, not by shot-origin sampling.
 */
export const BOARD_W = 7;
export const BOARD_H = 8;

// x ∈ [0..6] left→right, y ∈ [0..7] basket→far. Only y ∈ [0..3] emits shots.
// Row 0: back court zones (deep threes). Row 3: cornerish. Row 1-2: mid/paint.
const OFFENSIVE_MAP: Record<string, string> = {
  // "x,y": zoneId
  "0,0": "left-wing-3",   "1,0": "left-wing-3",   "2,0": "top-of-key",
  "3,0": "top-of-key",    "4,0": "top-of-key",    "5,0": "right-wing-3",   "6,0": "right-wing-3",

  "0,1": "left-wing-3",   "1,1": "left-mid",      "2,1": "left-mid",
  "3,1": "top-of-key",    "4,1": "right-mid",     "5,1": "right-mid",      "6,1": "right-wing-3",

  "0,2": "left-mid",      "1,2": "left-mid",      "2,2": "paint",
  "3,2": "paint",         "4,2": "paint",         "5,2": "right-mid",      "6,2": "right-mid",

  "0,3": "left-corner-3", "1,3": "left-mid",      "2,3": "paint",
  "3,3": "paint",         "4,3": "paint",         "5,3": "right-mid",      "6,3": "right-corner-3",
};

export function boardToZone(x: number, y: number): string {
  const key = `${x},${y % 4}`; // defensive half mirrors offensive
  return OFFENSIVE_MAP[key] ?? "top-of-key";
}
