// Static config for the NBA API Explorer (src/pages/nba.tsx): the endpoint
// map, node layout/coloring, and label lookups. Pulled out of the page
// component because none of it depends on component state — it's the same
// object graph on every render.

export type NodeDef = {
  label: string;
  description: string;
  endpoint?: string;
  children: string[];
  params?: { name: string; type: string; required?: boolean; optional?: boolean }[];
};

export type AnyRow = Record<string, any>;

// ── API Map (fallback, also fetched from /api/nba/map) ──────────────────────
export const FALLBACK_MAP: Record<string, NodeDef> = {
  root: { label: "NBA Explorer", description: "Live NBA data — pick a category to start.", children: ["teams", "players", "standings", "games", "analytics"] },
  teams: { label: "Teams", description: "Browse all 30 NBA teams.", children: ["team_detail"], endpoint: "/api/nba/teams", params: [] },
  players: { label: "Players", description: "All active players with per-game stats. Filter by team.", children: ["player_detail"], endpoint: "/api/nba/players", params: [{ name: "team_id", type: "int", optional: true }] },
  standings: { label: "Standings", description: "Where does every team stand right now?", children: [], endpoint: "/api/nba/standings", params: [{ name: "conference", type: "str", optional: true }] },
  games: { label: "Recent Games", description: "What games happened recently?", children: ["game_detail"], endpoint: "/api/nba/games", params: [{ name: "date", type: "str", optional: true }] },
  team_detail: { label: "Team Profile", description: "Roster and info for a specific team.", children: ["players"], endpoint: "/api/nba/teams/{id}", params: [{ name: "id", type: "int", required: true }] },
  player_detail: { label: "Player Profile", description: "Stats, height, position, and averages for any player.", children: ["game_log"], endpoint: "/api/nba/players/{id}", params: [{ name: "id", type: "int", required: true }] },
  game_log: { label: "Game History", description: "How has a player been performing game by game?", children: [], endpoint: "/api/nba/players/{id}/gamelog", params: [{ name: "id", type: "int", required: true }, { name: "n", type: "int", optional: true }] },
  game_detail: { label: "Box Score", description: "Full box score for a specific game.", children: ["player_detail"], endpoint: "/api/nba/games/{id}", params: [{ name: "id", type: "int", required: true }] },
  analytics: { label: "Analytics Hub", description: "Dig into what's happening across the season.", children: ["league_lens", "last_night", "season_analytics", "team_dashboard", "lakers_dashboard"] },
  league_lens: { label: "League Lens", description: "Outliers, statistical comps, year-over-year breakout deltas, and payroll vs wins — three seasons of stored stats.", children: [] },
  last_night: { label: "Last Night's Games", description: "Scores and top performers from last night.", children: [], endpoint: "/api/nba/analytics/last-night", params: [] },
  season_analytics: { label: "Season Leaders", description: "Who's dominating TS%, net rating, and usage this season?", children: [], endpoint: "/api/nba/analytics/season", params: [] },
  team_dashboard: { label: "Team Dashboard", description: "Record, roster advanced stats, and recent games for any team.", children: [], endpoint: "/api/nba/analytics/team/{id}", params: [{ name: "id", type: "int", required: true }] },
  lakers_dashboard: { label: "Lakers Dashboard", description: "How are the Lakers doing right now?", children: [], endpoint: "/api/nba/analytics/lakers", params: [] },
};

// ── Node layout positions (hand-tuned radial) ────────────────────────────────
export const NODE_POSITIONS: Record<string, { x: number; y: number }> = (() => {
  const cx = 480, cy = 280;
  return {
    root: { x: cx, y: cy },
    teams: { x: cx - 220, y: cy - 160 },
    players: { x: cx + 220, y: cy - 160 },
    standings: { x: cx - 280, y: cy + 100 },
    games: { x: cx + 280, y: cy + 100 },
    team_detail: { x: cx - 340, y: cy - 40 },
    player_detail: { x: cx + 100, y: cy - 20 },
    game_log: { x: cx + 100, y: cy + 120 },
    game_detail: { x: cx + 360, y: cy },
    analytics: { x: cx, y: cy + 200 },
    last_night: { x: cx - 280, y: cy + 330 },
    season_analytics: { x: cx - 100, y: cy + 390 },
    team_dashboard: { x: cx + 100, y: cy + 390 },
    lakers_dashboard: { x: cx + 280, y: cy + 330 },
    league_lens: { x: cx, y: cy + 470 },
  };
})();

export const NODE_COLORS: Record<string, string> = {
  root: "#e5484d", teams: "#3b82f6", players: "#22c55e", standings: "#a855f7",
  games: "#ef4444", team_detail: "#3b82f6", player_detail: "#22c55e",
  game_log: "#06b6d4", game_detail: "#ef4444", analytics: "#f59e0b",
  last_night: "#fb923c", season_analytics: "#fbbf24", team_dashboard: "#34d399",
  lakers_dashboard: "#a78bfa", league_lens: "#38bdf8",
};

export const COL_LABELS: Record<string, string> = {
  // Stats
  ts_pct: "True Shooting %", usg_pct: "Usage %", pie: "Player Impact",
  net_rating: "Net Rating", efg_pct: "Effective FG%", ast_pct: "Assist %",
  reb_pct: "Rebound %", oreb_pct: "Off Reb %", dreb_pct: "Def Reb %",
  off_rating: "Off Rating", def_rating: "Def Rating", pace: "Pace",
  ppg: "PPG", rpg: "RPG", apg: "APG", spg: "SPG", bpg: "BPG",
  fg_pct: "FG%", fg3_pct: "3PT%", ft_pct: "FT%",
  pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals",
  blk: "Blocks", tov: "Turnovers", plus_minus: "+/-",
  wins: "Wins", losses: "Losses", min: "Minutes",
  // Player / team fields
  id: "ID", name: "Name", team_id: "Team", team_name: "Team", player_id: "Player",
  city: "City", abbrev: "Abbrev", conference: "Conf", division: "Division",
  pos: "Pos", jersey: "Jersey", height: "Height", weight: "Weight", country: "Country",
  // Game fields
  game_id: "Game ID", date: "Date", home_team: "Home", away_team: "Away",
  home_score: "Home Pts", away_score: "Away Pts", winner: "Winner",
  // Season / standings
  rank: "Rank", record: "Record", pct: "Win %", streak: "Streak",
  last10: "Last 10", home_record: "Home", away_record: "Away",
};
// Alias — chart tabs use this subset
export const METRIC_LABELS = COL_LABELS;

export const colLabel = (key: string): string =>
  COL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Friendly placeholder text per param name — avoids leaking raw type strings
export const PARAM_PLACEHOLDERS: Record<string, string> = {
  id: "e.g. 2544",
  team_id: "e.g. 1610612747",
  date: "e.g. 2024-01-15",
  n: "Last N games",
  conference: "East or West",
};

// Leaf nodes require a param (ID) from a parent — shown greyed on mobile until parent visited
export const MOBILE_LEAF_NODES = new Set(["team_detail", "player_detail", "game_log", "game_detail"]);

export const MOBILE_GROUPS = [
  { label: "Browse", nodes: ["teams", "players", "standings", "games", "team_detail", "player_detail", "game_log", "game_detail"] },
  { label: "Analytics", nodes: ["league_lens", "last_night", "season_analytics", "team_dashboard", "lakers_dashboard"] },
];

// Preferred chart metric per node — falls back to first numeric key if not present in data
export const PREFERRED_METRIC: Record<string, string> = {
  players: "ppg",
  player_detail: "ppg",
  game_log: "pts",
  teams: "wins",
  standings: "wins",
  season_analytics: "net_rating",
  team_dashboard: "net_rating",
  lakers_dashboard: "net_rating",
  last_night: "home_score",
  game_detail: "pts",
};

export const CHART_TITLE: Record<string, string> = {
  players: "Player Averages",
  player_detail: "Player Stats",
  game_log: "Game-by-Game",
  teams: "Team Records",
  standings: "Team Records",
  season_analytics: "Season Leaders",
  team_dashboard: "Roster Stats",
  lakers_dashboard: "Roster Stats",
  last_night: "Last Night's Scores",
  game_detail: "Box Score",
};
