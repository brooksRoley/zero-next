/**
 * One-time setup: creates bball tables in Neon Postgres.
 * GET or POST /api/bball/setup with x-admin-key — run once after deploy.
 *
 * Admin-only. This was previously unauthenticated: any caller could trigger
 * DDL plus a DELETE ... USING self-join against production Neon, as often as
 * they liked. The DDL is idempotent and the DELETE is a dedup that the unique
 * index below makes a no-op in steady state, so the exposure was database load
 * rather than data loss — but CLAUDE.md requires the shared x-admin-key check
 * on admin endpoints, and every sibling under bball/admin already had it.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { applyBballCors } from "src/lib/bballCors";
import { isValidAdminKey } from "src/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;

  // Preflight is answered above; everything past here is a real invocation.
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // isValidAdminKey (not isAuthorizedAdminRequest) — this is a manual
  // post-deploy step, not a cron target, matching simulate/setup elsewhere.
  if (!isValidAdminKey(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS bball_runs (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      current_round INT NOT NULL DEFAULT 1,
      health INT NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bball_board_states (
      id SERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      round_number INT NOT NULL,
      board_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // One board per run per round: dedupe any legacy duplicates (keep newest),
  // then enforce it so submit-and-fetch can upsert on conflict.
  await sql`
    DELETE FROM bball_board_states a
    USING bball_board_states b
    WHERE a.run_id = b.run_id
      AND a.round_number = b.round_number
      AND a.id < b.id
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS bball_board_states_run_round_idx
    ON bball_board_states (run_id, round_number)
  `;

  // Canonical game roster, regenerated from real NBA data by
  // /api/bball/admin/refresh-roster. Ids are ESPN athlete ids.
  await sql`
    CREATE TABLE IF NOT EXISTS bball_roster (
      id INT PRIMARY KEY,
      name TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT '',
      cost INT NOT NULL,
      shooting INT NOT NULL,
      speed INT NOT NULL,
      defense INT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      injury_status TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  res.status(200).json({ ok: true, message: "bball tables ready" });
}
