import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStatsMulti } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const gameId = Number(req.query.id);
  if (isNaN(gameId)) return res.status(400).json({ error: "Invalid game ID" });

  try {
    const data = await cached(`game_${gameId}`, async () => {
      const nbaGameId = String(gameId).padStart(10, "0");
      const sets = await fetchStatsMulti("boxscoretraditionalv3", {
        GameID: nbaGameId,
      });

      const teamRows = sets["TeamStats"] ?? [];
      const playerRows = sets["PlayerStats"] ?? [];

      if (!teamRows.length) return null;

      const teamsInGame: Record<string, { id: number; name: string; abbrev: string }> = {};
      for (const r of teamRows) {
        const abbrev = r.teamTricode as string;
        teamsInGame[abbrev] = {
          id: Number(r.teamId),
          name: `${r.teamCity} ${r.teamName}`,
          abbrev,
        };
      }

      const boxScore: Record<string, { name: string; pts: number; reb: number; ast: number }[]> = {};
      for (const r of playerRows) {
        const abbrev = r.teamTricode as string;
        if (!boxScore[abbrev]) boxScore[abbrev] = [];
        boxScore[abbrev].push({
          name: `${r.firstName} ${r.familyName}`,
          pts: Number(r.points) || 0,
          reb: Number(r.reboundsTotal) || 0,
          ast: Number(r.assists) || 0,
        });
      }

      const teamList = Object.values(teamsInGame);
      const home = teamList[0] ?? {};
      const away = teamList[1] ?? {};

      const getScore = (abbrev: string) => {
        const row = teamRows.find((r) => r.teamTricode === abbrev);
        return row ? Number(row.points) || 0 : 0;
      };

      return {
        id: gameId,
        home,
        away,
        home_score: getScore((home as { abbrev?: string }).abbrev ?? ""),
        away_score: getScore((away as { abbrev?: string }).abbrev ?? ""),
        box_score: boxScore,
      };
    }, 3600);

    if (!data) return res.status(404).json({ error: "Game not found" });
    res.status(200).json({ data, _meta: { endpoint: "game_detail" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: `NBA API error: ${msg}` });
  }
}
