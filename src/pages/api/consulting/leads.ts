import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { createRateLimiter } from "src/lib/rate-limit";

const limiter = createRateLimiter(5, 60 * 60 * 1000); // 5 per hour

type LeadNotice = {
  name: string;
  email: string;
  company?: string | null;
  project_type?: string | null;
  budget_range?: string | null;
  timeline?: string | null;
  message?: string | null;
};

// Best-effort owner notification for a new lead. Calls the Resend REST API
// directly (no SDK dependency) so this route stays dependency-free and starts
// working the moment RESEND_API_KEY is present. Sends from Resend's shared
// onboarding sender, which can deliver to the account owner's own inbox with no
// domain verification. Never throws — a delivery failure must not turn a
// successfully captured lead into an error.
//
// To enable: set RESEND_API_KEY (Vercel → Settings → Environment Variables, and
// .env.local for dev). Without it this is a silent no-op.
async function notifyNewLead(lead: LeadNotice): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) return; // not configured — no-op

  const lines = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.company ? `Company: ${lead.company}` : null,
    lead.project_type ? `Project type: ${lead.project_type}` : null,
    lead.budget_range ? `Budget: ${lead.budget_range}` : null,
    lead.timeline ? `Timeline: ${lead.timeline}` : null,
    "",
    "Message:",
    lead.message || "(none provided)",
  ].filter((line): line is string => line !== null);

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Consulting Leads <onboarding@resend.dev>",
      to: ["brooksroley@gmail.com"],
      reply_to: lead.email,
      subject: `New consulting lead — ${lead.name}`,
      text: lines.join("\n"),
    }),
  });
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
    utm_source,
    utm_medium,
    utm_campaign,
    website, // honeypot — humans never see this field
  } = req.body;

  // Server-side attribution: the Referer header is set by the browser and can't
  // be spoofed from the form payload. Truncated to fit a reasonable column size.
  const referer = req.headers.referer;
  const referrer =
    typeof referer === "string" && referer.trim().length > 0
      ? referer.trim().slice(0, 500)
      : null;

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
    INSERT INTO leads (name, email, company, project_type, budget_range, timeline, message, source, utm_source, utm_medium, utm_campaign, referrer)
    VALUES (
      ${name.trim()},
      ${email.trim().toLowerCase()},
      ${company?.trim() || null},
      ${project_type || null},
      ${budget_range || null},
      ${timeline?.trim() || null},
      ${message?.trim() || null},
      ${source || "consulting_page"},
      ${utm_source?.trim() || null},
      ${utm_medium?.trim() || null},
      ${utm_campaign?.trim() || null},
      ${referrer}
    )
    RETURNING id, created_at
  `
  )[0];

  // Surface the lead to the owner's inbox. Awaited so it completes before the
  // serverless function freezes, but wrapped so a delivery failure never turns
  // an already-persisted lead into a 500.
  try {
    await notifyNewLead({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      project_type: project_type || null,
      budget_range: budget_range || null,
      timeline: timeline?.trim() || null,
      message: message?.trim() || null,
    });
  } catch {
    // Best-effort — the lead is already safely persisted.
  }

  res.status(201).json({ success: true, id: lead.id });
}
