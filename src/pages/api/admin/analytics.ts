import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { supabase } from "src/lib/supabase";
import { isValidAdminKey } from "src/lib/adminAuth";

// The /admin/analytics page is gated by src/proxy.ts via the
// tracker_session cookie, so browser requests are checked against that same
// cookie here. Also accepts the shared x-admin-key header (same pattern as
// /api/admin/leads) so non-browser sessions — this routine's own CFO/CTO/
// Data-Sci audits included — can read unit-economics data without a browser
// session, instead of estimating cost/engagement off rate-limit ceilings.
function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.ADMIN_SESSION_TOKEN;
  const cookieOk = !!expected && req.cookies?.tracker_session === expected;
  return cookieOk || isValidAdminKey(req);
}

// Surfaced first and always shown (even at zero) because they map directly to
// monetization decisions — e.g. premium_interest is the Daily Challenge's
// "is the premium puzzle tier worth building?" signal, which was firing but
// completely dark before this dashboard read it.
const PRIORITY_EVENTS = [
  "premium_interest",
  "lead_submit",
  "daily_challenge_completed",
] as const;

type EventTotalRow = { event_type: string; count: number; sessions: number };

type SupabaseStats = {
  puzzleBank: { count: number; avgRating: number | null };
  puzzleAttempts: { total: number; solved: number };
  gameResults: { total: number; byOpponentType: { bot: number; human: number } };
  players: { count: number; avgGameElo: number | null };
  go: {
    players: { count: number; avgElo: number | null };
    puzzleAttempts: { total: number; solved: number };
  };
};

// Read-only aggregate stats from the Supabase game database (Pente/Go live
// there, not in Neon — see CLAUDE.md). Returns null when Supabase isn't
// configured (preview/CI, where `supabase` is null) and degrades to zero/null
// per section if a table is unmigrated or a query errors, so a game-side gap
// never takes down the Neon-backed business analytics above.
async function readSupabaseStats(): Promise<SupabaseStats | null> {
  if (!supabase) return null;
  const db = supabase;

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  // Count without transferring rows (head + exact count).
  const countAll = async (table: string): Promise<number> => {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  };
  const countEq = async (
    table: string,
    column: string,
    value: string | boolean
  ): Promise<number> => {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw error;
    return count ?? 0;
  };
  // Average a numeric column in JS (these game tables are small; PostgREST
  // aggregate functions aren't enabled by default so we don't rely on them).
  const avgColumn = async (
    table: string,
    column: string
  ): Promise<number | null> => {
    const { data, error } = await db.from(table).select(column);
    if (error) throw error;
    const nums = (data ?? [])
      .map((row) => Number((row as unknown as Record<string, unknown>)[column]))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    const mean = nums.reduce((sum, n) => sum + n, 0) / nums.length;
    return Math.round(mean * 10) / 10;
  };

  const [
    puzzleCount,
    avgRating,
    attemptsTotal,
    attemptsSolved,
    gameResultsTotal,
    botGames,
    humanGames,
    playerCount,
    avgGameElo,
    goPlayerCount,
    avgGoElo,
    goAttemptsTotal,
    goAttemptsSolved,
  ] = await Promise.all([
    safe(() => countAll("puzzle_bank"), 0),
    safe(() => avgColumn("puzzle_bank", "rating"), null),
    safe(() => countAll("puzzle_attempts"), 0),
    safe(() => countEq("puzzle_attempts", "solved", true), 0),
    safe(() => countAll("game_results"), 0),
    safe(() => countEq("game_results", "opponent_type", "bot"), 0),
    safe(() => countEq("game_results", "opponent_type", "human"), 0),
    safe(() => countAll("players"), 0),
    safe(() => avgColumn("players", "game_elo"), null),
    // Go lives in its own tables (go_players / go_puzzle_attempts) — isolated
    // from Pente's ELO per CLAUDE.md, but that also meant the game was
    // invisible here: Go engagement had zero visibility in this dashboard.
    safe(() => countAll("go_players"), 0),
    safe(() => avgColumn("go_players", "go_elo"), null),
    safe(() => countAll("go_puzzle_attempts"), 0),
    safe(() => countEq("go_puzzle_attempts", "solved", true), 0),
  ]);

  return {
    puzzleBank: { count: puzzleCount, avgRating },
    puzzleAttempts: { total: attemptsTotal, solved: attemptsSolved },
    gameResults: {
      total: gameResultsTotal,
      byOpponentType: { bot: botGames, human: humanGames },
    },
    players: { count: playerCount, avgGameElo },
    go: {
      players: { count: goPlayerCount, avgElo: avgGoElo },
      puzzleAttempts: { total: goAttemptsTotal, solved: goAttemptsSolved },
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ADMIN_SESSION_TOKEN && !process.env.ADMIN_KEY) {
    return res.status(503).json({
      error:
        "Admin access is not configured (missing ADMIN_SESSION_TOKEN or ADMIN_KEY).",
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [pageViews, leadCounts, eventTotalsRaw, eventsByPage, funnelRows] = await Promise.all([
      sql`
        SELECT
          COALESCE(page, metadata->>'path', '(unknown)') AS path,
          COUNT(*)::int AS views,
          COUNT(DISTINCT session_id)::int AS sessions
        FROM events
        WHERE event_type = 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY views DESC
      `,
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS last_30_days
        FROM leads
      `,
      // Every tracked interaction except page_view (shown separately above).
      sql`
        SELECT
          event_type,
          COUNT(*)::int AS count,
          COUNT(DISTINCT session_id)::int AS sessions
        FROM events
        WHERE event_type <> 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
      `,
      // Same window, broken out by the page each event fired on.
      sql`
        SELECT
          event_type,
          COALESCE(page, '(unknown)') AS page,
          COUNT(*)::int AS count
        FROM events
        WHERE event_type <> 'page_view'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_type, page
        ORDER BY event_type ASC, count DESC
      `,
      // Consulting funnel, one row of distinct-session counts per step.
      // page_view is scoped to the consulting page ('/consulting' from the
      // global _app tracker; the page's own funnel events use page 'consulting');
      // the later steps only ever fire from the consulting funnel.
      sql`
        SELECT
          COUNT(DISTINCT session_id) FILTER (
            WHERE event_type = 'page_view'
              AND COALESCE(page, metadata->>'path') IN ('/consulting', 'consulting')
          )::int AS page_view,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'section_view')::int AS section_view,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'lead_form_submit')::int AS lead_form_submit,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'lead_submit')::int AS lead_submit
        FROM events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `,
    ]);

    // Guarantee the monetization-signal events appear even at zero, then float
    // them to the top so they're the first thing read.
    const totals = eventTotalsRaw as EventTotalRow[];
    const seen = new Map(totals.map((r) => [r.event_type, r]));
    for (const name of PRIORITY_EVENTS) {
      if (!seen.has(name)) {
        const row = { event_type: name, count: 0, sessions: 0 };
        seen.set(name, row);
        totals.push(row);
      }
    }
    const priorityRank = (t: string) => {
      const i = PRIORITY_EVENTS.indexOf(t as (typeof PRIORITY_EVENTS)[number]);
      return i === -1 ? PRIORITY_EVENTS.length : i;
    };
    const events = totals.sort((a, b) => {
      const pr = priorityRank(a.event_type) - priorityRank(b.event_type);
      return pr !== 0 ? pr : b.count - a.count;
    });

    const funnelRow =
      (funnelRows as Array<Record<string, number>>)[0] ?? {};
    const funnel = [
      { step: "page_view", label: "Consulting page view", sessions: funnelRow.page_view ?? 0 },
      { step: "section_view", label: "Scrolled to FAQ", sessions: funnelRow.section_view ?? 0 },
      { step: "lead_form_submit", label: "Submitted form", sessions: funnelRow.lead_form_submit ?? 0 },
      { step: "lead_submit", label: "Lead captured", sessions: funnelRow.lead_submit ?? 0 },
    ];

    // Game-side stats from Supabase; null when unconfigured, and self-guarded
    // so it can't throw the request into the 503 catch below.
    const supabaseStats = await readSupabaseStats();

    return res.status(200).json({
      pageViews,
      leads: leadCounts[0] ?? { total: 0, last_30_days: 0 },
      events,
      eventsByPage,
      funnel,
      supabaseStats,
      priorityEvents: PRIORITY_EVENTS,
      _meta: { windowDays: 30 },
    });
  } catch (e: unknown) {
    return res
      .status(503)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
