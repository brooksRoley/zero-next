// True when a Postgres error is "undefined_table" (SQLSTATE 42P01) — the queried
// table has not been provisioned in this environment yet. This happens when the
// TFT tables exist in a Preview branch DB but the setup/backtest/activate scripts
// were never run against production Neon, so the live query throws instead of
// returning rows. Neon surfaces the SQLSTATE on `.code`; we also match the
// message text as a fallback in case the error arrives wrapped.
export function isMissingTable(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "code" in e) {
    if ((e as { code?: unknown }).code === "42P01") return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /relation .* does not exist/i.test(msg);
}
