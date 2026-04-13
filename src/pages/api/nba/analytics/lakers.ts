import type { NextApiRequest, NextApiResponse } from "next";
import { cached } from "src/lib/nba/cache";
import { LAKERS_TEAM_ID } from "src/lib/nba/season";
import { fetchTeamAnalytics } from "./team/[id]";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await cached(
      "lakers_dashboard",
      () => fetchTeamAnalytics(LAKERS_TEAM_ID),
      600
    );
    if (!data) return res.status(404).json({ error: "Lakers data unavailable" });
    res.status(200).json({ data, _meta: { endpoint: "lakers_dashboard" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
