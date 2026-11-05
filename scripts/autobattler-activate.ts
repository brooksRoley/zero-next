/**
 * Promotes a tft_coefficients row to active.
 * Flips all other rows to active=false first (only one active row allowed).
 *
 * Usage:
 *   yarn autobattler:activate <version>
 *
 * Example:
 *   yarn autobattler:activate 2026-backtest-a1b2c3d4
 */
import { sql } from "src/lib/db";

// The tft_coefficients / tft_predictions table names predate the autobattler rename; kept to avoid migrating production data.

async function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: yarn autobattler:activate <version>");
    process.exit(1);
  }

  const rows = (await sql`
    SELECT id, version, fit_season, metrics FROM tft_coefficients WHERE version = ${version}
  `) as Array<{ id: number; version: string; fit_season: string; metrics: unknown }>;

  if (!rows.length) {
    console.error(`[autobattler:activate] No coefficient row found for version="${version}"`);
    console.error("[autobattler:activate] Run: SELECT version, fit_season, created_at FROM tft_coefficients ORDER BY created_at DESC LIMIT 10;");
    process.exit(1);
  }

  const row = rows[0];

  // Deactivate all current active rows first
  const deactivated = (await sql`
    UPDATE tft_coefficients SET active = false WHERE active = true
    RETURNING version
  `) as Array<{ version: string }>;

  if (deactivated.length > 0) {
    console.log(`[autobattler:activate] deactivated: ${deactivated.map((r) => r.version).join(", ")}`);
  }

  // Activate the target version
  await sql`UPDATE tft_coefficients SET active = true WHERE version = ${version}`;

  console.log(`[autobattler:activate] promoted: ${row.version} (season=${row.fit_season})`);
  console.log(`[autobattler:activate] metrics:`, JSON.stringify(row.metrics, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[autobattler:activate] fatal:", e);
    process.exit(1);
  });
