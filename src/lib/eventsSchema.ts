import { sql } from 'src/lib/db'

// Create and migrate the analytics tables once per cold start rather than on
// every request. Shared by the ingest route (/api/events) and the admin
// dashboard, so the dashboard can query the newest columns even on a
// deployment that has not received an event yet.
let schemaReady = false

export async function ensureEventsSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      session_id TEXT,
      page TEXT,
      event_type TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Durable cross-session visitor id (localStorage-backed, unlike the per-tab
  // session_id). Self-migrating for deployments whose events table predates it.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS anon_id TEXT`
  // Visitor context (see src/lib/visitorContext.ts). Rows written before
  // 2026-10-07 have these as NULL.
  await sql`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS referrer TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS region TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS device TEXT,
      ADD COLUMN IF NOT EXISTS browser TEXT,
      ADD COLUMN IF NOT EXISTS os TEXT
  `
  await sql`CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at)`
  // Deduped, queryable mailing list — kept separate from the noisy events log so
  // captured emails are easy to export and each address only lands once.
  await sql`
    CREATE TABLE IF NOT EXISTS email_signups (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  schemaReady = true
}
