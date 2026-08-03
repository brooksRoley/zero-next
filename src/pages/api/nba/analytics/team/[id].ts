/**
 * GET /api/nba/analytics/team/[id] — team dashboard: identity, standing, and
 * roster per-game stats from the DB (ESPN-fed daily).
 *
 * The old version also served recent games and TS%/USG%/NetRtg from
 * stats.nba.com, which stopped responding from this infra in 2026 — the whole
 * endpoint 503'd. Game logs return when a trusted boxscore stream
 * (cdn.nba.com liveData) is ingested; published advanced metrics need
 * balldontlie's paid tier (see ledger). Until then this serves only what the
 * trusted sources report.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { getTeams } from "../../teams/index";
import { getStandingsRows } from "../../standings";

const round1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10;

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
        wins: teamRow.WINS,
        losses: teamRow.LOSSES,
        pct: Math.round(teamRow.WinPCT * 1000) / 1000,
        conference_rank: teamRow.PlayoffRank || null,
      }
    : {};

  // Roster per-game stats for the season (players currently on this team)
  const rosterRows = (await sql`
    SELECT p.player_id, p.player_name, p.age,
           s.games_played, s.mpg, s.ppg, s.rpg, s.apg, s.fga, s.fg3a, s.fta,
           s.fg_pct, s.fg3_pct, s.ft_pct
    FROM nba_players p
    LEFT JOIN nba_player_season_stats s
      ON s.player_id = p.player_id AND s.season = ${season}
    WHERE p.team_id = ${teamId}
  `) as Array<Record<string, unknown>>;

  const rosterStats = rosterRows
    .map((r) => ({
      id: Number(r.player_id),
      name: String(r.player_name),
      age: r.age == null ? null : Number(r.age),
      gp: Number(r.games_played) || 0,
      min: round1(r.mpg),
      ppg: round1(r.ppg),
      rpg: round1(r.rpg),
      apg: round1(r.apg),
      fga: round1(r.fga),
      fg_pct: Math.round((Number(r.fg_pct) || 0) * 1000) / 10,
      fg3_pct: Math.round((Number(r.fg3_pct) || 0) * 1000) / 10,
      ft_pct: Math.round((Number(r.ft_pct) || 0) * 1000) / 10,
    }))
    .sort((a, b) => b.ppg - a.ppg);

  return {
    team: teamInfo,
    standing,
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
