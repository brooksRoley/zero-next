import type { NextApiRequest, NextApiResponse } from "next";

/**
 * CORS for the BballTactics browser client, which calls these endpoints
 * cross-origin (Vite dev on :5173, GitHub Pages in prod). No credentials are
 * used, so a wildcard origin is safe.
 *
 * @returns true when the request was an OPTIONS preflight and has been
 * answered — the caller should stop processing.
 */
export function applyBballCors(req: NextApiRequest, res: NextApiResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
