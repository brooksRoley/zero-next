import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, company, project_type, budget_range, timeline, message, source } =
    req.body;

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const lead = (
    await sql`
    INSERT INTO leads (name, email, company, project_type, budget_range, timeline, message, source)
    VALUES (
      ${name.trim()},
      ${email.trim().toLowerCase()},
      ${company?.trim() || null},
      ${project_type || null},
      ${budget_range || null},
      ${timeline?.trim() || null},
      ${message?.trim() || null},
      ${source || "consulting_page"}
    )
    RETURNING id, created_at
  `
  )[0];

  res.status(201).json({ success: true, id: lead.id });
}
