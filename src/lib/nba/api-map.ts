/**
 * API node graph structure — used by the explorer frontend and /api/nba/map
 */

export const API_MAP: Record<string, {
  label: string;
  description: string;
  endpoint?: string;
  children: string[];
  params?: { name: string; type: string; required?: boolean; optional?: boolean }[];
}> = {
  root: {
    label: "NBA API",
    description: "Entry point",
    children: ["teams", "players", "standings", "games", "analytics"],
  },
  analytics: {
    label: "Analytics",
    description: "Advanced analytics hub",
    children: ["league_lens", "last_night", "season_analytics", "team_dashboard", "lakers_dashboard"],
  },
  league_lens: {
    label: "League Lens",
    endpoint: "/api/nba/analytics/league-lens",
    description: "Outliers, player similarity comps, YoY breakout deltas, and payroll vs wins — 3 seasons of stored stats",
    children: [],
    params: [],
  },
  last_night: {
    label: "Last Night",
    endpoint: "/api/nba/analytics/last-night",
    description: "Top performers and scores from last night's games",
    children: [],
    params: [],
  },
  season_analytics: {
    label: "Season Analytics",
    endpoint: "/api/nba/analytics/season",
    description: "Season leaders (scoring, boards, assists, shot volume) and team records with payroll",
    children: [],
    params: [],
  },
  lakers_dashboard: {
    label: "Lakers",
    endpoint: "/api/nba/analytics/lakers",
    description: "Lakers dashboard (alias for /api/nba/analytics/team/1610612747)",
    children: [],
    params: [],
  },
  team_dashboard: {
    label: "Team Dashboard",
    endpoint: "/api/nba/analytics/team/{id}",
    description: "Standing and roster per-game stats for any team",
    children: [],
    params: [{ name: "id", type: "int", required: true }],
  },
  teams: {
    label: "Teams",
    endpoint: "/api/nba/teams",
    description: "All NBA teams",
    children: ["team_detail"],
    params: [],
  },
  players: {
    label: "Players",
    endpoint: "/api/nba/players",
    description: "All players (current season per-game stats)",
    children: ["player_detail"],
    params: [{ name: "team_id", type: "int", optional: true }],
  },
  standings: {
    label: "Standings",
    endpoint: "/api/nba/standings",
    description: "Current standings",
    children: [],
    params: [{ name: "conference", type: "str", optional: true }],
  },
  games: {
    label: "Games",
    endpoint: "/api/nba/games",
    description: "Recent games",
    children: ["game_detail"],
    params: [{ name: "date", type: "str (YYYY-MM-DD)", optional: true }],
  },
  team_detail: {
    label: "Team Detail",
    endpoint: "/api/nba/teams/{id}",
    description: "Single team + roster",
    children: ["players"],
    params: [{ name: "id", type: "int", required: true }],
  },
  player_detail: {
    label: "Player Detail",
    endpoint: "/api/nba/players/{id}",
    description: "Player info + season averages",
    children: ["game_log"],
    params: [{ name: "id", type: "int", required: true }],
  },
  game_log: {
    label: "Game Log",
    endpoint: "/api/nba/players/{id}/gamelog",
    description: "Per-game stats",
    children: [],
    params: [
      { name: "id", type: "int", required: true },
      { name: "n", type: "int", optional: true },
    ],
  },
  game_detail: {
    label: "Game Detail",
    endpoint: "/api/nba/games/{id}",
    description: "Box score",
    children: ["player_detail"],
    params: [{ name: "id", type: "int", required: true }],
  },
};
