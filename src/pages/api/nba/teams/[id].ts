import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { getTeams } from "./index";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const teamId = Number(req.query.id);
  if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

  try {
    const allTeams = await getTeams();
    const team = allTeams.find((t) => t.id === teamId);
    if (!team) return res.status(404).json({ error: "Not found" });

    const roster = await cached(`roster_${teamId}`, async () => {
      const season = currentNbaSeason();
      const rows = await fetchStats("commonteamroster", {
        TeamID: teamId,
        Season: season,
      }, { resultSetName: "CommonTeamRoster" });

      return rows.map((r) => ({
        id: Number(r.PLAYER_ID),
        name: r.PLAYER as string,
        pos: r.POSITION as string,
        num: r.NUM as string,
      }));
    }, 3600);

    res.status(200).json({
      data: { ...team, roster },
      _meta: { endpoint: "team_detail" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
