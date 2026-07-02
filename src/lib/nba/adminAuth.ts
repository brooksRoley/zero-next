import type { NextApiRequest } from "next";

// Shared admin/cron auth checks for NBA admin endpoints. Both require the
// server-side secret to be a non-empty string — if ADMIN_KEY or CRON_SECRET
// is unset, a request presenting no header would otherwise compare
// `undefined === undefined` and be treated as authorized. Always deny when
// the secret itself isn't configured.

// For endpoints that accept either Vercel Cron (CRON_SECRET) or a manual
// x-admin-key call: ingest, settle.
export function isAuthorizedAdminRequest(req: NextApiRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = !!cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;

  return isVercelCron || isValidAdminKey(req);
}

// For endpoints that accept only a manual x-admin-key call: simulate, setup.
export function isValidAdminKey(req: NextApiRequest): boolean {
  const adminKey = process.env.ADMIN_KEY;
  return !!adminKey && req.headers["x-admin-key"] === adminKey;
}
