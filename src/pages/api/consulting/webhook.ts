import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { sql } from "src/lib/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || secretKey.includes("REPLACE")) {
    return res.status(503).json({ error: "Stripe is not configured yet" });
  }
  if (!webhookSecret) {
    return res.status(503).json({ error: "Stripe webhook secret is not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  const stripe = new Stripe(secretKey);
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return res.status(400).json({ error: `Webhook verification failed: ${message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string };
    await sql`
      UPDATE checkout_sessions
      SET status = 'paid'
      WHERE stripe_session_id = ${session.id}
        AND status = 'pending'
    `;
  }

  return res.status(200).json({ received: true });
}
