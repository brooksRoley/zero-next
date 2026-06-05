import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { computeAccuracy, evaluateCover, type PredictionRecord } from "src/lib/nba/predictions/accuracy";

const ROLLING_WINDOW = 10;

// Trailing cover rate (%) over the last ROLLING_WINDOW settled games, in
// chronological order. Pushes are excluded from the denominator.
function rollingCoverRate(records: PredictionRecord[]): number[] {
  const series: number[] = [];
  for (let i = 0; i < records.length; i++) {
    const start = Math.max(0, i - ROLLING_WINDOW + 1);
    let covers = 0, decided = 0;
    for (let j = start; j <= i; j++) {
      const outcome = evaluateCover(records[j]);
      if (outcome === "push") continue;
      decided++;
      if (outcome === "cover") covers++;
    }
    series.push(decided > 0 ? Math.round((covers / decided) * 1000) / 10 : 0);
  }
  return series;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await sql`
      SELECT predicted_spread, vegas_spread, actual_margin
      FROM nba_prediction_results
      WHERE settled_at IS NOT NULL
        AND predicted_spread IS NOT NULL
        AND vegas_spread IS NOT NULL
        AND actual_margin IS NOT NULL
      ORDER BY settled_at ASC
    `;
    const records: PredictionRecord[] = rows.map((r) => ({
      predicted_spread: Number(r.predicted_spread),
      vegas_spread: Number(r.vegas_spread),
      actual_margin: Number(r.actual_margin),
    }));
    const stats = computeAccuracy(records);
    const rollingCover = rollingCoverRate(records);
    res.status(200).json({
      data: stats,
      rollingCover,
      _meta: { endpoint: "predictions/accuracy", rollingWindow: ROLLING_WINDOW },
    });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
