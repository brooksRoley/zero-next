/**
 * GET /api/nba/analytics/season — season-wide leaders and team overview from
 * the DB gold tables (ESPN-fed daily) plus payrolls (ESPN contracts).
 *
 * Rebuilt off the dead stats.nba.com client. The old response advertised
 * TS%/USG%/NetRtg — no trusted free stream publishes those, so this endpoint
 * now serves only stats the sources actually report. Published advanced
 * metrics would come from balldontlie's paid tier (see ledger).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import { CAP_SEASON_YEAR } from "src/lib/nba/capConstants";
import { normalizeConference } from "../teams/index";

const round1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10;

async function fetchSeasonAnalytics() {
  const season = currentNbaSeason();

  const players = (await sql`
    SELECT p.player_id, p.player_name, p.age,
           COALESCE(p.team_id, s.team_id) AS team_id,
           s.games_played, s.ppg, s.rpg, s.apg, s.fga, s.fg3a, s.mpg
    FROM nba_player_season_stats s
    JOIN nba_players p ON p.player_id = s.player_id
    WHERE s.season = ${season} AND s.games_played >= 20
  `) as Array<Record<string, unknown>>;

  const shaped = players.map((r) => ({
    id: Number(r.player_id),
    name: String(r.player_name),
    team: TEAMS_BY_ID.get(Number(r.team_id))?.abbreviation ?? "",
    age: r.age == null ? null : Number(r.age),
    gp: Number(r.games_played) || 0,
    ppg: round1(r.ppg),
    rpg: round1(r.rpg),
    apg: round1(r.apg),
    fga: round1(r.fga),
    fg3a: round1(r.fg3a),
    mpg: round1(r.mpg),
  }));

  const byStat = (key: "ppg" | "rpg" | "apg" | "fga") =>
    [...shaped].sort((a, b) => b[key] - a[key]).slice(0, 20);

  const teamRows = (await sql`
    SELECT st.team_id, st.conference, st.wins, st.losses, st.win_pct,
           pay.payroll
    FROM nba_standings st
    LEFT JOIN (
      SELECT COALESCE(p.team_id, s.team_id) AS team_id, SUM(s.salary)::bigint AS payroll
      FROM nba_player_salaries s
      LEFT JOIN nba_players p ON p.player_id = s.player_id
      WHERE s.season_year = ${CAP_SEASON_YEAR}
      GROUP BY COALESCE(p.team_id, s.team_id)
    ) pay ON pay.team_id = st.team_id
    WHERE st.season = ${season}
    ORDER BY st.win_pct DESC
  `) as Array<Record<string, unknown>>;

  const teams = teamRows.map((r) => {
    const tid = Number(r.team_id);
    const staticTeam = TEAMS_BY_ID.get(tid);
    return {
      id: tid,
      name: staticTeam?.full_name ?? "",
      abbrev: staticTeam?.abbreviation ?? "",
      conference: normalizeConference(r.conference ?? staticTeam?.conference),
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
      win_pct: Math.round((Number(r.win_pct) || 0) * 1000) / 1000,
      payroll: r.payroll == null ? null : Number(r.payroll),
    };
  });

  return {
    season,
    leaders: {
      scoring: byStat("ppg"),
      rebounding: byStat("rpg"),
      assists: byStat("apg"),
      shot_volume: byStat("fga"),
    },
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
