/**
 * GET /api/nba/players/[id] — player identity + current-season per-game
 * stats from the DB (ESPN-fed). The old commonplayerinfo bio fields
 * (height/weight/jersey/country) aren't collected from a trusted stream yet,
 * so they are no longer served.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import { getPlayers } from "../index";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const playerId = Number(req.query.id);
  if (isNaN(playerId)) return res.status(400).json({ error: "Invalid player ID" });

  try {
    const data = await cached(`player_${playerId}`, async () => {
      const rows = (await sql`
        SELECT player_id, player_name, team_id, team_abbreviation, position, age
        FROM nba_players WHERE player_id = ${playerId}
      `) as Array<Record<string, unknown>>;

      if (!rows.length) return null;
      const r = rows[0];

      const allPlayers = await getPlayers();
      const stats = allPlayers.find((p) => p.id === playerId);
      const teamId = r.team_id == null ? null : Number(r.team_id);

      return {
        id: playerId,
        name: String(r.player_name),
        team_id: teamId,
        team: teamId != null ? TEAMS_BY_ID.get(teamId)?.abbreviation ?? String(r.team_abbreviation ?? "") : null,
        pos: String(r.position ?? ""),
        age: r.age == null ? null : Number(r.age),
        gp: stats?.gp ?? 0,
        mpg: stats?.mpg ?? 0,
        ppg: stats?.ppg ?? 0,
        rpg: stats?.rpg ?? 0,
        apg: stats?.apg ?? 0,
        fga: stats?.fga ?? 0,
        fg_pct: stats?.fg_pct ?? 0,
      };
    }, 3600);

    if (!data) return res.status(404).json({ error: "Not found" });
    res.status(200).json({ data, _meta: { endpoint: "player_detail" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
