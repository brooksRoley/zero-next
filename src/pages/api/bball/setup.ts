/**
 * One-time setup: creates bball tables in Neon Postgres.
 * GET /api/bball/setup — run once after deploy.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { applyBballCors } from "src/lib/bballCors";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;
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

  res.status(200).json({ ok: true, message: "bball tables ready" });
}
