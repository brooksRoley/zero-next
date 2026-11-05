/**
 * Pure lookup: each defensive scheme mutates opponent shot mix + efficiency.
 * All numeric fields are bounded so the regression harness can't discover
 * degenerate solutions (e.g. "blitz always causes turnovers").
 */
export type SchemeId = "drop" | "switch" | "blitz" | "ICE" | "zone";
export const SCHEMES: SchemeId[] = ["drop", "switch", "blitz", "ICE", "zone"];

export interface SchemeEffect {
  zoneAttemptMult: Record<string, number>; // multiplies opponent zone attempt rates
  turnoverBonus: number;    // additive to opponent TO% (bounded [-0.05, 0.15])
  threePctPenalty: number;  // subtractive from opponent 3P% (bounded [-0.05, 0.10])
}

export const ZONE_MULT_BOUNDS = { min: 0.5, max: 1.5 };
export const TO_BOUNDS = { min: -0.05, max: 0.15 };
export const THREE_BOUNDS = { min: -0.05, max: 0.10 };

const EFFECTS: Record<SchemeId, SchemeEffect> = {
  drop: {
    zoneAttemptMult: {
      paint: 0.90, "left-mid": 1.15, "right-mid": 1.15,
      "left-corner-3": 1.00, "right-corner-3": 1.00,
      "left-wing-3": 1.00, "right-wing-3": 1.00, "top-of-key": 1.00,
    },
    turnoverBonus: 0.00,
    threePctPenalty: 0.00,
  },
  switch: {
    zoneAttemptMult: {
      paint: 0.95, "left-mid": 1.05, "right-mid": 1.05,
      "left-corner-3": 1.00, "right-corner-3": 1.00,
      "left-wing-3": 1.00, "right-wing-3": 1.00, "top-of-key": 1.00,
    },
    turnoverBonus: 0.01,
    threePctPenalty: 0.01,
  },
  blitz: {
    zoneAttemptMult: {
      paint: 1.05, "left-mid": 0.95, "right-mid": 0.95,
      "left-corner-3": 1.05, "right-corner-3": 1.05,
      "left-wing-3": 0.95, "right-wing-3": 0.95, "top-of-key": 0.95,
    },
    turnoverBonus: 0.08,
    threePctPenalty: 0.04,
  },
  ICE: {
    zoneAttemptMult: {
      paint: 1.00, "left-mid": 1.10, "right-mid": 1.10,
      "left-corner-3": 0.80, "right-corner-3": 0.80,
      "left-wing-3": 1.00, "right-wing-3": 1.00, "top-of-key": 1.00,
    },
    turnoverBonus: 0.02,
    threePctPenalty: 0.02,
  },
  zone: {
    zoneAttemptMult: {
      paint: 0.85, "left-mid": 0.95, "right-mid": 0.95,
      "left-corner-3": 1.10, "right-corner-3": 1.10,
      "left-wing-3": 1.15, "right-wing-3": 1.15, "top-of-key": 1.10,
    },
    turnoverBonus: 0.00,
    threePctPenalty: -0.02, // zone concedes clean threes
  },
};

export function schemeEffect(s: SchemeId): SchemeEffect {
  return EFFECTS[s];
}
