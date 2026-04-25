/**
 * Simple in-memory cache with TTL for serverless API routes.
 * Module-level state persists across warm invocations on Vercel.
 */

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 600
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && now - entry.ts < ttlSeconds * 1000) {
    return entry.data;
  }
  const data = await fn();
  store.set(key, { data, ts: now });
  return data;
}
