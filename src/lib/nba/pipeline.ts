/**
 * Pipeline utilities: bronze→silver→gold transforms, checkpointing, idempotency.
 */
import type { NbaRow } from "./client";

export interface Checkpoint {
  endpoint: string;
  lastGameDate: string | null;
  lastRunAt: string;
  rowCount: number;
}

/**
 * Get the last ingestion checkpoint for an endpoint.
 */
export async function getCheckpoint(sql: any, endpoint: string): Promise<Checkpoint | null> {
  const rows = await sql`
    SELECT endpoint, ingested_at, row_count
    FROM nba_bronze_ingestions
    WHERE endpoint = ${endpoint}
    ORDER BY ingested_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return {
    endpoint,
    lastGameDate: null,
    lastRunAt: rows[0].ingested_at,
    rowCount: rows[0].row_count,
  };
}

/**
 * Bronze→Silver: clean raw NbaRow data for silver layer.
 * - Removes exact duplicate rows (by serialization)
 * - Coerces numeric strings to numbers
 * - Preserves nulls (does NOT replace with 0)
 */
export function cleanForSilver(rows: NbaRow[]): NbaRow[] {
  // Deduplicate
  const seen = new Set<string>();
  const deduped: NbaRow[] = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }

  // Coerce types — numeric fields should be numbers, not strings
  const numericFields = [
    "PTS", "REB", "AST", "STL", "BLK", "TOV", "MIN",
    "FGM", "FGA", "FG_PCT", "FG3M", "FG3A", "FG3_PCT",
    "FTM", "FTA", "FT_PCT", "PLUS_MINUS", "GP",
    "WINS", "LOSSES", "WinPCT", "PlayoffRank",
    "PLAYER_ID", "TEAM_ID", "TeamID",
  ];

  return deduped.map((row) => {
    const cleaned: NbaRow = { ...row };
    for (const field of numericFields) {
      if (field in cleaned && cleaned[field] != null) {
        const val = cleaned[field];
        if (typeof val === "string" && val.trim() !== "") {
          const num = Number(val);
          if (!isNaN(num)) {
            cleaned[field] = num;
          }
        }
      }
      // Explicitly: do NOT set null/missing to 0
    }
    return cleaned;
  });
}

/**
 * Silver→Gold: aggregate per-game stats to season averages.
 */
export function aggregateSeasonStats(
  gameStats: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; minutes: number; fg_pct: number; fg3_pct: number; ft_pct: number; plus_minus: number }[]
): {
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  mpg: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  plusMinusAvg: number;
} {
  const gp = gameStats.length;
  if (gp === 0) {
    return { gamesPlayed: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, topg: 0, mpg: 0, fg_pct: 0, fg3_pct: 0, ft_pct: 0, plusMinusAvg: 0 };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => sum(arr) / arr.length;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  return {
    gamesPlayed: gp,
    ppg: round1(avg(gameStats.map((g) => g.pts))),
    rpg: round1(avg(gameStats.map((g) => g.reb))),
    apg: round1(avg(gameStats.map((g) => g.ast))),
    spg: round1(avg(gameStats.map((g) => g.stl))),
    bpg: round1(avg(gameStats.map((g) => g.blk))),
    topg: round1(avg(gameStats.map((g) => g.tov))),
    mpg: round1(avg(gameStats.map((g) => g.minutes))),
    fg_pct: round3(avg(gameStats.map((g) => g.fg_pct))),
    fg3_pct: round3(avg(gameStats.map((g) => g.fg3_pct))),
    ft_pct: round3(avg(gameStats.map((g) => g.ft_pct))),
    plusMinusAvg: round1(avg(gameStats.map((g) => g.plus_minus))),
  };
}

/**
 * Check if a pipeline run would produce the same output (idempotency check).
 * Compares row count from last bronze ingestion with current.
 */
export async function isIdempotent(sql: any, endpoint: string, currentRowCount: number): Promise<boolean> {
  const checkpoint = await getCheckpoint(sql, endpoint);
  if (!checkpoint) return false;
  return checkpoint.rowCount === currentRowCount;
}
