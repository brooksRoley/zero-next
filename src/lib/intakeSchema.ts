import { sql } from 'src/lib/db'

// Intake messages live in Neon, next to `leads`, where only the server can
// reach them. They used to target a Supabase table that was never created, so
// every Contact-page message failed (and the anon key would have had to read
// it). Created once per cold start, like ensureEventsSchema.
let schemaReady = false

export async function ensureIntakeSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS intake_messages (
      id SERIAL PRIMARY KEY,
      visitor_id UUID NOT NULL,
      visitor_name TEXT,
      type TEXT NOT NULL,
      content TEXT,
      audio_url TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      parent_id INTEGER REFERENCES intake_messages (id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS intake_messages_visitor_idx ON intake_messages (visitor_id)`
  await sql`CREATE INDEX IF NOT EXISTS intake_messages_parent_idx ON intake_messages (parent_id)`
  schemaReady = true
}
