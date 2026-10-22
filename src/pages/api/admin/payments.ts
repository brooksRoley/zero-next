import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";
import { safeEqual } from "src/lib/safeEqual";

// Backs the private /funding page: a working example of taking money, kept
// off the public site until there is something to sell. GET reports how
// Stripe is configured and the latest Checkout Sessions (Stripe's view next to
// our checkout_sessions row, so a webhook that never fired is visible). POST
// opens a Checkout Session for one demo item — test mode only, so no click
// here can charge a real card.

function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  return safeEqual(req.cookies?.tracker_session, expected) || isValidAdminKey(req);
}

// Server-side prices; the client only names an item.
export const DEMO_ITEMS: Record<string, { amount_cents: number; name: string }> = {
  tip_5: { amount_cents: 500, name: "Tip — buy a coffee" },
  tip_10: { amount_cents: 1000, name: "Tip — send a snack" },
  tip_25: { amount_cents: 2500, name: "Tip — cover a server bill" },
  strategy_session: { amount_cents: 15000, name: "Strategy session deposit" },
};

type Mode = "test" | "live" | "missing";

export function keyMode(key: string | undefined): Mode {
  if (!key || key.includes("REPLACE")) return "missing";
  return /^(sk|rk)_live_/.test(key) ? "live" : "test";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const mode = keyMode(secretKey);

  if (req.method === "GET") {
    const config = {
      mode,
      webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      saved_prices: {
        strategy_session: !!process.env.STRIPE_PRICE_STRATEGY,
        dev_sprint: !!process.env.STRIPE_PRICE_SPRINT,
        fractional_cto: !!process.env.STRIPE_PRICE_FRACTIONAL,
      },
    };
    if (mode === "missing") {
      return res.status(200).json({ config, sessions: [] });
    }

    const stripe = new Stripe(secretKey as string);
    const list = await stripe.checkout.sessions.list({ limit: 10 });

    // Our row's status, which only the webhook moves from pending to paid.
    let recorded: Record<string, string> = {};
    try {
      const ids = list.data.map((s) => s.id);
      const rows = (await sql`
        SELECT stripe_session_id, status FROM checkout_sessions
        WHERE stripe_session_id = ANY(${ids})
      `) as { stripe_session_id: string; status: string }[];
      recorded = Object.fromEntries(rows.map((r) => [r.stripe_session_id, r.status]));
    } catch {
      // No database (e.g. local dev without DATABASE_URL): show Stripe's side alone.
    }

    const sessions = list.data.map((s) => ({
      id: s.id,
      created: s.created,
      amount_total: s.amount_total,
      currency: s.currency,
      item: s.metadata?.service_type ?? null,
      status: s.status,
      payment_status: s.payment_status,
      recorded_status: recorded[s.id] ?? null,
    }));
    return res.status(200).json({ config, sessions });
  }

  if (req.method === "POST") {
    if (mode === "missing") {
      return res.status(503).json({ error: "Stripe is not configured yet" });
    }
    if (mode === "live") {
      return res.status(409).json({ error: "The payments demo runs on test keys only" });
    }

    const item = DEMO_ITEMS[req.body?.item as string];
    if (!item) {
      return res.status(400).json({ error: `Unknown item: ${req.body?.item}` });
    }

    const stripe = new Stripe(secretKey as string);
    const origin = req.headers.origin || "http://localhost:3000";
    const service_type = `demo_${req.body.item}`;

    // No payment_method_types: Checkout offers every method enabled in the
    // Dashboard (cards, Link, Apple Pay, …), which is what this page shows.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: item.name },
            unit_amount: item.amount_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/funding?session=success`,
      cancel_url: `${origin}/funding?session=cancelled`,
      metadata: { service_type },
    });

    try {
      await sql`
        INSERT INTO checkout_sessions (stripe_session_id, lead_id, amount_cents, service_type)
        VALUES (${session.id}, ${null}, ${item.amount_cents}, ${service_type})
      `;
    } catch {
      // Checkout still works without the row; the page shows it as unrecorded.
    }

    return res.status(200).json({ url: session.url });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
