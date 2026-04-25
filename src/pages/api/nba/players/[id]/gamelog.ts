import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const playerId = Number(req.query.id);
  const n = Number(req.query.n) || 10;
  if (isNaN(playerId)) return res.status(400).json({ error: "Invalid player ID" });

  try {
    const allGames = await cached(`gamelog_${playerId}`, async () => {
      const season = currentNbaSeason();
      const rows = await fetchStats("playergamelog", {
        PlayerID: playerId,
        Season: season,
        SeasonType: "Regular Season",
      }, { resultSetName: "PlayerGameLog" });

      return rows.map((r, i) => ({
        game: i + 1,
        date: r.GAME_DATE as string,
        matchup: r.MATCHUP as string,
        pts: Number(r.PTS) || 0,
        reb: Number(r.REB) || 0,
        ast: Number(r.AST) || 0,
        fg_pct: Math.round((Number(r.FG_PCT) || 0) * 1000) / 1000,
        min: String(r.MIN ?? ""),
        wl: r.WL as string,
      }));
    }, 300);

    res.status(200).json({
      data: allGames.slice(0, n),
      _meta: { endpoint: "game_log", player_id: playerId },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
