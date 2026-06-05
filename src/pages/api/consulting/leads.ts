import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { createRateLimiter } from "src/lib/rate-limit";

const limiter = createRateLimiter(5, 60 * 60 * 1000); // 5 per hour

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    email,
    company,
    project_type,
    budget_range,
    timeline,
    message,
    source,
    website, // honeypot — humans never see this field
  } = req.body;

  // Bots fill every input; humans don't see the hidden field. Silently 200 so
  // the bot believes it succeeded and doesn't retry.
  if (typeof website === "string" && website.trim().length > 0) {
    return res.status(200).json({ success: true });
  }

  const ip = limiter.getClientIp(req);
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

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
