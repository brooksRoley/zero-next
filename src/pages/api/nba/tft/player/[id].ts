import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isMissingTable } from "src/lib/nba/pgErrors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "player id required" });
  }

  try {
    const active = (await sql`
      SELECT version
      FROM tft_coefficients
      WHERE active = true
      LIMIT 1
    `) as Array<{ version: string }>;

    if (!active.length) {
      return res.status(503).json({ error: "No active TFT coefficients" });
    }

    const { version } = active[0];

    const rows = (await sql`
      SELECT sim_shot_bins, actual_shot_bins, sim_box, actual_box
      FROM tft_predictions
      WHERE version = ${version} AND player_id = ${id}
      LIMIT 1
    `) as Array<{
      sim_shot_bins: unknown;
      actual_shot_bins: unknown;
      sim_box: unknown;
      actual_box: unknown;
    }>;

    if (!rows.length) {
      return res.status(404).json({ error: "Player not in this backtest" });
    }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.status(200).json(rows[0]);
  } catch (e: unknown) {
    // See summary.ts — tables not provisioned in this environment yet. Return a
    // clean JSON 503 rather than letting the missing-table throw become a raw 500.
    if (isMissingTable(e)) {
      return res.status(503).json({ error: "TFT tables not yet provisioned" });
    }
    return res
      .status(503)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
