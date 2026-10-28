import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";

// Public uptime check: says only whether Postgres answered. The server time and
// version string are for the owner (x-admin-key) — a version string tells an
// attacker which CVEs to try, and a raw driver error can leak connection details.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const detailed = isValidAdminKey(req);
  try {
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    if (!detailed) return res.status(200).json({ status: "connected" });
    return res.status(200).json({
      status: "connected",
      time: result[0].current_time,
      version: result[0].pg_version,
    });
  } catch (error: unknown) {
    if (!detailed) return res.status(503).json({ status: "error" });
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(503).json({ status: "error", message });
  }
}
