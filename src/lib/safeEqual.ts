// Constant-time string comparison for secrets (admin key, session token,
// password). Plain `===` returns at the first differing character, which leaks
// how much of a guess was right. Pure JS (no node:crypto) so it also runs in
// src/proxy.ts. The loop covers the longer input, so timing does not reveal
// where the strings diverge; length alone is folded into the result.
export function safeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
