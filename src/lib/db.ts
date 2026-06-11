import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Matches what `neon(url)` returns with default options, so route code sees
// the same row types as before the lazy wrapper.
type SqlClient = NeonQueryFunction<false, false>;

let client: SqlClient | null = null;

/**
 * Resolves the Neon client lazily so a missing POSTGRES_URL fails the
 * individual request (the route's catch → 5xx) instead of crashing every
 * API route at import time — preview/CI deployments without the env var
 * stay up. Mirrors the null-guard pattern in src/lib/supabase.ts.
 */
export function requireSql(): SqlClient {
  if (!client) {
    if (!process.env.POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not configured");
    }
    client = neon(process.env.POSTGRES_URL);
  }
  return client;
}

// Drop-in lazy wrapper: existing routes keep calling `sql` as a tagged
// template, but the client (and the env-var check) isn't touched until the
// first actual query.
export const sql: SqlClient = new Proxy((() => {}) as unknown as SqlClient, {
  apply(_target, _thisArg, args) {
    return Reflect.apply(
      requireSql() as unknown as (...a: unknown[]) => unknown,
      undefined,
      args
    );
  },
  get(_target, prop) {
    const real = requireSql() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
