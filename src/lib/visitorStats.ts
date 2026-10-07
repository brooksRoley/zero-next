/**
 * "Who stops by" — the visitor-level reads behind /admin/analytics, all from
 * the first-party `events` table. A visitor is an `anon_id` (durable, per
 * browser), falling back to `session_id` (per tab) where storage was blocked.
 * Bots are excluded everywhere except the device breakdown, which shows them.
 *
 * Every query is guarded on its own: a failure degrades that one block to
 * empty instead of taking down the dashboard.
 */

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>

export const VISITOR_WINDOW_DAYS = 30

export type VisitorSummary = {
  visitors: number
  sessions: number
  page_views: number
  new_visitors: number
}

export type DailyRow = { day: string; visitors: number; sessions: number; views: number }
export type ReferrerRow = { host: string; sessions: number; visitors: number }
export type CampaignRow = { source: string; campaign: string | null; sessions: number }
export type GeoRow = { country: string; region: string | null; city: string | null; visitors: number }
export type DeviceRow = { device: string; browser: string; os: string; sessions: number }

export type HiringSignal = {
  resume_visitors: number
  resume_views: number
  pdf_downloads: number
  home_visitors: number
}

export type GameRow = {
  game: string
  sessions: number
  starts: number
  ends: number
  puzzles_solved: number
  puzzles_failed: number
  stages_completed: number
}

export type ScorecardRow = { label: string; thisWeek: number; lastWeek: number }

export type SessionRow = {
  session_id: string
  anon_id: string | null
  started_at: string
  last_at: string
  events: number
  page_views: number
  pages: string[] | null
  actions: string[] | null
  country: string | null
  region: string | null
  city: string | null
  device: string | null
  browser: string | null
  os: string | null
  referrer: string | null
  utm_source: string | null
  visit_count: number
  email: string | null
}

export type VisitorStats = {
  windowDays: number
  summary: VisitorSummary
  daily: DailyRow[]
  referrers: ReferrerRow[]
  campaigns: CampaignRow[]
  geo: GeoRow[]
  devices: DeviceRow[]
  hiring: HiringSignal
  games: GameRow[]
  scorecard: ScorecardRow[]
  recentSessions: SessionRow[]
}

const EMPTY_SUMMARY: VisitorSummary = { visitors: 0, sessions: 0, page_views: 0, new_visitors: 0 }
const EMPTY_HIRING: HiringSignal = { resume_visitors: 0, resume_views: 0, pdf_downloads: 0, home_visitors: 0 }

async function rows<T>(query: Promise<unknown>, fallback: T[] = []): Promise<T[]> {
  try {
    const result = await query
    return Array.isArray(result) ? (result as T[]) : fallback
  } catch {
    return fallback
  }
}

export async function readVisitorStats(sql: Sql): Promise<VisitorStats> {
  const [
    summaryRows,
    daily,
    referrers,
    campaigns,
    geo,
    devices,
    hiringRows,
    games,
    weekRows,
    leadWeekRows,
    signupWeekRows,
    sessions,
    leadEmails,
  ] = await Promise.all([
    // New = first ever seen inside the window; everyone else is returning.
    rows<VisitorSummary>(sql`
      WITH firsts AS (
        SELECT COALESCE(anon_id, session_id) AS vid, MIN(created_at) AS first_seen
        FROM events
        WHERE COALESCE(device, '') <> 'bot'
        GROUP BY 1
      )
      SELECT
        COUNT(DISTINCT f.vid)::int AS visitors,
        COUNT(DISTINCT e.session_id)::int AS sessions,
        (COUNT(*) FILTER (WHERE e.event_type = 'page_view'))::int AS page_views,
        (COUNT(DISTINCT f.vid) FILTER (WHERE f.first_seen > NOW() - INTERVAL '30 days'))::int AS new_visitors
      FROM events e
      JOIN firsts f ON f.vid = COALESCE(e.anon_id, e.session_id)
      WHERE e.created_at > NOW() - INTERVAL '30 days'
        AND COALESCE(e.device, '') <> 'bot'
    `),
    // One row per day, including days with no traffic, in Pacific time.
    rows<DailyRow>(sql`
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(x.visitors, 0)::int AS visitors,
        COALESCE(x.sessions, 0)::int AS sessions,
        COALESCE(x.views, 0)::int AS views
      FROM generate_series(
        date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') - INTERVAL '29 days',
        date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles'),
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN (
        SELECT
          date_trunc('day', created_at AT TIME ZONE 'America/Los_Angeles') AS day,
          COUNT(DISTINCT COALESCE(anon_id, session_id)) AS visitors,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) FILTER (WHERE event_type = 'page_view') AS views
        FROM events
        WHERE created_at > NOW() - INTERVAL '31 days'
          AND COALESCE(device, '') <> 'bot'
        GROUP BY 1
      ) x ON x.day = d.day
      ORDER BY d.day
    `),
    rows<ReferrerRow>(sql`
      SELECT
        substring(referrer from '^https?://([^/]+)') AS host,
        COUNT(DISTINCT session_id)::int AS sessions,
        COUNT(DISTINCT COALESCE(anon_id, session_id))::int AS visitors
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND referrer IS NOT NULL
        AND COALESCE(device, '') <> 'bot'
      GROUP BY 1
      ORDER BY sessions DESC, host ASC
      LIMIT 15
    `),
    rows<CampaignRow>(sql`
      SELECT
        metadata->'utm'->>'source' AS source,
        metadata->'utm'->>'campaign' AS campaign,
        COUNT(DISTINCT session_id)::int AS sessions
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND metadata->'utm'->>'source' IS NOT NULL
        AND COALESCE(device, '') <> 'bot'
      GROUP BY 1, 2
      ORDER BY sessions DESC, source ASC
      LIMIT 15
    `),
    rows<GeoRow>(sql`
      SELECT
        country,
        region,
        city,
        -- A browser with storage blocked has neither id; count each such view once.
        COUNT(DISTINCT COALESCE(anon_id, session_id, 'event-' || id))::int AS visitors
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND country IS NOT NULL
        AND COALESCE(device, '') <> 'bot'
      GROUP BY 1, 2, 3
      ORDER BY visitors DESC, country ASC, city ASC
      LIMIT 20
    `),
    // Bots are kept here on purpose, so their share of traffic is visible.
    rows<DeviceRow>(sql`
      SELECT
        COALESCE(device, 'unknown') AS device,
        COALESCE(browser, '—') AS browser,
        COALESCE(os, '—') AS os,
        COUNT(DISTINCT COALESCE(session_id, id::text))::int AS sessions
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND device IS NOT NULL
      GROUP BY 1, 2, 3
      ORDER BY sessions DESC, device ASC
      LIMIT 15
    `),
    rows<HiringSignal>(sql`
      SELECT
        (COUNT(DISTINCT COALESCE(anon_id, session_id)) FILTER (WHERE event_type = 'page_view' AND page = '/resume'))::int AS resume_visitors,
        (COUNT(*) FILTER (WHERE event_type = 'page_view' AND page = '/resume'))::int AS resume_views,
        (COUNT(*) FILTER (WHERE event_type = 'resume_pdf_download'))::int AS pdf_downloads,
        (COUNT(DISTINCT COALESCE(anon_id, session_id)) FILTER (WHERE event_type = 'page_view' AND page = '/'))::int AS home_visitors
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND COALESCE(device, '') <> 'bot'
    `),
    // The shared game vocabulary from src/lib/analytics.ts (GAME_EVENTS).
    rows<GameRow>(sql`
      SELECT
        metadata->>'game' AS game,
        COUNT(DISTINCT session_id)::int AS sessions,
        (COUNT(*) FILTER (WHERE event_type = 'game_start'))::int AS starts,
        (COUNT(*) FILTER (WHERE event_type = 'game_end'))::int AS ends,
        (COUNT(*) FILTER (WHERE event_type = 'puzzle_solved'))::int AS puzzles_solved,
        (COUNT(*) FILTER (WHERE event_type = 'puzzle_failed'))::int AS puzzles_failed,
        (COUNT(*) FILTER (WHERE event_type = 'tutorial_stage_complete'))::int AS stages_completed
      FROM events
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND metadata->>'game' IS NOT NULL
        AND event_type IN ('game_start', 'game_end', 'puzzle_start', 'puzzle_solved', 'puzzle_failed', 'tutorial_stage_complete')
        AND COALESCE(device, '') <> 'bot'
      GROUP BY 1
      ORDER BY sessions DESC, game ASC
    `),
    // Scorecard: the last 7 days against the 7 before them.
    rows<Record<string, number>>(sql`
      SELECT
        (COUNT(DISTINCT COALESCE(anon_id, session_id)) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'))::int AS visitors_this,
        (COUNT(DISTINCT COALESCE(anon_id, session_id)) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days'))::int AS visitors_last,
        (COUNT(DISTINCT session_id) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'))::int AS sessions_this,
        (COUNT(DISTINCT session_id) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days'))::int AS sessions_last,
        (COUNT(*) FILTER (WHERE event_type = 'page_view' AND page = '/resume' AND created_at > NOW() - INTERVAL '7 days'))::int AS resume_this,
        (COUNT(*) FILTER (WHERE event_type = 'page_view' AND page = '/resume' AND created_at <= NOW() - INTERVAL '7 days'))::int AS resume_last,
        (COUNT(DISTINCT session_id) FILTER (WHERE metadata->>'game' IS NOT NULL AND created_at > NOW() - INTERVAL '7 days'))::int AS games_this,
        (COUNT(DISTINCT session_id) FILTER (WHERE metadata->>'game' IS NOT NULL AND created_at <= NOW() - INTERVAL '7 days'))::int AS games_last
      FROM events
      WHERE created_at > NOW() - INTERVAL '14 days'
        AND COALESCE(device, '') <> 'bot'
    `),
    rows<Record<string, number>>(sql`
      SELECT
        (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'))::int AS this_week,
        (COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days'))::int AS last_week
      FROM leads
      WHERE created_at > NOW() - INTERVAL '14 days'
    `),
    rows<Record<string, number>>(sql`
      SELECT
        (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'))::int AS this_week,
        (COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days'))::int AS last_week
      FROM email_signups
      WHERE created_at > NOW() - INTERVAL '14 days'
    `),
    // The 50 most recent visits, one row each: where from, on what, which
    // pages in order, and what they did. `email` is filled only when this same
    // browser later gave one (a waitlist or gate signup).
    rows<SessionRow>(sql`
      WITH s AS (
        SELECT
          session_id,
          MAX(anon_id) AS anon_id,
          MIN(created_at) AS started_at,
          MAX(created_at) AS last_at,
          COUNT(*)::int AS events,
          (COUNT(*) FILTER (WHERE event_type = 'page_view'))::int AS page_views,
          (ARRAY_AGG(page ORDER BY created_at) FILTER (WHERE event_type = 'page_view'))[1:12] AS pages,
          ARRAY_AGG(DISTINCT event_type) FILTER (WHERE event_type <> 'page_view') AS actions,
          MAX(country) AS country,
          MAX(region) AS region,
          MAX(city) AS city,
          MAX(device) AS device,
          MAX(browser) AS browser,
          MAX(os) AS os,
          (ARRAY_AGG(referrer ORDER BY created_at) FILTER (WHERE referrer IS NOT NULL))[1] AS referrer,
          MAX(metadata->'utm'->>'source') AS utm_source
        FROM events
        WHERE session_id IS NOT NULL
          AND created_at > NOW() - INTERVAL '30 days'
          AND COALESCE(device, '') <> 'bot'
        GROUP BY session_id
        ORDER BY MIN(created_at) DESC
        LIMIT 50
      )
      SELECT
        s.*,
        CASE WHEN s.anon_id IS NULL THEN 1 ELSE (
          SELECT COUNT(DISTINCT e2.session_id)::int FROM events e2 WHERE e2.anon_id = s.anon_id
        ) END AS visit_count,
        (
          SELECT MAX(e3.metadata->>'email')
          FROM events e3
          WHERE e3.anon_id = s.anon_id AND e3.metadata->>'email' IS NOT NULL
        ) AS email
      FROM s
      ORDER BY s.started_at DESC
    `),
    // Consulting leads carry the same anon_id, so a lead's visits can be named.
    rows<{ anon_id: string; email: string }>(sql`
      SELECT anon_id, MAX(email) AS email
      FROM leads
      WHERE anon_id IS NOT NULL
      GROUP BY anon_id
    `),
  ])

  const week = weekRows[0] ?? {}
  const leadWeek = leadWeekRows[0] ?? {}
  const signupWeek = signupWeekRows[0] ?? {}
  const scorecard: ScorecardRow[] = [
    { label: 'Visitors', thisWeek: week.visitors_this ?? 0, lastWeek: week.visitors_last ?? 0 },
    { label: 'Sessions', thisWeek: week.sessions_this ?? 0, lastWeek: week.sessions_last ?? 0 },
    { label: 'Resume views', thisWeek: week.resume_this ?? 0, lastWeek: week.resume_last ?? 0 },
    { label: 'Game sessions', thisWeek: week.games_this ?? 0, lastWeek: week.games_last ?? 0 },
    { label: 'Leads', thisWeek: leadWeek.this_week ?? 0, lastWeek: leadWeek.last_week ?? 0 },
    { label: 'Email signups', thisWeek: signupWeek.this_week ?? 0, lastWeek: signupWeek.last_week ?? 0 },
  ]

  const leadEmailByAnon = new Map(leadEmails.map((lead) => [lead.anon_id, lead.email]))
  const recentSessions = sessions.map((session) => ({
    ...session,
    email: session.email ?? (session.anon_id ? leadEmailByAnon.get(session.anon_id) ?? null : null),
  }))

  return {
    windowDays: VISITOR_WINDOW_DAYS,
    summary: summaryRows[0] ?? EMPTY_SUMMARY,
    daily,
    referrers,
    campaigns,
    geo,
    devices,
    hiring: hiringRows[0] ?? EMPTY_HIRING,
    games,
    scorecard,
    recentSessions,
  }
}
