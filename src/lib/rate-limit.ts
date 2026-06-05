import type { NextApiRequest } from "next";

// Shared in-memory per-IP rate limiter for API routes.
//
// State resets on cold start and is per-instance on Vercel; that's intentional
// — good-enough defense against casual spam/abuse without adding Redis. For
// stronger guarantees, swap in a KV store later.
//
// Usage:
//   const limiter = createRateLimiter(30, 60 * 60 * 1000);
//   const ip = limiter.getClientIp(req);
//   if (limiter.isRateLimited(ip)) return res.status(429).json(...);

export function getClientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export interface RateLimiter {
  isRateLimited(ip: string): boolean;
  getClientIp(req: NextApiRequest): string;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  // Each limiter owns its own per-IP timestamp log so different routes don't
  // share each other's request budgets.
  const ipHits = new Map<string, number[]>();

  function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (ipHits.get(ip) || []).filter((t) => t > cutoff);
    if (hits.length >= max) {
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

  return { isRateLimited, getClientIp };
}
