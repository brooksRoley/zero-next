/**
 * Zod schemas for stats.nba.com response validation.
 * Each schema uses .passthrough() to preserve extra fields from the API.
 */
import { z } from "zod";

export const PlayerSchema = z
  .object({
    PLAYER_ID: z.number(),
    PLAYER_NAME: z.string(),
    TEAM_ID: z.number(),
    TEAM_ABBREVIATION: z.string(),
    PTS: z.number().nullable().optional(),
    REB: z.number().nullable().optional(),
    AST: z.number().nullable().optional(),
    STL: z.number().nullable().optional(),
    BLK: z.number().nullable().optional(),
    TOV: z.number().nullable().optional(),
    MIN: z.number().nullable().optional(),
    FGM: z.number().nullable().optional(),
    FGA: z.number().nullable().optional(),
    FG_PCT: z.number().nullable().optional(),
    FG3M: z.number().nullable().optional(),
    FG3A: z.number().nullable().optional(),
    FG3_PCT: z.number().nullable().optional(),
    FTM: z.number().nullable().optional(),
    FTA: z.number().nullable().optional(),
    FT_PCT: z.number().nullable().optional(),
    PLUS_MINUS: z.number().nullable().optional(),
    GP: z.number().nullable().optional(),
  })
  .passthrough();

export const TeamSchema = z
  .object({
    TeamID: z.number(),
    TeamName: z.string(),
    TeamCity: z.string(),
    Conference: z.string(),
    Division: z.string(),
    WINS: z.number().optional(),
    LOSSES: z.number().optional(),
    WinPCT: z.number().optional(),
  })
  .passthrough();

export const GameSchema = z
  .object({
    GAME_ID: z.string(),
    GAME_DATE: z.string(),
    MATCHUP: z.string(),
    WL: z.string().nullable().optional(),
    PTS: z.number().nullable().optional(),
    REB: z.number().nullable().optional(),
    AST: z.number().nullable().optional(),
    FGM: z.number().nullable().optional(),
    FGA: z.number().nullable().optional(),
    FG_PCT: z.number().nullable().optional(),
    FG3M: z.number().nullable().optional(),
    FG3A: z.number().nullable().optional(),
    FG3_PCT: z.number().nullable().optional(),
    FTM: z.number().nullable().optional(),
    FTA: z.number().nullable().optional(),
    FT_PCT: z.number().nullable().optional(),
  })
  .passthrough();

export const StandingsSchema = z
  .object({
    TeamID: z.number(),
    TeamCity: z.string(),
    TeamName: z.string(),
    Conference: z.string(),
    Division: z.string(),
    PlayoffRank: z.number(),
    WINS: z.number(),
    LOSSES: z.number(),
    WinPCT: z.number(),
  })
  .passthrough();

export const GameLogSchema = z
  .object({
    GAME_ID: z.string(),
    GAME_DATE: z.string(),
    MATCHUP: z.string(),
    WL: z.string().nullable().optional(),
    MIN: z.number().nullable().optional(),
    PTS: z.number().nullable().optional(),
    REB: z.number().nullable().optional(),
    AST: z.number().nullable().optional(),
    STL: z.number().nullable().optional(),
    BLK: z.number().nullable().optional(),
    TOV: z.number().nullable().optional(),
    FGM: z.number().nullable().optional(),
    FGA: z.number().nullable().optional(),
    FG_PCT: z.number().nullable().optional(),
    FG3M: z.number().nullable().optional(),
    FG3A: z.number().nullable().optional(),
    FG3_PCT: z.number().nullable().optional(),
    FTM: z.number().nullable().optional(),
    FTA: z.number().nullable().optional(),
    FT_PCT: z.number().nullable().optional(),
    PLUS_MINUS: z.number().nullable().optional(),
  })
  .passthrough();

export type Player = z.infer<typeof PlayerSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type Game = z.infer<typeof GameSchema>;
export type Standings = z.infer<typeof StandingsSchema>;
export type GameLog = z.infer<typeof GameLogSchema>;
