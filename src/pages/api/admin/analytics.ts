import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

// The /admin/analytics page is gated by src/middleware.ts via the
// tracker_session cookie; this API checks the same cookie so the page can
// fetch without re-entering a token.
function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  if (!expected) return false;
  return req.cookies?.tracker_session === expected;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ADMIN_SESSION_TOKEN) {
    return res.status(503).json({
      error: "Admin access is not configured (missing ADMIN_SESSION_TOKEN).",
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [pageViews, leadCounts] = await Promise.all([
      sql`
        SELECT
          COALESCE(page, metadata->>'path', '(unknown)') AS path,
          COUNT(*)::int AS views,
          COUNT(DISTINCT session_id)::int AS sessions
        FROM events
        WHERE event_type = 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY views DESC
      `,
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS last_30_days
        FROM leads
      `,
    ]);

    return res.status(200).json({
      pageViews,
      leads: leadCounts[0] ?? { total: 0, last_30_days: 0 },
      _meta: { windowDays: 30 },
    });
  } catch (e: unknown) {
    return res
      .status(503)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
