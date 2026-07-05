/**
 * Admin endpoint: run NBA database migrations.
 * GET /api/nba/admin/setup
 * Protected by x-admin-key header.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { runMigrations } from "src/lib/nba/db/migrate";
import { isValidAdminKey } from "src/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isValidAdminKey(req)) {
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
