/**
 * Run NBA medallion migrations directly against Neon.
 * Usage: POSTGRES_URL="postgres://..." npx tsx scripts/run-migrations.ts
 */
import { neon } from "@neondatabase/serverless";
import { runMigrations } from "../src/lib/nba/db/migrate";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL is required. Set it in your environment or pass inline:");
    console.error('  POSTGRES_URL="postgres://..." npx tsx scripts/run-migrations.ts');
    process.exit(1);
  }

  console.log("Connecting to Neon...");
  const sql = neon(url);

  console.log("Running migrations...");
  const tables = await runMigrations(sql);
  console.log(`Created ${tables.length} tables:`);
  tables.forEach((t) => console.log(`  - ${t}`));
  console.log("Done.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
