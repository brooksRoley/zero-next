/**
 * Admin endpoint: run NBA database migrations.
 * GET /api/nba/admin/setup
 * Protected by x-admin-key header.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { runMigrations } from "src/lib/nba/db/migrate";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const tables = await runMigrations(sql);
    res.status(200).json({ ok: true, tables });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Migration failed";
    res.status(500).json({ error: msg });
  }
}
