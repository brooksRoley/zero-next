import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

// The /admin/analytics page is gated by src/proxy.ts via the
// tracker_session cookie; this API checks the same cookie so the page can
// fetch without re-entering a token.
function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  if (!expected) return false;
  return req.cookies?.tracker_session === expected;
}

// Surfaced first and always shown (even at zero) because they map directly to
// monetization decisions — e.g. premium_interest is the Daily Challenge's
// "is the premium puzzle tier worth building?" signal, which was firing but
// completely dark before this dashboard read it.
const PRIORITY_EVENTS = [
  "premium_interest",
  "lead_submit",
  "daily_challenge_completed",
] as const;

type EventTotalRow = { event_type: string; count: number; sessions: number };

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
    const [pageViews, leadCounts, eventTotalsRaw, eventsByPage, funnelRows] = await Promise.all([
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
      // Every tracked interaction except page_view (shown separately above).
      sql`
        SELECT
          event_type,
          COUNT(*)::int AS count,
          COUNT(DISTINCT session_id)::int AS sessions
        FROM events
        WHERE event_type <> 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
      `,
      // Same window, broken out by the page each event fired on.
      sql`
        SELECT
          event_type,
          COALESCE(page, '(unknown)') AS page,
          COUNT(*)::int AS count
        FROM events
        WHERE event_type <> 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type, page
        ORDER BY event_type ASC, count DESC
      `,
      // Consulting funnel, one row of distinct-session counts per step.
      // page_view is scoped to the consulting page ('/consulting' from the
      // global _app tracker; the page's own funnel events use page 'consulting');
      // the later steps only ever fire from the consulting funnel.
      sql`
        SELECT
          COUNT(DISTINCT session_id) FILTER (
            WHERE event_type = 'page_view'
              AND COALESCE(page, metadata->>'path') IN ('/consulting', 'consulting')
          )::int AS page_view,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'section_view')::int AS section_view,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'lead_form_submit')::int AS lead_form_submit,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'lead_submit')::int AS lead_submit
        FROM events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `,
    ]);

    // Guarantee the monetization-signal events appear even at zero, then float
    // them to the top so they're the first thing read.
    const totals = eventTotalsRaw as EventTotalRow[];
    const seen = new Map(totals.map((r) => [r.event_type, r]));
    for (const name of PRIORITY_EVENTS) {
      if (!seen.has(name)) {
        const row = { event_type: name, count: 0, sessions: 0 };
        seen.set(name, row);
        totals.push(row);
      }
    }
    const priorityRank = (t: string) => {
      const i = PRIORITY_EVENTS.indexOf(t as (typeof PRIORITY_EVENTS)[number]);
      return i === -1 ? PRIORITY_EVENTS.length : i;
    };
    const events = totals.sort((a, b) => {
      const pr = priorityRank(a.event_type) - priorityRank(b.event_type);
      return pr !== 0 ? pr : b.count - a.count;
    });

    const funnelRow =
      (funnelRows as Array<Record<string, number>>)[0] ?? {};
    const funnel = [
      { step: "page_view", label: "Consulting page view", sessions: funnelRow.page_view ?? 0 },
      { step: "section_view", label: "Scrolled to FAQ", sessions: funnelRow.section_view ?? 0 },
      { step: "lead_form_submit", label: "Submitted form", sessions: funnelRow.lead_form_submit ?? 0 },
      { step: "lead_submit", label: "Lead captured", sessions: funnelRow.lead_submit ?? 0 },
    ];

    return res.status(200).json({
      pageViews,
      leads: leadCounts[0] ?? { total: 0, last_30_days: 0 },
      events,
      eventsByPage,
      funnel,
      priorityEvents: PRIORITY_EVENTS,
      _meta: { windowDays: 30 },
    });
  } catch (e: unknown) {
    return res
      .status(503)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
