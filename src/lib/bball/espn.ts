/**
 * ESPN public API client for the Hardwood roster pipeline.
 *
 * stats.nba.com (the medallion source) times out from both Vercel and
 * residential IPs as of 2026-07, so the game roster is generated from ESPN's
 * unauthenticated JSON APIs instead:
 *  - byathlete — per-player season averages (the table behind espn.com/nba/stats)
 *  - team rosters — current team + injury status. This is the surface that
 *    moves during free agency: a signing shows up in the next daily refresh.
 */

const STATS_URL =
  "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete";
const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const PAGE_LIMIT = 100;
const MAX_PAGES = 10;
const FETCH_TIMEOUT_MS = 15_000;

export type EspnSeasonStats = {
  id: number;
  name: string;
  gamesPlayed: number;
  avgMinutes: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  /** Shooting percentages as 0–1 fractions (ESPN serves 0–100). */
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
};

export type EspnRosterStatus = { team: string; injuryStatus: string };

export type EspnRosterPlayer = {
  id: number;
  name: string;
  /** Position abbreviation, e.g. "G", "F", "C". */
  position: string;
  teamAbbrev: string;
  /** Full team name, e.g. "Los Angeles Lakers" — joinable to NBA_TEAMS. */
  teamName: string;
  injuryStatus: string;
};

export type EspnStandingsEntry = {
  teamName: string;
  teamAbbrev: string;
  conference: string;
  wins: number;
  losses: number;
  winPercent: number;
  playoffSeed: number;
};

/**
 * ESPN identifies seasons by their ending year (2025-26 → 2026). From October
 * we're in the season ending next calendar year; before that the completed
 * season is the freshest full dataset (July free agency reprices last season).
 */
export function espnSeasonYear(now: Date = new Date()): number {
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Parse one byathlete page into flat stat rows. The stat values live on each
 * athlete as unlabeled arrays; the labels for each category (general /
 * offensive / defensive) come from the page-level `categories`. Exported for
 * tests.
 */
export function parseByAthletePage(page: any): EspnSeasonStats[] {
  const labelsByCategory = new Map<string, string[]>();
  for (const cat of page?.categories ?? []) {
    if (cat?.name && Array.isArray(cat.names)) labelsByCategory.set(cat.name, cat.names);
  }

  const rows: EspnSeasonStats[] = [];
  for (const entry of page?.athletes ?? []) {
    const athlete = entry?.athlete;
    const id = Number(athlete?.id);
    if (!Number.isInteger(id) || !athlete?.displayName) continue;

    const stat = new Map<string, number>();
    for (const cat of entry?.categories ?? []) {
      const labels = labelsByCategory.get(cat?.name);
      if (!labels || !Array.isArray(cat?.values)) continue;
      labels.forEach((label, i) => {
        const v = cat.values[i];
        if (typeof v === "number" && Number.isFinite(v)) stat.set(label, v);
      });
    }

    rows.push({
      id,
      name: athlete.displayName,
      gamesPlayed: stat.get("gamesPlayed") ?? 0,
      avgMinutes: stat.get("avgMinutes") ?? 0,
      avgPoints: stat.get("avgPoints") ?? 0,
      avgRebounds: stat.get("avgRebounds") ?? 0,
      avgAssists: stat.get("avgAssists") ?? 0,
      avgSteals: stat.get("avgSteals") ?? 0,
      avgBlocks: stat.get("avgBlocks") ?? 0,
      avgTurnovers: stat.get("avgTurnovers") ?? 0,
      fgPct: (stat.get("fieldGoalPct") ?? 0) / 100,
      fg3Pct: (stat.get("threePointFieldGoalPct") ?? 0) / 100,
      ftPct: (stat.get("freeThrowPct") ?? 0) / 100,
    });
  }
  return rows;
}

/**
 * All qualified players' regular-season averages for the given season.
 * `isqualified=true` is ESPN's minutes threshold — the pool z-scores are
 * computed against rotation players, not ten-day contracts.
 */
export async function fetchSeasonStats(
  season: number = espnSeasonYear()
): Promise<EspnSeasonStats[]> {
  const rows: EspnSeasonStats[] = [];
  let pages = 1;
  for (let pageNum = 1; pageNum <= Math.min(pages, MAX_PAGES); pageNum++) {
    const url =
      `${STATS_URL}?region=us&lang=en&isqualified=true&seasontype=2` +
      `&season=${season}&page=${pageNum}&limit=${PAGE_LIMIT}` +
      `&sort=offensive.avgPoints%3Adesc`;
    const page = await fetchJson(url);
    pages = Number(page?.pagination?.pages) || 1;
    rows.push(...parseByAthletePage(page));
  }
  return rows;
}

/**
 * Every player on an NBA roster right now, with the team they're on today —
 * during free agency this is the feed that moves. Fetches all 30 team
 * rosters in parallel.
 */
export async function fetchTeamRosters(): Promise<EspnRosterPlayer[]> {
  const teamsPage = await fetchJson(`${SITE_BASE}/teams`);
  const teams: Array<{ id: string }> = (
    teamsPage?.sports?.[0]?.leagues?.[0]?.teams ?? []
  )
    .map((t: any) => t?.team)
    .filter((t: any) => t?.id);
  if (teams.length === 0) throw new Error("ESPN teams list came back empty");

  const players: EspnRosterPlayer[] = [];
  const rosters = await Promise.all(
    teams.map((t) => fetchJson(`${SITE_BASE}/teams/${t.id}/roster`))
  );
  for (const roster of rosters) {
    const teamAbbrev = roster?.team?.abbreviation ?? "";
    const teamName = roster?.team?.displayName ?? "";
    for (const athlete of roster?.athletes ?? []) {
      const id = Number(athlete?.id);
      if (!Number.isInteger(id) || !athlete?.fullName) continue;
      players.push({
        id,
        name: athlete.fullName,
        position: athlete?.position?.abbreviation ?? "",
        teamAbbrev,
        teamName,
        injuryStatus: athlete?.injuries?.[0]?.status ?? "",
      });
    }
  }
  return players;
}

/**
 * Current team + injury status keyed by ESPN athlete id. Players who
 * qualified last season but appear on no roster are unsigned free agents.
 */
export async function fetchRosterStatuses(): Promise<Map<number, EspnRosterStatus>> {
  const statuses = new Map<number, EspnRosterStatus>();
  for (const p of await fetchTeamRosters()) {
    statuses.set(p.id, { team: p.teamAbbrev, injuryStatus: p.injuryStatus });
  }
  return statuses;
}

/**
 * League standings by conference. Division isn't in this feed — callers that
 * need it can join NBA_TEAMS. Exported page parser for tests.
 */
export function parseStandingsPage(page: any): EspnStandingsEntry[] {
  const entries: EspnStandingsEntry[] = [];
  for (const conference of page?.children ?? []) {
    const confName = conference?.name ?? "";
    for (const entry of conference?.standings?.entries ?? []) {
      const team = entry?.team;
      if (!team?.displayName) continue;
      const stat = new Map<string, number>();
      for (const s of entry?.stats ?? []) {
        if (s?.name && typeof s.value === "number") stat.set(s.name, s.value);
      }
      entries.push({
        teamName: team.displayName,
        teamAbbrev: team.abbreviation ?? "",
        conference: confName,
        wins: stat.get("wins") ?? 0,
        losses: stat.get("losses") ?? 0,
        winPercent: stat.get("winPercent") ?? 0,
        playoffSeed: stat.get("playoffSeed") ?? 0,
      });
    }
  }
  return entries;
}

export async function fetchStandings(): Promise<EspnStandingsEntry[]> {
  const page = await fetchJson(
    "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"
  );
  const entries = parseStandingsPage(page);
  if (entries.length === 0) throw new Error("ESPN standings came back empty");
  return entries;
}
