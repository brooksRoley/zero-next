import { describe, it, expect } from "vitest";
import { TacticsPlanSchema, CoefficientsSchema } from "src/lib/nba/tft/schema";

describe("schema", () => {
  it("accepts a well-formed TacticsPlan", () => {
    const plan = {
      lineup: [1, 2, 3, 4, 5],
      minutes: { 1: 32, 2: 30, 3: 28, 4: 26, 5: 24 },
      formation: [
        { playerId: 1, x: 3, y: 0 },
        { playerId: 2, x: 5, y: 1 },
        { playerId: 3, x: 1, y: 1 },
        { playerId: 4, x: 3, y: 2 },
        { playerId: 5, x: 3, y: 3 },
      ],
      scheme: "drop",
    };
    expect(() => TacticsPlanSchema.parse(plan)).not.toThrow();
  });

  it("rejects a TacticsPlan with 4 players in the lineup", () => {
    const plan = {
      lineup: [1, 2, 3, 4],
      minutes: {}, formation: [], scheme: "drop",
    };
    expect(() => TacticsPlanSchema.parse(plan)).toThrow();
  });

  it("accepts a Coefficients bundle with all required keys", () => {
    const c = {
      shooting: { ts_weight: 0.4, fg_weight: 0.3, fg3_weight: 0.3, scale: 130, offset: 10 },
      defense:  { drtg_weight: 0.5, stl_weight: 0.25, blk_weight: 0.25, drtg_center: 110, scale: 3.0 },
      speed:    { pace_weight: 0.7, pace_center: 100, age_penalty: 0.5, scale: 5.0 },
      stamina:  { mpg_weight: 2.0, age_penalty: 0.8, scale: 1.0 },
      scheme_overrides: {},
      formation_biases: {},
    };
    expect(() => CoefficientsSchema.parse(c)).not.toThrow();
  });
});
