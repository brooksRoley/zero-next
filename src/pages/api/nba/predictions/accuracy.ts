import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { computeAccuracy, type PredictionRecord } from "src/lib/nba/predictions/accuracy";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await sql`
      SELECT predicted_spread, vegas_spread, actual_margin
      FROM nba_prediction_results
      WHERE settled_at IS NOT NULL
        AND predicted_spread IS NOT NULL
        AND vegas_spread IS NOT NULL
        AND actual_margin IS NOT NULL
    `;
    const records: PredictionRecord[] = rows.map((r) => ({
      predicted_spread: Number(r.predicted_spread),
      vegas_spread: Number(r.vegas_spread),
      actual_margin: Number(r.actual_margin),
    }));
    const stats = computeAccuracy(records);
    res.status(200).json({ data: stats, _meta: { endpoint: "predictions/accuracy" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
