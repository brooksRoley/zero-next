import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { getTeams } from "../../teams/index";
import { getStandingsRows } from "../../standings";

function safe(val: unknown, scale = 1, decimals = 1): number | null {
  try {
    const n = Number(val);
    if (isNaN(n)) return null;
    return Math.round(n * scale * 10 ** decimals) / 10 ** decimals;
  } catch {
    return null;
  }
}

export async function fetchTeamAnalytics(teamId: number) {
  const season = currentNbaSeason();

  // Validate team
  const allTeams = await getTeams();
  const teamInfo = allTeams.find((t) => t.id === teamId);
  if (!teamInfo) return null;

  // Standings row
  const standingsRows = await getStandingsRows();
  const teamRow = standingsRows.find((r) => Number(r.TeamID) === teamId);
  const standing = teamRow
    ? {
        wins: Number(teamRow.WINS),
        losses: Number(teamRow.LOSSES),
        pct: Math.round(Number(teamRow.WinPCT) * 1000) / 1000,
        conference_rank: teamRow.PlayoffRank != null ? Number(teamRow.PlayoffRank) : null,
        home_record: String(teamRow.HOME ?? ""),
        away_record: String(teamRow.ROAD ?? ""),
        last_10: String(teamRow.L10 ?? ""),
        streak: String(teamRow.strCurrentStreak ?? ""),
      }
    : {};

  // Recent games
  const recentRows = await fetchStats("leaguegamefinder", {
    TeamID: teamId,
    Season: season,
    SeasonType: "Regular Season",
    LeagueID: "00",
  }, { resultSetName: "LeagueGameFinderResults" });

  const recentGames = recentRows.slice(0, 10).map((r) => ({
    date: r.GAME_DATE as string,
    matchup: r.MATCHUP as string,
    wl: r.WL as string,
    pts: Number(r.PTS) || 0,
    plus_minus: Number(r.PLUS_MINUS) || 0,
    fg_pct: Math.round((Number(r.FG_PCT) || 0) * 1000) / 10,
    fg3_pct: Math.round((Number(r.FG3_PCT) || 0) * 1000) / 10,
  }));

  // Traditional per-game stats for roster
  const tradRows = await fetchStats("leaguedashplayerstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Base",
    LeagueID: "00",
    TeamID: teamId,
  });

  // Advanced stats for roster
  const advRows = await fetchStats("leaguedashplayerstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Advanced",
    LeagueID: "00",
    TeamID: teamId,
  });

  const advMap = new Map(advRows.map((r) => [Number(r.PLAYER_ID), r]));

  const rosterStats = tradRows
    .map((r) => {
      const pid = Number(r.PLAYER_ID);
      const adv = advMap.get(pid);
      return {
        id: pid,
        name: r.PLAYER_NAME as string,
        gp: Number(r.GP),
        min: safe(r.MIN),
        ppg: safe(r.PTS),
        rpg: safe(r.REB),
        apg: safe(r.AST),
        fg_pct: safe(r.FG_PCT, 100),
        fg3_pct: safe(r.FG3_PCT, 100),
        ft_pct: safe(r.FT_PCT, 100),
        ts_pct: adv ? safe(adv.TS_PCT, 100) : null,
        usg_pct: adv ? safe(adv.USG_PCT, 100) : null,
        net_rating: adv ? safe(adv.NET_RATING) : null,
      };
    })
    .sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0));

  // Team-level advanced stats
  const teamAdvRows = await fetchStats("leaguedashteamstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Advanced",
    LeagueID: "00",
  });

  const teamAdvRow = teamAdvRows.find((r) => Number(r.TEAM_ID) === teamId);
  const teamAdvanced = teamAdvRow
    ? {
        net_rating: safe(teamAdvRow.NET_RATING),
        off_rating: safe(teamAdvRow.OFF_RATING),
        def_rating: safe(teamAdvRow.DEF_RATING),
        pace: safe(teamAdvRow.PACE),
        ts_pct: safe(teamAdvRow.TS_PCT, 100),
        efg_pct: safe(teamAdvRow.EFG_PCT, 100),
        pie: safe(teamAdvRow.PIE, 100),
      }
    : {};

  return {
    team: teamInfo,
    standing,
    team_advanced: teamAdvanced,
    recent_games: recentGames,
    roster_stats: rosterStats,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const teamId = Number(req.query.id);
  if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

  try {
    const data = await cached(
      `team_dashboard_${teamId}`,
      () => fetchTeamAnalytics(teamId),
      600
    );
    if (!data) return res.status(404).json({ error: "Team not found" });
    res.status(200).json({ data, _meta: { endpoint: "team_dashboard", team_id: teamId } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
