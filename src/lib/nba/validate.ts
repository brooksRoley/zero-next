/**
 * Runtime validation for stats.nba.com responses.
 * Non-breaking: logs warnings for invalid rows, returns only valid ones.
 */
import { z } from "zod";
import type { NbaRow } from "./client";

export interface ValidationResult<T> {
  valid: T[];
  total: number;
  validCount: number;
  invalidCount: number;
}

export function validateRows<T>(
  schema: z.ZodSchema<T>,
  rows: NbaRow[],
  source: string
): T[] {
  const result: ValidationResult<T> = {
    valid: [],
    total: rows.length,
    validCount: 0,
    invalidCount: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const parsed = schema.safeParse(rows[i]);
    if (parsed.success) {
      result.valid.push(parsed.data);
      result.validCount++;
    } else {
      result.invalidCount++;
      console.warn(
        `[validate] ${source} row ${i}: ${parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
  }

  if (result.invalidCount > 0) {
    console.warn(
      `[validate] ${source}: ${result.invalidCount}/${result.total} rows failed validation`
    );
  }

  return result.valid;
}

/** Full result including counts */
export function validateRowsDetailed<T>(
  schema: z.ZodSchema<T>,
  rows: NbaRow[],
  source: string
): ValidationResult<T> {
  const valid = validateRows(schema, rows, source);
  return {
    valid,
    total: rows.length,
    validCount: valid.length,
    invalidCount: rows.length - valid.length,
  };
}
