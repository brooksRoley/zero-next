/**
 * GET /api/nba/analytics/league-lens — the flat league dataset behind the
 * League Lens explorer view: every player-season row (3 seasons deep) joined
 * with identity (name, position, age, current team) and this season's salary,
 * plus team standings + payroll. One payload; outlier/similarity math runs
 * client-side on these stored, source-published fields.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import { CAP_SEASON_YEAR, CAP_SEASON_LABEL, SALARY_CAP, LUXURY_TAX, FIRST_APRON, SECOND_APRON } from "src/lib/nba/capConstants";
import { normalizeConference } from "../teams/index";

const round1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10;
const round3 = (v: unknown) => Math.round((Number(v) || 0) * 1000) / 1000;

export type LensPlayerRow = {
  id: number;
  name: string;
  pos: string;
  age: number | null;
  season: string;
  team: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fga: number;
  fg3a: number;
  fta: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  /** Current-season salary in $; null when unsigned or unknown. */
  salary: number | null;
};

async function fetchLeagueLens() {
  const playerRows = (await sql`
    SELECT s.season, s.team_id AS season_team_id,
           s.games_played, s.mpg, s.ppg, s.rpg, s.apg, s.spg, s.bpg, s.topg,
           s.fga, s.fg3a, s.fta, s.fg_pct, s.fg3_pct, s.ft_pct,
           p.player_id, p.player_name, p.position, p.age,
           sal.salary
    FROM nba_player_season_stats s
    JOIN nba_players p ON p.player_id = s.player_id
    LEFT JOIN nba_player_salaries sal
      ON sal.player_id = s.player_id AND sal.season_year = ${CAP_SEASON_YEAR}
    ORDER BY s.season, s.ppg DESC
  `) as Array<Record<string, unknown>>;

  const players: LensPlayerRow[] = playerRows.map((r) => ({
    id: Number(r.player_id),
    name: String(r.player_name),
    pos: String(r.position ?? ""),
    age: r.age == null ? null : Number(r.age),
    season: String(r.season),
    team: TEAMS_BY_ID.get(Number(r.season_team_id))?.abbreviation ?? "",
    gp: Number(r.games_played) || 0,
    mpg: round1(r.mpg),
    ppg: round1(r.ppg),
    rpg: round1(r.rpg),
    apg: round1(r.apg),
    spg: round1(r.spg),
    bpg: round1(r.bpg),
    topg: round1(r.topg),
    fga: round1(r.fga),
    fg3a: round1(r.fg3a),
    fta: round1(r.fta),
    fg_pct: round3(r.fg_pct),
    fg3_pct: round3(r.fg3_pct),
    ft_pct: round3(r.ft_pct),
    salary: r.salary == null ? null : Number(r.salary),
  }));

  const teamRows = (await sql`
    SELECT st.team_id, st.conference, st.wins, st.losses, st.win_pct, pay.payroll
    FROM nba_standings st
    LEFT JOIN (
      SELECT COALESCE(p.team_id, s.team_id) AS team_id, SUM(s.salary)::bigint AS payroll
      FROM nba_player_salaries s
      LEFT JOIN nba_players p ON p.player_id = s.player_id
      WHERE s.season_year = ${CAP_SEASON_YEAR}
      GROUP BY COALESCE(p.team_id, s.team_id)
    ) pay ON pay.team_id = st.team_id
    WHERE st.season = ${currentNbaSeason()}
  `) as Array<Record<string, unknown>>;

  const teams = teamRows.map((r) => {
    const tid = Number(r.team_id);
    const staticTeam = TEAMS_BY_ID.get(tid);
    return {
      id: tid,
      abbrev: staticTeam?.abbreviation ?? "",
      name: staticTeam?.full_name ?? "",
      conference: normalizeConference(r.conference ?? staticTeam?.conference),
      wins: Number(r.wins) || 0,
      losses: Number(r.losses) || 0,
      win_pct: round3(r.win_pct),
      payroll: r.payroll == null ? null : Number(r.payroll),
    };
  });

  return {
    current_season: currentNbaSeason(),
    salary_season: CAP_SEASON_LABEL,
    thresholds: { cap: SALARY_CAP, tax: LUXURY_TAX, firstApron: FIRST_APRON, secondApron: SECOND_APRON },
    players,
    teams,
  };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await cached("league_lens", fetchLeagueLens, 3600);
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ data, _meta: { endpoint: "league_lens" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
