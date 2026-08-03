/**
 * GET /api/nba/standings — current standings from the DB silver table
 * (ESPN-fed daily). Replaces the dead stats.nba.com read.
 *
 * getStandingsRows keeps the legacy stats.nba.com row shape (TeamID, WINS,
 * WinPCT, …) because analytics/team/[id].ts still consumes it.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import { normalizeConference } from "./teams/index";

async function fetchStandingsRows() {
  const season = currentNbaSeason();
  const rows = (await sql`
    SELECT st.team_id, st.conference, st.division, st.wins, st.losses,
           st.win_pct, st.playoff_rank, t.team_name, t.team_city
    FROM nba_standings st
    LEFT JOIN nba_teams t ON t.team_id = st.team_id
    WHERE st.season = ${season}
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const tid = Number(r.team_id);
    const staticTeam = TEAMS_BY_ID.get(tid);
    return {
      TeamID: tid,
      TeamName: String(r.team_name ?? staticTeam?.nickname ?? ""),
      TeamCity: String(r.team_city ?? staticTeam?.city ?? ""),
      Conference: normalizeConference(r.conference ?? staticTeam?.conference),
      Division: r.division == null ? "" : String(r.division),
      PlayoffRank: Number(r.playoff_rank) || 0,
      WINS: Number(r.wins) || 0,
      LOSSES: Number(r.losses) || 0,
      WinPCT: Number(r.win_pct) || 0,
    };
  });
}

export async function getStandingsRows() {
  return cached("standings_rows", fetchStandingsRows, 600);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const conf = (req.query.conference as string) || "";

  try {
    const rows = await getStandingsRows();

    let result = rows.map((r) => {
      const staticTeam = TEAMS_BY_ID.get(r.TeamID);
      return {
        id: r.TeamID,
        name: r.TeamName,
        city: r.TeamCity,
        abbrev: staticTeam?.abbreviation ?? "",
        conference: r.Conference,
        division: r.Division,
        wins: r.WINS,
        losses: r.LOSSES,
        pct: Math.round(r.WinPCT * 1000) / 1000,
      };
    });

    if (conf) {
      result = result.filter(
        (s) => s.conference.toLowerCase() === conf.toLowerCase()
      );
    }

    result.sort((a, b) => b.pct - a.pct);
    const ranked = result.map((s, i) => ({ ...s, rank: i + 1 }));

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
    res.status(200).json({ data: ranked, _meta: { endpoint: "standings" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
