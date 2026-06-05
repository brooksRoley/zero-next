import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { sql } from "src/lib/db";

// Pipeline stages a lead can move through (mirrors CLAUDE.md spec).
const ALLOWED_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "closed",
] as const;
type LeadStatus = (typeof ALLOWED_STATUSES)[number];

// Constant-time token check so we don't leak length/prefix via timing.
function tokenMatches(provided: string, expected: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // handled separately as 503
  const header = req.headers["x-admin-token"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (typeof provided !== "string" || provided.length === 0) return false;
  return tokenMatches(provided, expected);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.ADMIN_TOKEN) {
    return res
      .status(503)
      .json({ error: "Admin access is not configured (missing ADMIN_TOKEN)." });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const leads = await sql`
      SELECT id, name, email, company, project_type, budget_range,
             timeline, message, source, status, created_at
      FROM leads
      ORDER BY created_at DESC
    `;
    return res.status(200).json({ leads });
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
