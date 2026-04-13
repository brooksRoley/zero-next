import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";

function safe(val: unknown, scale = 1, decimals = 1): number | null {
  try {
    const n = Number(val);
    if (isNaN(n)) return null;
    return Math.round(n * scale * 10 ** decimals) / 10 ** decimals;
  } catch {
    return null;
  }
}

async function fetchSeasonAnalytics() {
  const season = currentNbaSeason();

  // Advanced player stats (min 20 GP)
  const playerRows = await fetchStats("leaguedashplayerstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Advanced",
    LeagueID: "00",
  });

  const players = playerRows
    .filter((r) => Number(r.GP) >= 20)
    .map((r) => ({
      id: Number(r.PLAYER_ID),
      name: r.PLAYER_NAME as string,
      team: r.TEAM_ABBREVIATION as string,
      gp: Number(r.GP),
      ts_pct: safe(r.TS_PCT, 100),
      efg_pct: safe(r.EFG_PCT, 100),
      usg_pct: safe(r.USG_PCT, 100),
      net_rating: safe(r.NET_RATING),
      pie: safe(r.PIE, 100),
      ast_pct: safe(r.AST_PCT, 100),
      reb_pct: safe(r.REB_PCT, 100),
    }));

  // Advanced team stats
  const teamRows = await fetchStats("leaguedashteamstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Advanced",
    LeagueID: "00",
  });

  const teams = teamRows
    .map((r) => ({
      id: Number(r.TEAM_ID),
      name: r.TEAM_NAME as string,
      net_rating: safe(r.NET_RATING),
      off_rating: safe(r.OFF_RATING),
      def_rating: safe(r.DEF_RATING),
      pace: safe(r.PACE),
      ts_pct: safe(r.TS_PCT, 100),
      efg_pct: safe(r.EFG_PCT, 100),
      pie: safe(r.PIE, 100),
    }))
    .sort((a, b) => (b.net_rating ?? 0) - (a.net_rating ?? 0));

  return {
    season,
    top_players_ts: [...players].sort((a, b) => (b.ts_pct ?? 0) - (a.ts_pct ?? 0)).slice(0, 20),
    top_players_net: [...players].sort((a, b) => (b.net_rating ?? 0) - (a.net_rating ?? 0)).slice(0, 20),
    top_players_usg: [...players].sort((a, b) => (b.usg_pct ?? 0) - (a.usg_pct ?? 0)).slice(0, 20),
    teams,
  };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await cached("season_analytics", fetchSeasonAnalytics, 3600);
    res.status(200).json({ data, _meta: { endpoint: "season_analytics" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
