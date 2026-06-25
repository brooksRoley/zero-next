import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { computeAccuracy, evaluateCover, type PredictionRecord } from "src/lib/nba/predictions/accuracy";
import { getPredictionAccuracyByMonth } from "src/lib/nba/db/readers";

const ROLLING_WINDOW = 10;

interface WeeklyBucket {
  week: string;        // ISO week label, e.g. "2026-W23"
  games: number;
  coverRate: number;   // % of decided games (pushes excluded)
  modelMae: number;
  vegasMae: number;
  beatVegas: number;   // % of games where model error < Vegas error
}

interface MonthlyBucket {
  month: string;       // "YYYY-MM"
  games: number;
  coverRate: number;   // % of decided games (pushes excluded)
  modelMae: number;
  vegasMae: number;
  beatVegas: number;   // % of games where model error < Vegas error
}

// Shape the per-month SQL aggregate (counts/numerics arrive as strings from
// Neon) into the same bucket shape the weekly view uses, so the UI can render
// either granularity with one component.
function toMonthlyBuckets(rows: Record<string, unknown>[]): MonthlyBucket[] {
  return rows.map((r) => {
    const games = Number(r.total_predictions) || 0;
    const covers = Number(r.covers) || 0;
    const misses = Number(r.misses) || 0;
    const beatVegasCount = Number(r.beat_vegas_count) || 0;
    const decided = covers + misses;
    return {
      month: String(r.month),
      games,
      coverRate: decided > 0 ? Math.round((covers / decided) * 1000) / 10 : 0,
      modelMae: r.model_mae != null ? Number(r.model_mae) : 0,
      vegasMae: r.vegas_mae != null ? Number(r.vegas_mae) : 0,
      beatVegas: games > 0 ? Math.round((beatVegasCount / games) * 1000) / 10 : 0,
    };
  });
}

// True when the error is Postgres "undefined_table" (42P01) — i.e. the settled-
// results table has not been provisioned in this environment yet (run
// /api/nba/admin/setup). Neon surfaces the SQLSTATE on `.code`; we also match
// the message text as a fallback in case it arrives wrapped.
function isMissingTable(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "code" in e) {
    if ((e as { code?: unknown }).code === "42P01") return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /relation .*nba_prediction_results.* does not exist/i.test(msg);
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

    const granularity = Array.isArray(req.query.granularity)
      ? req.query.granularity[0]
      : req.query.granularity;
    // Monthly drift breakdown is aggregated in SQL (GROUP BY month) rather than
    // in JS — it's a coarse bucket, so let Postgres do the rollup.
    const monthly = granularity === "month"
      ? toMonthlyBuckets(await getPredictionAccuracyByMonth(sql))
      : undefined;

    res.status(200).json({
      data: stats,
      rollingCover,
      ...(weekly ? { weekly } : {}),
      ...(monthly ? { monthly } : {}),
      _meta: { endpoint: "predictions/accuracy", rollingWindow: ROLLING_WINDOW },
    });
  } catch (e: unknown) {
    // If the results table simply isn't provisioned yet, don't 503 — the page's
    // perpetual loading spinner masks that into a silently broken "model vs
    // Vegas" view. Degrade to an honest empty payload (totalPredictions: 0,
    // which the UI already renders as a "collecting data" state) and flag the
    // unprovisioned table in _meta so it stays diagnosable for the owner.
    // Genuine DB failures (connection, syntax) still surface as 503.
    if (isMissingTable(e)) {
      res.status(200).json({
        data: computeAccuracy([]),
        rollingCover: [],
        _meta: {
          endpoint: "predictions/accuracy",
          rollingWindow: ROLLING_WINDOW,
          tableProvisioned: false,
        },
      });
      return;
    }
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
