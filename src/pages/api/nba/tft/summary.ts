import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const active = await sql`
    SELECT version, fit_season, coefficients, metrics
    FROM tft_coefficients
    WHERE active = true
    LIMIT 1
  ` as Array<{
    version: string;
    fit_season: string;
    coefficients: unknown;
    metrics: unknown;
  }>;

  if (!active.length) {
    return res.status(503).json({ error: "No active TFT coefficients" });
  }

  const { version, fit_season, coefficients, metrics } = active[0];

  const teams = (await sql`
    SELECT team_id, sim_wins, actual_wins, sim_pred_wins
    FROM tft_predictions
    WHERE version = ${version} AND player_id IS NULL
    ORDER BY team_id
  `) as Array<{
    team_id: number;
    sim_wins: number | null;
    actual_wins: number | null;
    sim_pred_wins: number | null;
  }>;

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
  res.status(200).json({
    version,
    fit_season,
    coefficients,
    metrics,
    teams: teams.map((t) => ({
      team_id: t.team_id,
      sim_wins: t.sim_wins ?? 0,
      actual_wins: t.actual_wins ?? 0,
      sim_pred_wins: t.sim_pred_wins,
      eps_engine: (t.actual_wins ?? 0) - (t.sim_wins ?? 0),
      eps_tactics:
        (t.sim_wins ?? 0) - (t.sim_pred_wins ?? t.sim_wins ?? 0),
    })),
  });
}
