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

// Create the tables once per cold start rather than on every request.
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
  // Deduped, queryable mailing list — kept separate from the noisy events log so
  // captured emails are easy to export and each address only lands once.
  await sql`
    CREATE TABLE IF NOT EXISTS email_signups (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort owner notification when a new email lands. Calls the Resend REST
// API directly (no SDK) so this route stays dependency-free, mirroring
// api/consulting/leads.ts. No-op until RESEND_API_KEY is set. Never throws.
async function notifyNewSignup(email: string, source: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) return; // not configured — no-op

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Site Signups <onboarding@resend.dev>",
      to: ["brooksroley@gmail.com"],
      reply_to: email,
      subject: `New email signup — ${source}`,
      text: `Email: ${email}\nSource: ${source}\nCaptured: ${new Date().toISOString()}`,
    }),
  });
}

// Funnel a captured email into the dedicated mailing list and notify the owner.
// Only fires the Resend email on a genuinely new address (ON CONFLICT DO NOTHING
// returns no row for duplicates), so re-triggering the gate never spams the
// inbox. Best-effort: any failure here must not turn the event-log write into an
// error for the visitor.
async function handleEmailSignup(rawEmail: unknown, source: string): Promise<void> {
  if (typeof rawEmail !== "string") return;
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return;

  const inserted = await sql`
    INSERT INTO email_signups (email, source)
    VALUES (${email}, ${source})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;

  if (inserted.length > 0) {
    try {
      await notifyNewSignup(email, source);
    } catch {
      // Best-effort — the signup is already safely persisted.
    }
  }
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

    // Email-gate captures get promoted to the dedicated mailing list and pinged
    // to the owner. Awaited so it completes before the function freezes, but
    // wrapped so a delivery/insert hiccup never fails the already-logged event.
    if (
      event_type.trim() === "model_arena_email_gate" &&
      metadata &&
      typeof metadata === "object"
    ) {
      try {
        await handleEmailSignup((metadata as { email?: unknown }).email, "model_arena");
      } catch {
        // Best-effort — the raw event is already recorded above.
      }
    }

    return res.status(202).json({ success: true });
  } catch (e: unknown) {
    return res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
