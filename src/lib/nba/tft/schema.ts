import { z } from "zod";
import { SCHEMES } from "src/lib/nba/tft/scheme-effects";

export const TacticsPlanSchema = z.object({
  lineup: z.array(z.number().int()).length(5),
  minutes: z.record(z.string(), z.number()),
  formation: z.array(z.object({
    playerId: z.number().int(),
    x: z.number().int().min(0).max(6),
    y: z.number().int().min(0).max(7),
  })).length(5),
  scheme: z.enum(SCHEMES as [string, ...string[]]),
});
export type TacticsPlan = z.infer<typeof TacticsPlanSchema>;

const StatBlock = z.record(z.string(), z.number());
export const CoefficientsSchema = z.object({
  shooting: z.object({
    ts_weight: z.number(), fg_weight: z.number(), fg3_weight: z.number(),
    scale: z.number(), offset: z.number(),
  }),
  defense: z.object({
    drtg_weight: z.number(), stl_weight: z.number(), blk_weight: z.number(),
    drtg_center: z.number(), scale: z.number(),
  }),
  speed: z.object({
    pace_weight: z.number(), pace_center: z.number(),
    age_penalty: z.number(), scale: z.number(),
  }),
  stamina: z.object({
    mpg_weight: z.number(), age_penalty: z.number(), scale: z.number(),
  }),
  scheme_overrides: z.record(z.string(), StatBlock),
  formation_biases: z.record(z.string(), z.number()),
});
export type Coefficients = z.infer<typeof CoefficientsSchema>;

export interface SimSeasonResult {
  teamWins: Record<number, number>;             // team_id -> sim wins (avg over replicates)
  playerBoxes: Record<number, {                 // player_id -> per-game means
    pts: number; reb: number; ast: number; fga: number; fga3: number;
  }>;
  playerShotBins: Record<number, Record<string, number>>; // player_id -> zone -> share
}
