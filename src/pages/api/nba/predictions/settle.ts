/**
 * Settles outstanding predictions in nba_prediction_results by joining against
 * nba_games for the final score. Fills actual_margin, beat_vegas, ats_result,
 * and settled_at. Idempotent — only touches rows where settled_at IS NULL.
 *
 * Cron: add to vercel.json after the daily ingest so games have final scores.
 * Manual: POST with x-admin-key header.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { settlePredictions } from "src/lib/nba/db/writers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isVercelCron = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = req.headers["x-admin-key"] === process.env.ADMIN_KEY;
  if (!isVercelCron && !isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const settled = await settlePredictions(sql);
    res.status(200).json({ settled, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
