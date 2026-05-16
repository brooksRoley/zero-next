import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory per-IP timestamp log. Resets on cold start and is per-instance on
// Vercel; that's intentional — good-enough defense against casual spam without
// adding Redis. For stronger guarantees, swap in a KV store later.
const ipHits = new Map<string, number[]>();

function getClientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (ipHits.get(ip) || []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  // Opportunistic cleanup so the Map doesn't grow unbounded across cold-warm cycles.
  if (ipHits.size > 1000) {
    ipHits.forEach((ts: number[], k: string) => {
      const pruned = ts.filter((t) => t > cutoff);
      if (pruned.length === 0) ipHits.delete(k);
      else ipHits.set(k, pruned);
    });
  }
  return false;
}

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

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
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
