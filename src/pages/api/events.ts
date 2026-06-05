import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

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

// Create the table once per cold start rather than on every request.
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      session_id TEXT,
      page TEXT,
      event_type TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { session_id, page, event_type, metadata } = req.body || {};

  if (typeof event_type !== "string" || event_type.trim().length === 0) {
    return res.status(400).json({ error: "event_type is required" });
  }

  try {
    await ensureSchema();
    await sql`
      INSERT INTO events (session_id, page, event_type, metadata)
      VALUES (
        ${typeof session_id === "string" ? session_id : null},
        ${typeof page === "string" ? page : null},
        ${event_type.trim().slice(0, 64)},
        ${metadata && typeof metadata === "object" ? JSON.stringify(metadata) : null}
      )
    `;
    return res.status(202).json({ success: true });
  } catch (e: unknown) {
    return res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
