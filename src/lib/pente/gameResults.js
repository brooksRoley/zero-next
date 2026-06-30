/**
 * Fire-and-forget client helper to persist a completed Pente game to the
 * game_results table via POST /api/pente/game-result.
 *
 * Best-effort by design: it never throws and never blocks the UI, and the route
 * silently no-ops (returns { supported: false }) until migration 0004 provisions
 * the table. Game logging must never break play.
 *
 * @param {{
 *   player_id: string,
 *   opponent_id?: string | null,
 *   opponent_type?: 'bot' | 'human',
 *   bot_level?: string | null,
 *   game_mode?: string | null,
 *   winner?: string | null,
 *   elo_before?: number | null,
 *   elo_after?: number | null,
 *   moves?: unknown[],
 * }} payload
 */
export function logGameResult(payload) {
  if (typeof window === 'undefined' || !payload?.player_id) return
  try {
    fetch('/api/pente/game-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* best-effort — game logging must never break play */
    })
  } catch {
    /* ignore (e.g. serialization failure) */
  }
}
