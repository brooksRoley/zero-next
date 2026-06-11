import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { computeAccuracy, evaluateCover, type PredictionRecord } from "src/lib/nba/predictions/accuracy";

const ROLLING_WINDOW = 10;

interface WeeklyBucket {
  week: string;        // ISO week label, e.g. "2026-W23"
  games: number;
  coverRate: number;   // % of decided games (pushes excluded)
  modelMae: number;
  vegasMae: number;
  beatVegas: number;   // % of games where model error < Vegas error
}

// ISO-8601 week label (weeks start Monday; week 1 contains the first Thursday).
function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Bucket settled predictions by ISO week (input is already in chronological
// order, so the bucket insertion order is chronological too).
function weeklyAccuracy(records: PredictionRecord[], settledAt: Date[]): WeeklyBucket[] {
  const buckets = new Map<string, PredictionRecord[]>();
  for (let i = 0; i < records.length; i++) {
    const label = isoWeekLabel(settledAt[i]);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(records[i]);
    else buckets.set(label, [records[i]]);
  }

  const weekly: WeeklyBucket[] = [];
  buckets.forEach((recs, week) => {
    const stats = computeAccuracy(recs);
    const decided = stats.covers + stats.misses;
    weekly.push({
      week,
      games: stats.totalPredictions,
      coverRate: decided > 0 ? Math.round((stats.covers / decided) * 1000) / 10 : 0,
      modelMae: stats.modelMae,
      vegasMae: stats.vegasMae,
      beatVegas: stats.totalPredictions > 0
        ? Math.round((stats.beatVegas / stats.totalPredictions) * 1000) / 10
        : 0,
    });
  });
  return weekly;
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await sql`
      SELECT predicted_spread, vegas_spread, actual_margin, settled_at
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
    const groupBy = Array.isArray(req.query.groupBy)
      ? req.query.groupBy[0]
      : req.query.groupBy;
    const weekly = groupBy === "week"
      ? weeklyAccuracy(records, rows.map((r) => new Date(r.settled_at)))
      : undefined;
    res.status(200).json({
      data: stats,
      rollingCover,
      ...(weekly ? { weekly } : {}),
      _meta: { endpoint: "predictions/accuracy", rollingWindow: ROLLING_WINDOW },
    });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
