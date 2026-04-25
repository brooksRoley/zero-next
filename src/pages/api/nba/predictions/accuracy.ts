import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getPredictionAccuracy } from "src/lib/nba/db/readers";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await getPredictionAccuracy(sql);
    const stats = rows[0] ?? { total_predictions: 0, beat_vegas_count: 0, covers: 0, misses: 0, pushes: 0, model_mae: null, vegas_mae: null };
    res.status(200).json({ data: stats, _meta: { endpoint: "predictions/accuracy" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
