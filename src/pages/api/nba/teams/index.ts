/**
 * GET /api/nba/teams — team list from the DB silver table (ESPN-fed daily),
 * with static identity fallbacks. Replaces the dead stats.nba.com read.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";

/** ESPN writes "Eastern Conference"; the old source wrote "East". */
export function normalizeConference(value: unknown): string {
  const v = String(value ?? "");
  if (v.startsWith("East")) return "East";
  if (v.startsWith("West")) return "West";
  return v;
}

async function fetchTeams() {
  const rows = (await sql`
    SELECT team_id, team_name, team_city, team_abbreviation, conference, division
    FROM nba_teams
    ORDER BY team_city
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const tid = Number(r.team_id);
    const staticTeam = TEAMS_BY_ID.get(tid);
    return {
      id: tid,
      name: String(r.team_name ?? staticTeam?.nickname ?? ""),
      city: String(r.team_city ?? staticTeam?.city ?? ""),
      abbrev: String(r.team_abbreviation ?? staticTeam?.abbreviation ?? ""),
      conference: normalizeConference(r.conference ?? staticTeam?.conference),
      division: r.division == null ? null : String(r.division),
    };
  });
}

export async function getTeams() {
  return cached("teams", fetchTeams, 3600);
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await getTeams();
    res.status(200).json({ data, _meta: { count: data.length, endpoint: "teams" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
