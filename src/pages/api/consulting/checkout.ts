import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { sql } from "src/lib/db";
import { createRateLimiter } from "src/lib/rate-limit";

const limiter = createRateLimiter(10, 60 * 60 * 1000); // 10 per hour

// Server-side source of truth for consulting prices. Never trust client-supplied
// amounts — a malicious POST with $0.01 would otherwise produce a valid session.
const PRICE_MAP: Record<string, number> = {
  strategy_session: 15000,
  dev_sprint: 240000,
  fractional_cto: 400000,
};

// Once the three Products exist in the Stripe Dashboard, set these env vars to
// the saved Price IDs (e.g. price_1Abc...). When present, checkout uses the
// saved Price (cleaner reporting + Stripe Tax support) instead of ad-hoc
// price_data. Until then, every value is undefined and we fall back to the
// inline price_data below — so behavior is identical with no env vars set.
// See CLAUDE.md → "Stripe — Shipping Checklist", step 1.
const PRICE_ID_MAP: Record<string, string | undefined> = {
  strategy_session: process.env.STRIPE_PRICE_STRATEGY,
  dev_sprint: process.env.STRIPE_PRICE_SPRINT,
  fractional_cto: process.env.STRIPE_PRICE_FRACTIONAL,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = limiter.getClientIp(req);
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.includes("REPLACE")) {
    return res.status(503).json({ error: "Stripe is not configured yet" });
  }

  const stripe = new Stripe(secretKey);

  const { service_type, lead_id, customer_email } = req.body;

  if (!service_type) {
    return res.status(400).json({ error: "service_type is required" });
  }

  const amount_cents = PRICE_MAP[service_type as string];
  if (!amount_cents) {
    return res.status(400).json({ error: `Unknown service_type: ${service_type}` });
  }

  const origin = req.headers.origin || "http://localhost:3000";

  // Prefer a saved Stripe Price ID when configured; otherwise fall back to
  // ad-hoc price_data so checkout keeps working before the Products exist.
  const priceId = PRICE_ID_MAP[service_type as string];
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: "usd" as const,
          product_data: {
            name: `Consulting — ${service_type}`,
            description: "Zero Paradox LLC consulting engagement deposit",
          },
          unit_amount: amount_cents,
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer_email || undefined,
    line_items: [lineItem],
    success_url: `${origin}/consulting?session=success`,
    cancel_url: `${origin}/consulting?session=cancelled`,
    metadata: {
      service_type,
      lead_id: lead_id?.toString() || "",
    },
  });

  // Track the session in our DB
  await sql`
    INSERT INTO checkout_sessions (stripe_session_id, lead_id, amount_cents, service_type)
    VALUES (${session.id}, ${lead_id || null}, ${amount_cents}, ${service_type})
  `;

  res.status(200).json({ url: session.url });
}
