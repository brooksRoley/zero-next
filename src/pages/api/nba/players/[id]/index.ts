import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { getPlayers } from "../index";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const playerId = Number(req.query.id);
  if (isNaN(playerId)) return res.status(400).json({ error: "Invalid player ID" });

  try {
    const data = await cached(`player_${playerId}`, async () => {
      const rows = await fetchStats("commonplayerinfo", {
        PlayerID: playerId,
      }, { resultSetName: "CommonPlayerInfo" });

      if (!rows.length) return null;
      const r = rows[0];

      const allPlayers = await getPlayers();
      const stats = allPlayers.find((p) => p.id === playerId);

      return {
        id: playerId,
        name: r.DISPLAY_FIRST_LAST as string,
        team_id: Number(r.TEAM_ID) || 0,
        pos: r.POSITION as string,
        jersey: r.JERSEY as string,
        height: r.HEIGHT as string,
        weight: r.WEIGHT as string,
        country: r.COUNTRY as string,
        ppg: stats?.ppg ?? 0,
        rpg: stats?.rpg ?? 0,
        apg: stats?.apg ?? 0,
      };
    }, 3600);

    if (!data) return res.status(404).json({ error: "Not found" });
    res.status(200).json({ data, _meta: { endpoint: "player_detail" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
