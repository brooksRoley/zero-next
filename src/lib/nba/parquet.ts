/**
 * Parquet export utilities for NBA gold tables.
 * Uses a simple columnar format that can be read by standard Parquet tools.
 *
 * For production, integrate with @dsnp/parquetjs or parquet-wasm.
 * This module provides the data transformation layer.
 */

export interface ColumnDef {
  name: string;
  type: "INT32" | "INT64" | "FLOAT" | "DOUBLE" | "UTF8" | "BOOLEAN";
}

export interface ParquetData {
  schema: ColumnDef[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Transform DB query results into Parquet-ready columnar format.
 */
export function toParquetData(
  rows: Record<string, unknown>[],
  schema: ColumnDef[]
): ParquetData {
  const columnNames = new Set(schema.map((c) => c.name));
  const filtered = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of schema) {
      out[col.name] = row[col.name] ?? null;
    }
    return out;
  });

  return { schema, rows: filtered, rowCount: filtered.length };
}

/**
 * Estimate the size of data in JSON vs columnar format.
 */
export function estimateSize(data: ParquetData): { jsonBytes: number; columnarBytes: number; ratio: number } {
  const jsonStr = JSON.stringify(data.rows);
  const jsonBytes = new TextEncoder().encode(jsonStr).length;

  // Estimate columnar size: type-aware byte counts per column
  let columnarBytes = 0;
  for (const col of data.schema) {
    const values = data.rows.map((r) => r[col.name]);
    switch (col.type) {
      case "INT32":
        columnarBytes += values.length * 4;
        break;
      case "INT64":
      case "DOUBLE":
        columnarBytes += values.length * 8;
        break;
      case "FLOAT":
        columnarBytes += values.length * 4;
        break;
      case "BOOLEAN":
        columnarBytes += Math.ceil(values.length / 8);
        break;
      case "UTF8":
        columnarBytes += values.reduce((s: number, v) => s + (typeof v === "string" ? v.length : 0), 0);
        break;
    }
  }

  return {
    jsonBytes,
    columnarBytes,
    ratio: columnarBytes > 0 ? jsonBytes / columnarBytes : 0,
  };
}

/** Player season stats schema for Parquet export */
export const PLAYER_SEASON_SCHEMA: ColumnDef[] = [
  { name: "player_id", type: "INT32" },
  { name: "season", type: "UTF8" },
  { name: "team_id", type: "INT32" },
  { name: "games_played", type: "INT32" },
  { name: "mpg", type: "DOUBLE" },
  { name: "ppg", type: "DOUBLE" },
  { name: "rpg", type: "DOUBLE" },
  { name: "apg", type: "DOUBLE" },
  { name: "spg", type: "DOUBLE" },
  { name: "bpg", type: "DOUBLE" },
  { name: "topg", type: "DOUBLE" },
  { name: "fg_pct", type: "DOUBLE" },
  { name: "fg3_pct", type: "DOUBLE" },
  { name: "ft_pct", type: "DOUBLE" },
  { name: "plus_minus_avg", type: "DOUBLE" },
];

/** Team season stats schema for Parquet export */
export const TEAM_SEASON_SCHEMA: ColumnDef[] = [
  { name: "team_id", type: "INT32" },
  { name: "season", type: "UTF8" },
  { name: "games_played", type: "INT32" },
  { name: "ppg", type: "DOUBLE" },
  { name: "opp_ppg", type: "DOUBLE" },
  { name: "rpg", type: "DOUBLE" },
  { name: "apg", type: "DOUBLE" },
  { name: "pace", type: "DOUBLE" },
  { name: "off_rtg", type: "DOUBLE" },
  { name: "def_rtg", type: "DOUBLE" },
  { name: "net_rtg", type: "DOUBLE" },
];
