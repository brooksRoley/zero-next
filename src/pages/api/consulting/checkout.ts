import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { sql } from "src/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.includes("REPLACE")) {
    return res.status(503).json({ error: "Stripe is not configured yet" });
  }

  const stripe = new Stripe(secretKey);

  const { service_type, amount_cents, lead_id, customer_email } = req.body;

  if (!service_type || !amount_cents) {
    return res.status(400).json({ error: "service_type and amount_cents are required" });
  }

  const origin = req.headers.origin || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer_email || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Consulting — ${service_type}`,
            description: "Zero Paradox LLC consulting engagement deposit",
          },
          unit_amount: amount_cents,
        },
        quantity: 1,
      },
    ],
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
