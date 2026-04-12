import type { NextApiRequest, NextApiResponse } from "next";

// Consulting route temporarily disabled. Webhook stubbed to a no-op so the
// consulting-funnel is inert without dropping the file (Stripe wiring stays
// available for when we re-enable the route).
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(503).json({ error: "Consulting disabled" });
}
