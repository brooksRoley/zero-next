/**
 * Run NBA data migrations directly against Neon.
 * Usage: npx tsx scripts/migrate.ts
 * Requires POSTGRES_URL env var.
 */
import { neon } from "@neondatabase/serverless";
import { runMigrations } from "../src/lib/nba/db/migrate";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL not set. Run: export POSTGRES_URL=<your-neon-url>");
    process.exit(1);
  }

  const sql = neon(url);
  console.log("Running NBA data migrations...");

  try {
    const tables = await runMigrations(sql);
    console.log(`Created ${tables.length} tables:`);
    tables.forEach((t) => console.log(`  ✓ ${t}`));
    console.log("\nMigration complete.");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
}

main();
