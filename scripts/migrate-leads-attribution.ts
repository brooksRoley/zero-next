import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

function loadPostgresUrl(): string {
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*POSTGRES_URL\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("POSTGRES_URL not found");
}

async function main() {
  const sql = neon(loadPostgresUrl());
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT`;
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('utm_source','utm_medium','utm_campaign','referrer') ORDER BY column_name`;
  console.log("Attribution columns present:", cols.map((c: any) => c.column_name).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); });
