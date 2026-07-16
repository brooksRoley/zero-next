/**
 * GET /api/tools/rig-report — assembles the Entertainment Integrity Bureau's
 * daily case file for /tools/rig-report.
 *
 * Data strategy, in order of preference:
 *   1. Neon first: recent rows already ingested into nba_odds / nba_predictions /
 *      nba_prediction_results by the existing NBA pipeline. Free.
 *   2. If ODDS_API_KEY is set and the Neon-cached external snapshot is older
 *      than CACHE_TTL, pull one fresh snapshot from The Odds API and cache it
 *      in rig_report_cache (JSONB). The free tier is 500 credits/month and our
 *      call costs 3 credits (markets=spreads,totals,h2h × regions=us), so a
 *      6-hour TTL burns at most ~360 credits/month — quota survives.
 *   3. If there is no key and no data at all, serve the fixtures module,
 *      clearly labeled source: "demo", so the page always renders.
 *
 * The suspicion analysis itself is pure and deterministic (src/lib/rig/).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { createRateLimiter } from "src/lib/rate-limit";
import { fetchOdds, parseOddsResponse, type OddsRow } from "src/lib/nba/odds";
import {
  suspicionEngine,
  consensusHomeSpread,
  type GameCase,
  type BookLine,
  type SuspicionReport,
} from "src/lib/rig/suspicion";
import { holdPercent, overround, round } from "src/lib/rig/odds-math";
import { DEMO_CASES } from "src/lib/rig/fixtures";

const limiter = createRateLimiter(30, 10 * 60 * 1000); // 30 req / 10 min / IP

const CACHE_KEY = "odds:nba:v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — see quota math above

export type CaseFileEntry = {
  game: GameCase;
  report: SuspicionReport;
  /** House hold % for this game's moneyline market (null if no ML pair). */
  holdPct: number | null;
  overroundPct: number | null;
};

export type RigReportResponse = {
  source: "live" | "archive" | "demo";
  generatedAt: string;
  cases: CaseFileEntry[];
  house: {
    avgHoldPct: number | null;
    avgOverroundPct: number | null;
    gamesWithMoneylines: number;
    /** Expected loss per $100 wagered blindly into these markets. */
    lossPer100: number | null;
  };
  meta: {
    oddsApiConfigured: boolean;
    cacheAgeMinutes: number | null;
    note: string;
  };
};

// Create the cache table once per cold start (same pattern as api/events.ts).
let schemaReady = false;
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS rig_report_cache (
      cache_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

type Row = Record<string, any>;

/** Rows shaped like nba_odds, from either Neon or the cached external feed. */
type RawOdds = {
  event_id: string;
  bookmaker: string;
  spread_home: number | null;
  home_ml: number | null;
  away_ml: number | null;
  home_team: string;
  away_team: string;
  commence_time: string;
  captured_at: string;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Fold time-series odds rows into one GameCase per event: the latest row per
 * bookmaker becomes the current book line; the earliest/latest capture
 * consensus become opening/closing spreads.
 */
function buildCases(
  rows: RawOdds[],
  predictionsByEvent: Map<string, number>,
  marginsByEvent: Map<string, number>
): GameCase[] {
  const byEvent = new Map<string, RawOdds[]>();
  for (const r of rows) {
    if (!r.event_id || !r.bookmaker) continue;
    const list = byEvent.get(r.event_id) ?? [];
    list.push(r);
    byEvent.set(r.event_id, list);
  }

  const cases: GameCase[] = [];
  byEvent.forEach((eventRows, eventId) => {
    const sorted = [...eventRows].sort(
      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );

    const firstByBook = new Map<string, RawOdds>();
    const lastByBook = new Map<string, RawOdds>();
    for (const r of sorted) {
      if (!firstByBook.has(r.bookmaker)) firstByBook.set(r.bookmaker, r);
      lastByBook.set(r.bookmaker, r);
    }

    const toLine = (r: RawOdds): BookLine | null => {
      const spread = toNum(r.spread_home);
      if (spread === null) return null;
      return {
        bookmaker: r.bookmaker,
        spreadHome: spread,
        homeMl: toNum(r.home_ml),
        awayMl: toNum(r.away_ml),
      };
    };

    const books = Array.from(lastByBook.values())
      .map(toLine)
      .filter((b): b is BookLine => b !== null);
    if (books.length === 0) return;

    const openBooks = Array.from(firstByBook.values())
      .map(toLine)
      .filter((b): b is BookLine => b !== null);

    const latest = sorted[sorted.length - 1];
    cases.push({
      eventId,
      homeTeam: latest.home_team,
      awayTeam: latest.away_team,
      commenceTime: latest.commence_time,
      books,
      openingSpread: consensusHomeSpread(openBooks),
      closingSpread: consensusHomeSpread(books),
      modelSpread: predictionsByEvent.get(eventId) ?? null,
      actualMargin: marginsByEvent.get(eventId) ?? null,
      gameLabel: null,
    });
  });

  // Stable order: soonest tip-off first.
  cases.sort(
    (a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
  );
  return cases;
}

/** Pull the archived odds/prediction data the existing pipeline already owns. */
async function loadFromNeon(): Promise<{
  oddsRows: RawOdds[];
  predictionsByEvent: Map<string, number>;
  marginsByEvent: Map<string, number>;
}> {
  const [oddsRows, predictions, results] = await Promise.all([
    sql`
      SELECT event_id, bookmaker, spread_home, home_ml, away_ml,
             home_team, away_team, commence_time, captured_at
      FROM nba_odds
      WHERE captured_at > NOW() - INTERVAL '48 hours'
      ORDER BY captured_at ASC
    ` as Promise<Row[]>,
    sql`
      SELECT DISTINCT ON (event_id) event_id, sim_median_spread
      FROM nba_predictions
      WHERE created_at > NOW() - INTERVAL '72 hours'
      ORDER BY event_id, created_at DESC
    ` as Promise<Row[]>,
    sql`
      SELECT DISTINCT ON (event_id) event_id, actual_margin
      FROM nba_prediction_results
      WHERE actual_margin IS NOT NULL
        AND created_at > NOW() - INTERVAL '72 hours'
      ORDER BY event_id, settled_at DESC
    ` as Promise<Row[]>,
  ]);

  const predictionsByEvent = new Map<string, number>();
  for (const p of predictions) {
    const spread = toNum(p.sim_median_spread);
    if (p.event_id && spread !== null) predictionsByEvent.set(p.event_id, spread);
  }
  const marginsByEvent = new Map<string, number>();
  for (const r of results) {
    const margin = toNum(r.actual_margin);
    if (r.event_id && margin !== null) marginsByEvent.set(r.event_id, margin);
  }

  return {
    oddsRows: oddsRows.map((r) => ({
      event_id: String(r.event_id),
      bookmaker: String(r.bookmaker),
      spread_home: toNum(r.spread_home),
      home_ml: toNum(r.home_ml),
      away_ml: toNum(r.away_ml),
      home_team: String(r.home_team ?? ""),
      away_team: String(r.away_team ?? ""),
      commence_time: String(r.commence_time ?? ""),
      captured_at: String(r.captured_at ?? ""),
    })),
    predictionsByEvent,
    marginsByEvent,
  };
}

/**
 * Fetch a fresh snapshot from The Odds API through the Neon cache. Returns
 * the cached snapshot when it's younger than the TTL (spending zero credits),
 * refreshes it when stale, and falls back to the stale copy if the refresh
 * fails (quota exhausted, network, etc.). Returns null only when nothing has
 * ever been cached and the fetch fails or no key is set.
 */
async function loadExternal(apiKey: string): Promise<{
  rows: RawOdds[];
  cacheAgeMinutes: number;
} | null> {
  const cached = (await sql`
    SELECT payload, fetched_at FROM rig_report_cache WHERE cache_key = ${CACHE_KEY}
  `) as Row[];

  const cachedRow = cached[0];
  const cacheAgeMs = cachedRow
    ? Date.now() - new Date(cachedRow.fetched_at).getTime()
    : Infinity;

  if (cachedRow && cacheAgeMs < CACHE_TTL_MS) {
    return {
      rows: cachedRow.payload as RawOdds[],
      cacheAgeMinutes: Math.round(cacheAgeMs / 60000),
    };
  }

  try {
    const events = await fetchOdds(apiKey);
    const capturedAt = new Date().toISOString();
    const rows: RawOdds[] = events
      .flatMap((e) => parseOddsResponse(e))
      .map((r: OddsRow) => ({
        event_id: r.event_id,
        bookmaker: r.bookmaker,
        spread_home: r.spread_home,
        home_ml: r.home_ml ?? null,
        away_ml: r.away_ml ?? null,
        home_team: r.home_team,
        away_team: r.away_team,
        commence_time: r.commence_time,
        captured_at: capturedAt,
      }));

    await sql`
      INSERT INTO rig_report_cache (cache_key, payload, fetched_at)
      VALUES (${CACHE_KEY}, ${JSON.stringify(rows)}, NOW())
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()
    `;
    return { rows, cacheAgeMinutes: 0 };
  } catch {
    // Refresh failed — a stale snapshot is still better than nothing.
    if (cachedRow) {
      return {
        rows: cachedRow.payload as RawOdds[],
        cacheAgeMinutes: Math.round(cacheAgeMs / 60000),
      };
    }
    return null;
  }
}

function analyze(
  cases: GameCase[],
  source: RigReportResponse["source"],
  meta: RigReportResponse["meta"]
): RigReportResponse {
  const entries: CaseFileEntry[] = cases.map((game) => {
    const withMl = game.books.find((b) => b.homeMl != null && b.awayMl != null);
    const lines = withMl ? [withMl.homeMl as number, withMl.awayMl as number] : null;
    return {
      game,
      report: suspicionEngine(game),
      holdPct: lines ? round(holdPercent(lines), 2) : null,
      overroundPct: lines ? round(overround(lines) * 100, 2) : null,
    };
  });

  const holds = entries
    .map((e) => e.holdPct)
    .filter((h): h is number => h !== null);
  const overs = entries
    .map((e) => e.overroundPct)
    .filter((o): o is number => o !== null);
  const avg = (xs: number[]) =>
    xs.length > 0 ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null;

  const avgHold = avg(holds);
  return {
    source,
    generatedAt: new Date().toISOString(),
    cases: entries,
    house: {
      avgHoldPct: avgHold,
      avgOverroundPct: avg(overs),
      gamesWithMoneylines: holds.length,
      lossPer100: avgHold,
    },
    meta,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RigReportResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ip = limiter.getClientIp(req);
  if (limiter.isRateLimited(ip)) {
    return res
      .status(429)
      .json({ error: "The Bureau is under heavy scrutiny. Try again shortly." });
  }

  const apiKey = process.env.ODDS_API_KEY;
  const oddsApiConfigured = Boolean(apiKey && !apiKey.includes("REPLACE"));

  try {
    await ensureSchema();

    // 1. External feed (through the Neon cache) if a key is configured.
    let externalRows: RawOdds[] = [];
    let cacheAgeMinutes: number | null = null;
    if (oddsApiConfigured && apiKey) {
      const external = await loadExternal(apiKey);
      if (external) {
        externalRows = external.rows;
        cacheAgeMinutes = external.cacheAgeMinutes;
      }
    }

    // 2. Neon archive — always loaded; supplies model spreads, settled
    //    margins, and line history even when the external feed is live.
    const neon = await loadFromNeon();
    const allRows = [...neon.oddsRows, ...externalRows];

    const cases = buildCases(allRows, neon.predictionsByEvent, neon.marginsByEvent);
    if (cases.length > 0) {
      const source = externalRows.length > 0 ? "live" : "archive";
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json(
        analyze(cases, source, {
          oddsApiConfigured,
          cacheAgeMinutes,
          note:
            source === "live"
              ? "Lines via The Odds API (free tier), cached in Neon for 6 hours per snapshot."
              : "Lines from this site's own Neon archive (nba_odds); no external call made.",
        })
      );
    }
  } catch {
    // DB unreachable or query failed — fall through to the demo file.
  }

  // 3. Demo case file — the Bureau never closes.
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json(
    analyze(DEMO_CASES, "demo", {
      oddsApiConfigured,
      cacheAgeMinutes: null,
      note: "Demonstration case file with invented (but realistic) numbers. Set ODDS_API_KEY or run the NBA ingest to see real lines.",
    })
  );
}
