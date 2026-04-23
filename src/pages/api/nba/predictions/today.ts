import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getTodayPredictions } from "src/lib/nba/db/readers";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const predictions = await getTodayPredictions(sql);
    res.status(200).json({ data: predictions, _meta: { endpoint: "predictions/today" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
