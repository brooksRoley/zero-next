/**
 * Shared test fixtures — realistic NBA data for 2025-26 season.
 */
import type { NbaRow } from "../client";

// -- Player rows (stats.nba.com leaguedashplayerstats format) --
export const PLAYER_LEBRON: NbaRow = {
  PLAYER_ID: 2544,
  PLAYER_NAME: "LeBron James",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
  GP: 62,
  MIN: 35.2,
  PTS: 24.8,
  REB: 7.1,
  AST: 8.3,
  STL: 1.2,
  BLK: 0.6,
  TOV: 3.4,
  FGM: 9.2,
  FGA: 18.6,
  FG_PCT: 0.495,
  FG3M: 2.1,
  FG3A: 5.8,
  FG3_PCT: 0.362,
  FTM: 4.3,
  FTA: 5.6,
  FT_PCT: 0.768,
  PLUS_MINUS: 3.2,
};

export const PLAYER_AD: NbaRow = {
  PLAYER_ID: 203076,
  PLAYER_NAME: "Anthony Davis",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
  GP: 58,
  MIN: 34.1,
  PTS: 26.3,
  REB: 11.9,
  AST: 3.2,
  STL: 1.3,
  BLK: 2.1,
  TOV: 2.1,
  FGM: 10.1,
  FGA: 19.4,
  FG_PCT: 0.521,
  FG3M: 1.2,
  FG3A: 3.5,
  FG3_PCT: 0.343,
  FTM: 4.9,
  FTA: 6.3,
  FT_PCT: 0.778,
  PLUS_MINUS: 5.1,
};

export const PLAYER_REAVES: NbaRow = {
  PLAYER_ID: 1630559,
  PLAYER_NAME: "Austin Reaves",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
  GP: 70,
  MIN: 33.8,
  PTS: 18.2,
  REB: 4.5,
  AST: 6.1,
  STL: 1.0,
  BLK: 0.3,
  TOV: 2.3,
  FGM: 6.8,
  FGA: 14.9,
  FG_PCT: 0.456,
  FG3M: 2.4,
  FG3A: 6.2,
  FG3_PCT: 0.387,
  FTM: 2.2,
  FTA: 2.6,
  FT_PCT: 0.846,
  PLUS_MINUS: 1.8,
};

export const SAMPLE_PLAYERS: NbaRow[] = [PLAYER_LEBRON, PLAYER_AD, PLAYER_REAVES];

// -- Team rows (standings format, TeamID casing from leaguestandingsv3) --
export const TEAM_LAKERS: NbaRow = {
  TeamID: 1610612747,
  TeamName: "Lakers",
  TeamCity: "Los Angeles",
  Conference: "West",
  Division: "Pacific",
  WINS: 44,
  LOSSES: 28,
  WinPCT: 0.611,
  PlayoffRank: 5,
};

export const TEAM_CELTICS: NbaRow = {
  TeamID: 1610612738,
  TeamName: "Celtics",
  TeamCity: "Boston",
  Conference: "East",
  Division: "Atlantic",
  WINS: 54,
  LOSSES: 18,
  WinPCT: 0.75,
  PlayoffRank: 1,
};

export const TEAM_THUNDER: NbaRow = {
  TeamID: 1610612760,
  TeamName: "Thunder",
  TeamCity: "Oklahoma City",
  Conference: "West",
  Division: "Northwest",
  WINS: 58,
  LOSSES: 14,
  WinPCT: 0.806,
  PlayoffRank: 1,
};

export const SAMPLE_TEAMS: NbaRow[] = [TEAM_LAKERS, TEAM_CELTICS, TEAM_THUNDER];

// -- Game rows --
export const SAMPLE_GAMES: NbaRow[] = [
  {
    GAME_ID: "0022500850",
    GAME_DATE: "2026-03-15",
    MATCHUP: "LAL vs. BOS",
    WL: "W",
    PTS: 118,
    REB: 45,
    AST: 28,
    FGM: 44,
    FGA: 89,
    FG_PCT: 0.494,
    FG3M: 12,
    FG3A: 34,
    FG3_PCT: 0.353,
    FTM: 18,
    FTA: 22,
    FT_PCT: 0.818,
  },
  {
    GAME_ID: "0022500855",
    GAME_DATE: "2026-03-17",
    MATCHUP: "LAL @ DEN",
    WL: "L",
    PTS: 105,
    REB: 40,
    AST: 24,
    FGM: 40,
    FGA: 92,
    FG_PCT: 0.435,
    FG3M: 10,
    FG3A: 30,
    FG3_PCT: 0.333,
    FTM: 15,
    FTA: 19,
    FT_PCT: 0.789,
  },
  {
    GAME_ID: "0022500860",
    GAME_DATE: "2026-03-19",
    MATCHUP: "LAL vs. GSW",
    WL: "W",
    PTS: 122,
    REB: 48,
    AST: 31,
    FGM: 46,
    FGA: 88,
    FG_PCT: 0.523,
    FG3M: 14,
    FG3A: 36,
    FG3_PCT: 0.389,
    FTM: 16,
    FTA: 20,
    FT_PCT: 0.8,
  },
];

// -- Standings rows --
export const SAMPLE_STANDINGS: NbaRow[] = [
  { ...TEAM_THUNDER, PlayoffRank: 1 },
  { ...TEAM_LAKERS, PlayoffRank: 5 },
  {
    TeamID: 1610612743,
    TeamName: "Nuggets",
    TeamCity: "Denver",
    Conference: "West",
    Division: "Northwest",
    WINS: 50,
    LOSSES: 22,
    WinPCT: 0.694,
    PlayoffRank: 3,
  },
];

// -- Game log rows (player game log format) --
export const SAMPLE_GAME_LOG: NbaRow[] = [
  {
    GAME_ID: "0022500850",
    GAME_DATE: "MAR 15, 2026",
    MATCHUP: "LAL vs. BOS",
    WL: "W",
    MIN: 36,
    PTS: 32,
    REB: 8,
    AST: 10,
    STL: 2,
    BLK: 1,
    TOV: 3,
    FGM: 12,
    FGA: 22,
    FG_PCT: 0.545,
    FG3M: 3,
    FG3A: 8,
    FG3_PCT: 0.375,
    FTM: 5,
    FTA: 6,
    FT_PCT: 0.833,
    PLUS_MINUS: 12,
  },
  {
    GAME_ID: "0022500855",
    GAME_DATE: "MAR 17, 2026",
    MATCHUP: "LAL @ DEN",
    WL: "L",
    MIN: 38,
    PTS: 22,
    REB: 6,
    AST: 7,
    STL: 0,
    BLK: 0,
    TOV: 5,
    FGM: 8,
    FGA: 20,
    FG_PCT: 0.4,
    FG3M: 2,
    FG3A: 7,
    FG3_PCT: 0.286,
    FTM: 4,
    FTA: 5,
    FT_PCT: 0.8,
    PLUS_MINUS: -8,
  },
];

// -- Tracking data fixtures (simulated 25fps) --
// 5 players per team (10 total) + ball, 10 frames at 25fps = 0.4 seconds
function makeTrackingFrames(count: number) {
  const frames: any[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / 25; // 25fps
    frames.push({
      timestamp: t,
      frameIndex: i,
      quarter: 1,
      gameClock: 720 - t,
      shotClock: 24 - (t % 24),
      players: [
        // Home team (Lakers = 1610612747)
        { playerId: 2544, teamId: 1610612747, x: 20 + i * 0.5, y: 25 },
        { playerId: 203076, teamId: 1610612747, x: 30, y: 15 + i * 0.3 },
        { playerId: 1630559, teamId: 1610612747, x: 40, y: 30 },
        { playerId: 1001, teamId: 1610612747, x: 15, y: 10 },
        { playerId: 1002, teamId: 1610612747, x: 25, y: 40 },
        // Away team (Celtics = 1610612738)
        { playerId: 2001, teamId: 1610612738, x: 60, y: 20 },
        { playerId: 2002, teamId: 1610612738, x: 70, y: 30 },
        { playerId: 2003, teamId: 1610612738, x: 50, y: 40 },
        { playerId: 2004, teamId: 1610612738, x: 65, y: 10 },
        { playerId: 2005, teamId: 1610612738, x: 75, y: 25 },
      ],
      ball: { x: 22 + i * 0.5, y: 25, z: 4 + Math.sin(i) },
    });
  }
  return frames;
}

export const TRACKING_FRAMES_10 = makeTrackingFrames(10);
export const TRACKING_FRAMES_100 = makeTrackingFrames(100);

// Full game simulation: 48 min * 60 sec * 25fps = 72000 frames
export function generateFullGameFrames(): any[] {
  return makeTrackingFrames(72000);
}

// -- Invalid rows for negative testing --
export const INVALID_PLAYER_NULL_ID: NbaRow = {
  PLAYER_ID: null,
  PLAYER_NAME: "Ghost Player",
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
};

export const INVALID_PLAYER_MISSING_NAME: NbaRow = {
  PLAYER_ID: 99999,
  TEAM_ID: 1610612747,
  TEAM_ABBREVIATION: "LAL",
};

export const INVALID_TEAM_NULL_ID: NbaRow = {
  TeamID: null,
  TeamName: "Unknown",
  TeamCity: "Nowhere",
  Conference: "West",
  Division: "Pacific",
};
