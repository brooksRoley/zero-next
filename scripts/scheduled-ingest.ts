/**
 * Scheduled NBA data ingestion with retry logic and resilience.
 * Designed to run as a cron job or Vercel Cron.
 *
 * Usage:
 *   POSTGRES_URL="..." npx tsx scripts/scheduled-ingest.ts [season]
 *
 * Features:
 *   - Retries failed requests with exponential backoff
 *   - Continues past individual endpoint failures
 *   - Logs all attempts to bronze table
 *   - Reports success/failure summary
 */
import { neon } from "@neondatabase/serverless";
import { fetchStats } from "../src/lib/nba/client";
import { PlayerSchema, StandingsSchema, GameLogSchema } from "../src/lib/nba/schemas";
import { validateRows } from "../src/lib/nba/validate";
import {
  upsertPlayers, upsertTeams, upsertPlayerGameStats,
  logBronzeIngestion,
} from "../src/lib/nba/db/writers";
import { currentNbaSeason, LAKERS_TEAM_ID } from "../src/lib/nba/season";
import type { NbaRow } from "../src/lib/nba/client";

const season = process.argv[2] || currentNbaSeason();

interface IngestResult {
  endpoint: string;
  status: "success" | "failed" | "skipped";
  rowCount: number;
  error?: string;
  durationMs: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === maxRetries) throw e;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retry] ${label} attempt ${attempt}/${maxRetries} failed: ${msg}. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

async function ingestEndpoint(
  sql: any,
  label: string,
  endpoint: string,
  params: Record<string, string | number>,
  schema: any,
  upsertFn: (sql: any, rows: Record<string, any>[]) => Promise<number>,
  options?: { resultSetName?: string }
): Promise<IngestResult> {
  const start = Date.now();
  try {
    const rows = await withRetry(
      () => fetchStats(endpoint, params, options),
      label
    );

    await logBronzeIngestion(sql, "stats.nba.com", endpoint, params, rows.slice(0, 2), rows.length);

    const valid = validateRows(schema, rows, endpoint) as Record<string, any>[];
    const count = await upsertFn(sql, valid);

    const duration = Date.now() - start;
    console.log(`[${label}] ${count} rows upserted (${valid.length}/${rows.length} valid) in ${duration}ms`);
    return { endpoint, status: "success", rowCount: count, durationMs: duration };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const duration = Date.now() - start;
    console.error(`[${label}] FAILED after ${duration}ms: ${msg}`);
    return { endpoint, status: "failed", rowCount: 0, error: msg, durationMs: duration };
  }
}

async function refreshGoldPlayerStats(sql: any) {
  console.log("\n[gold] Refreshing player season stats...");
  const start = Date.now();
  try {
    await sql`
      INSERT INTO nba_player_season_stats (player_id, season, team_id, games_played, mpg, ppg, rpg, apg, spg, bpg, topg, fg_pct, fg3_pct, ft_pct, plus_minus_avg, updated_at)
      SELECT
        pgs.player_id,
        g.season,
        pgs.team_id,
        COUNT(*)::int as games_played,
        ROUND(AVG(pgs.minutes), 1) as mpg,
        ROUND(AVG(pgs.pts), 1) as ppg,
        ROUND(AVG(pgs.reb), 1) as rpg,
        ROUND(AVG(pgs.ast), 1) as apg,
        ROUND(AVG(pgs.stl), 1) as spg,
        ROUND(AVG(pgs.blk), 1) as bpg,
        ROUND(AVG(pgs.tov), 1) as topg,
        ROUND(AVG(pgs.fg_pct), 3) as fg_pct,
        ROUND(AVG(pgs.fg3_pct), 3) as fg3_pct,
        ROUND(AVG(pgs.ft_pct), 3) as ft_pct,
        ROUND(AVG(pgs.plus_minus), 1) as plus_minus_avg,
        NOW()
      FROM nba_player_game_stats pgs
      JOIN nba_games g ON g.game_id = pgs.game_id
      WHERE g.season = ${season}
      GROUP BY pgs.player_id, g.season, pgs.team_id
      ON CONFLICT (player_id, season) DO UPDATE SET
        games_played = EXCLUDED.games_played,
        mpg = EXCLUDED.mpg, ppg = EXCLUDED.ppg, rpg = EXCLUDED.rpg,
        apg = EXCLUDED.apg, spg = EXCLUDED.spg, bpg = EXCLUDED.bpg,
        topg = EXCLUDED.topg, fg_pct = EXCLUDED.fg_pct,
        fg3_pct = EXCLUDED.fg3_pct, ft_pct = EXCLUDED.ft_pct,
        plus_minus_avg = EXCLUDED.plus_minus_avg, updated_at = NOW()
    `;
    const count = await sql`SELECT COUNT(*) as count FROM nba_player_season_stats WHERE season = ${season}`;
    console.log(`[gold] Refreshed ${count[0].count} player season stat rows in ${Date.now() - start}ms`);
  } catch (e) {
    console.error(`[gold] Failed to refresh: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL required");
    process.exit(1);
  }

  const sql = neon(url);
  const startTime = Date.now();
  console.log(`=== Scheduled NBA Ingestion — ${season} — ${new Date().toISOString()} ===\n`);

  const results: IngestResult[] = [];

  // 1. Players
  results.push(await ingestEndpoint(
    sql, "players", "leaguedashplayerstats",
    { Season: season, SeasonType: "Regular Season", PerMode: "PerGame", MeasureType: "Base", LeagueID: "00" },
    PlayerSchema, upsertPlayers
  ));

  await new Promise((r) => setTimeout(r, 1500));

  // 2. Standings + Teams
  results.push(await ingestEndpoint(
    sql, "standings", "leaguestandingsv3",
    { LeagueID: "00", Season: season, SeasonType: "Regular Season" },
    StandingsSchema,
    async (sql, rows) => {
      const teamCount = await upsertTeams(sql, rows);
      for (const s of rows) {
        await sql`
          INSERT INTO nba_standings (team_id, season, conference, division, wins, losses, win_pct, playoff_rank, updated_at)
          VALUES (${Number(s.TeamID)}, ${season}, ${s.Conference}, ${s.Division}, ${Number(s.WINS)}, ${Number(s.LOSSES)}, ${Number(s.WinPCT)}, ${Number(s.PlayoffRank)}, NOW())
          ON CONFLICT (team_id, season) DO UPDATE SET
            wins = EXCLUDED.wins, losses = EXCLUDED.losses, win_pct = EXCLUDED.win_pct,
            playoff_rank = EXCLUDED.playoff_rank, updated_at = NOW()
        `;
      }
      return teamCount + rows.length;
    },
    { resultSetName: "Standings" }
  ));

  // 3. Refresh gold tables from silver
  await refreshGoldPlayerStats(sql);

  // Summary
  const totalDuration = Date.now() - startTime;
  console.log("\n=== Ingestion Summary ===");
  console.log(`Duration: ${totalDuration}ms`);
  for (const r of results) {
    const icon = r.status === "success" ? "OK" : "FAIL";
    console.log(`  [${icon}] ${r.endpoint}: ${r.rowCount} rows (${r.durationMs}ms)${r.error ? ` — ${r.error}` : ""}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error(`\n${failed.length} endpoint(s) failed. Check logs above.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Scheduled ingestion crashed:", e);
  process.exit(1);
});
