/**
 * GET /api/nba/teams/[id] — team identity + current roster from the DB
 * (ESPN roster feed, refreshed daily). Replaces the dead stats.nba.com read;
 * jersey numbers aren't collected, so `num` is no longer served.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
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
      const rows = (await sql`
        SELECT player_id, player_name, position, age
        FROM nba_players WHERE team_id = ${teamId}
        ORDER BY player_name
      `) as Array<Record<string, unknown>>;

      return rows.map((r) => ({
        id: Number(r.player_id),
        name: String(r.player_name),
        pos: String(r.position ?? ""),
        age: r.age == null ? null : Number(r.age),
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
