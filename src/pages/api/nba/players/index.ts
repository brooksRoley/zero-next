import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";
import { PlayerSchema } from "src/lib/nba/schemas";
import { validateRows } from "src/lib/nba/validate";

async function fetchPlayers() {
  const season = currentNbaSeason();
  const rows = await fetchStats("leaguedashplayerstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Base",
    LeagueID: "00",
  });

  const validated = validateRows(PlayerSchema, rows, "leaguedashplayerstats");

  return validated.map((r) => ({
    id: Number(r.PLAYER_ID),
    name: r.PLAYER_NAME as string,
    team_id: Number(r.TEAM_ID),
    pos: "",
    ppg: Math.round((Number(r.PTS) || 0) * 10) / 10,
    rpg: Math.round((Number(r.REB) || 0) * 10) / 10,
    apg: Math.round((Number(r.AST) || 0) * 10) / 10,
  }));
}

export async function getPlayers() {
  return cached("players", fetchPlayers, 3600);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    let data = await getPlayers();
    const tid = Number(req.query.team_id);
    if (tid) data = data.filter((p) => p.team_id === tid);
    res.status(200).json({ data, _meta: { count: data.length, endpoint: "players" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
