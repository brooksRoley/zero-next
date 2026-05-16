import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getTodayPredictions } from "src/lib/nba/db/readers";
import { logPredictionServed } from "src/lib/nba/db/writers";

type ServedRow = {
  event_id?: string | null;
  game_id?: string | null;
  sim_median_spread?: number | string | null;
  vegas_spread?: number | string | null;
  calibration_version?: string | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const predictions = await getTodayPredictions(sql);

    // Log each served prediction (idempotent on event_id + calibration_version).
    // Fire-and-forget so a logging error doesn't block the response.
    Promise.allSettled(
      (predictions as ServedRow[])
        .filter((p) => p.event_id && p.calibration_version)
        .map((p) => {
          const predicted = num(p.sim_median_spread);
          if (predicted === null) return Promise.resolve();
          return logPredictionServed(sql, {
            event_id: p.event_id as string,
            game_id: p.game_id ?? null,
            predicted_spread: predicted,
            vegas_spread: num(p.vegas_spread),
            calibration_version: p.calibration_version as string,
          });
        })
    ).catch(() => { /* swallow */ });

    res.status(200).json({ data: predictions, _meta: { endpoint: "predictions/today" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
