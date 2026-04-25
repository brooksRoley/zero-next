import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getPrediction, getOddsForEvent } from "src/lib/nba/db/readers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventId = req.query.eventId as string;
  try {
    const [prediction, odds] = await Promise.all([
      getPrediction(sql, eventId),
      getOddsForEvent(sql, eventId),
    ]);
    if (!prediction) {
      return res.status(404).json({ error: "No prediction found for this event" });
    }
    res.status(200).json({ data: { prediction, odds }, _meta: { endpoint: "predictions/detail" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
