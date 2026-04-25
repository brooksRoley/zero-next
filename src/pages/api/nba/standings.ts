import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import { StandingsSchema } from "src/lib/nba/schemas";
import { validateRows } from "src/lib/nba/validate";

async function fetchStandings() {
  const season = currentNbaSeason();
  const rows = await fetchStats("leaguestandingsv3", {
    LeagueID: "00",
    Season: season,
    SeasonType: "Regular Season",
  }, { resultSetName: "Standings" });
  return validateRows(StandingsSchema, rows, "leaguestandingsv3/standings");
}

export async function getStandingsRows() {
  return cached("standings_rows", fetchStandings, 600);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const conf = (req.query.conference as string) || "";

  try {
    const rows = await getStandingsRows();

    let result = rows.map((r) => {
      const tid = Number(r.TeamID);
      const staticTeam = TEAMS_BY_ID.get(tid);
      return {
        id: tid,
        name: r.TeamName as string,
        city: r.TeamCity as string,
        abbrev: staticTeam?.abbreviation ?? "",
        conference: r.Conference as string,
        division: r.Division as string,
        wins: Number(r.WINS),
        losses: Number(r.LOSSES),
        pct: Math.round(Number(r.WinPCT) * 1000) / 1000,
      };
    });

    if (conf) {
      result = result.filter(
        (s) => s.conference.toLowerCase() === conf.toLowerCase()
      );
    }

    result.sort((a, b) => b.pct - a.pct);
    const ranked = result.map((s, i) => ({ ...s, rank: i + 1 }));

    res.status(200).json({ data: ranked, _meta: { endpoint: "standings" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
