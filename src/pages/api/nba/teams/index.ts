import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";

async function fetchTeams() {
  const season = currentNbaSeason();
  const rows = await fetchStats("leaguestandingsv3", {
    LeagueID: "00",
    Season: season,
    SeasonType: "Regular Season",
  }, { resultSetName: "Standings" });

  return rows.map((r) => {
    const tid = Number(r.TeamID);
    const staticTeam = TEAMS_BY_ID.get(tid);
    return {
      id: tid,
      name: r.TeamName as string,
      city: r.TeamCity as string,
      abbrev: staticTeam?.abbreviation ?? "",
      conference: r.Conference as string,
      division: r.Division as string,
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
