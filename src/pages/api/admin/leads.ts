import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";

// Pipeline stages a lead can move through (mirrors CLAUDE.md spec).
const ALLOWED_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "closed",
] as const;
type LeadStatus = (typeof ALLOWED_STATUSES)[number];

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

  if (req.method === "GET") {
    const leads = await sql`
      SELECT id, name, email, company, project_type, budget_range,
             timeline, message, source, status, created_at
      FROM leads
      ORDER BY created_at DESC
    `;

    // Lead-source rollup so /admin/leads can show which channels actually
    // produce leads (UTM attribution has been collected but never surfaced).
    // Single pass for the headline counts; a second grouped query for sources.
    const totals = (
      await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(budget_range)::int AS with_budget,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '7 days'
          )::int AS last_7,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '14 days'
              AND created_at < NOW() - INTERVAL '7 days'
          )::int AS prior_7
        FROM leads
      `
    )[0];

    const total = Number(totals?.total ?? 0);
    const withBudget = Number(totals?.with_budget ?? 0);

    // Leads with no utm_source are organic/direct (typed URL, bookmark, etc.).
    const sourceRows = await sql`
      SELECT
        COALESCE(NULLIF(TRIM(utm_source), ''), 'direct') AS source,
        COUNT(*)::int AS count
      FROM leads
      GROUP BY 1
      ORDER BY count DESC, source ASC
      LIMIT 5
    `;

    const topSources = sourceRows.map((r) => ({
      source: r.source as string,
      count: Number(r.count),
      percent: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
    }));

    const summary = {
      total,
      withBudget,
      withoutBudget: total - withBudget,
      last7: Number(totals?.last_7 ?? 0),
      prior7: Number(totals?.prior_7 ?? 0),
      topSources,
    };

    return res.status(200).json({ leads, summary });
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    if (!ALLOWED_STATUSES.includes(status as LeadStatus)) {
      return res.status(400).json({
        error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    const updated = (
      await sql`
        UPDATE leads
        SET status = ${status}
        WHERE id = ${id}
        RETURNING id, status
      `
    )[0];

    if (!updated) {
      return res.status(404).json({ error: "Lead not found" });
    }

    return res.status(200).json({ success: true, lead: updated });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
