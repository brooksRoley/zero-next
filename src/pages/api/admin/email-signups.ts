import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.ADMIN_KEY) {
    return res
      .status(503)
      .json({ error: "Admin access is not configured (missing ADMIN_KEY)." });
  }

  if (!isValidAdminKey(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signups = await sql`
    SELECT id, email, source, created_at
    FROM email_signups
    ORDER BY created_at DESC
  `;

  const bySourceRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(source), ''), 'unknown') AS source,
      COUNT(*)::int AS count
    FROM email_signups
    GROUP BY 1
    ORDER BY count DESC, source ASC
  `;

  const totals = (
    await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS last_7,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '14 days'
            AND created_at < NOW() - INTERVAL '7 days'
        )::int AS prior_7
      FROM email_signups
    `
  )[0];

  const summary = {
    total: Number(totals?.total ?? 0),
    last7: Number(totals?.last_7 ?? 0),
    prior7: Number(totals?.prior_7 ?? 0),
    bySource: bySourceRows.map((r) => ({
      source: r.source as string,
      count: Number(r.count),
    })),
  };

  return res.status(200).json({ signups, summary });
}
