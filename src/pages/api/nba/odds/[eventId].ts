import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getOddsForEvent } from "src/lib/nba/db/readers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventId = req.query.eventId as string;
  try {
    const odds = await getOddsForEvent(sql, eventId);
    res.status(200).json({ data: odds, _meta: { endpoint: "odds", eventId } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
