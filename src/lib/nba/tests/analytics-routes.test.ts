/**
 * Contract tests for the NBA analytics routes rewired off the dead
 * stats.nba.com client onto Neon.
 *
 * These four endpoints had no coverage at all: the whole analytics branch was
 * 503ing in production before the rewire, and nothing would have caught it
 * regressing again. Only the Neon `sql` client is mocked, so every route's real
 * shaping, rounding, conference normalization and team-id mapping executes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}));

// Pass-through: exercise the handler body on every call rather than a cache hit.
vi.mock("src/lib/nba/cache", () => ({
  cached: async (_key: string, fn: () => Promise<any>, _ttl?: number) => fn(),
}));

function createMockReq(query: Record<string, string> = {}): any {
  return { query, headers: {}, method: "GET" };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null, _headers: {} as Record<string, string> };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  // league-lens sets Cache-Control; without setHeader the success path throws
  // into the catch and reports 503 — the exact failure that red-lined CI once.
  res.setHeader = (k: string, v: string) => { res._headers[k] = v; return res; };
  return res;
}

const LAKERS = 1610612747;
const CELTICS = 1610612738;

// DB row shapes (snake_case), as the Neon queries return them.
const LENS_PLAYER_ROWS = [
  {
    player_id: 2544, player_name: "LeBron James", position: "F", age: 41,
    season: "2025-26", season_team_id: LAKERS, games_played: 62,
    mpg: 35.24, ppg: 24.85, rpg: 7.11, apg: 8.33, spg: 1.2, bpg: 0.6, topg: 3.4,
    fga: 18.64, fg3a: 5.81, fta: 5.62, fg_pct: 0.4951, fg3_pct: 0.3624, ft_pct: 0.7683,
    salary: 48_000_000,
  },
  {
    player_id: 999, player_name: "Unsigned Rookie", position: null, age: null,
    season: "2025-26", season_team_id: 42, games_played: 4,
    mpg: null, ppg: null, rpg: null, apg: null, spg: null, bpg: null, topg: null,
    fga: null, fg3a: null, fta: null, fg_pct: null, fg3_pct: null, ft_pct: null,
    salary: null,
  },
];

const LENS_TEAM_ROWS = [
  { team_id: LAKERS, conference: "Western Conference", wins: 44, losses: 28, win_pct: 0.6111, payroll: 190_000_000 },
  { team_id: CELTICS, conference: "East", wins: 54, losses: 18, win_pct: 0.75, payroll: null },
];

const SEASON_PLAYER_ROWS = [
  { player_id: 2544, player_name: "LeBron James", age: 41, team_id: LAKERS, games_played: 62, ppg: 24.85, rpg: 7.1, apg: 8.3, fga: 18.6, fg3a: 5.8, mpg: 35.2 },
  { player_id: 203076, player_name: "Anthony Davis", age: 33, team_id: LAKERS, games_played: 58, ppg: 26.3, rpg: 11.9, apg: 3.2, fga: 19.4, fg3a: 3.5, mpg: 34.1 },
  { player_id: 1628369, player_name: "Jayson Tatum", age: 28, team_id: CELTICS, games_played: 70, ppg: 27.1, rpg: 8.4, apg: 4.6, fga: 20.2, fg3a: 9.1, mpg: 36.0 },
];

const DB_TEAM_ROWS = [
  { team_id: LAKERS, team_name: "Lakers", team_city: "Los Angeles", team_abbreviation: "LAL", conference: "Western Conference", division: null },
  { team_id: CELTICS, team_name: "Celtics", team_city: "Boston", team_abbreviation: "BOS", conference: "Eastern Conference", division: null },
];

const DB_STANDINGS_ROWS = [
  { team_id: LAKERS, team_name: "Lakers", team_city: "Los Angeles", conference: "Western Conference", division: null, playoff_rank: 5, wins: 44, losses: 28, win_pct: 0.6111 },
  { team_id: CELTICS, team_name: "Celtics", team_city: "Boston", conference: "East", division: null, playoff_rank: 1, wins: 54, losses: 18, win_pct: 0.75 },
];

const ROSTER_ROWS = [
  { player_id: 203076, player_name: "Anthony Davis", age: 33, games_played: 58, mpg: 34.1, ppg: 26.3, rpg: 11.9, apg: 3.2, fga: 19.4, fg3a: 3.5, fta: 6.3, fg_pct: 0.521, fg3_pct: 0.343, ft_pct: 0.778 },
  { player_id: 2544, player_name: "LeBron James", age: 41, games_played: 62, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, fga: 18.6, fg3a: 5.8, fta: 5.6, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768 },
];

beforeEach(() => {
  vi.resetModules();
  mockSql.mockReset();
});

describe("GET /api/nba/analytics/league-lens", () => {
  function primeHappyPath() {
    mockSql
      .mockResolvedValueOnce(LENS_PLAYER_ROWS)
      .mockResolvedValueOnce(LENS_TEAM_ROWS);
  }

  it("returns players, teams, and the cap thresholds in one payload", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json._meta.endpoint).toBe("league_lens");
    expect(res._json.data.players).toHaveLength(2);
    expect(res._json.data.teams).toHaveLength(2);
    // The explorer draws cap/tax/apron lines from these; they must ship with the data.
    expect(res._json.data.thresholds.cap).toBeGreaterThan(0);
    expect(res._json.data.thresholds.secondApron).toBeGreaterThan(
      res._json.data.thresholds.firstApron
    );
  });

  it("rounds per-game stats to 1dp and percentages to 3dp", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    const lebron = res._json.data.players.find((p: any) => p.id === 2544);
    expect(lebron.ppg).toBe(24.9); // 24.85 → 1dp
    expect(lebron.fg_pct).toBe(0.495); // 0.4951 → 3dp
    expect(lebron.fg3_pct).toBe(0.362);
  });

  it("maps season team ids to abbreviations and blanks unknown ids", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    const players = res._json.data.players;
    expect(players.find((p: any) => p.id === 2544).team).toBe("LAL");
    // Team id 42 isn't a real franchise — must not throw or emit "undefined".
    expect(players.find((p: any) => p.id === 999).team).toBe("");
  });

  it("preserves null salary and null age rather than coercing them to 0", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    const rookie = res._json.data.players.find((p: any) => p.id === 999);
    // A missing contract is not a $0 contract — the payroll chart depends on this.
    expect(rookie.salary).toBeNull();
    expect(rookie.age).toBeNull();
    // Counting stats, by contrast, do floor to 0.
    expect(rookie.ppg).toBe(0);
  });

  it("normalizes mixed stored conference labels to a single cohort", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    const teams = res._json.data.teams;
    // "Western Conference" and "East" are both stored; both must normalize.
    expect(teams.find((t: any) => t.id === LAKERS).conference).toBe("West");
    expect(teams.find((t: any) => t.id === CELTICS).conference).toBe("East");
  });

  it("keeps a team with no payroll rows as null, not zero", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._json.data.teams.find((t: any) => t.id === CELTICS).payroll).toBeNull();
    expect(res._json.data.teams.find((t: any) => t.id === LAKERS).payroll).toBe(190_000_000);
  });

  it("sets a cache header on success", async () => {
    primeHappyPath();
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._headers["Cache-Control"]).toContain("s-maxage");
  });

  it("returns 503 with the message when the DB fails", async () => {
    mockSql.mockRejectedValue(new Error("Neon connection refused"));
    const { default: handler } = await import("src/pages/api/nba/analytics/league-lens");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
    expect(res._json.error).toContain("refused");
  });
});

describe("GET /api/nba/analytics/season", () => {
  it("returns leader boards ranked by each stat", async () => {
    mockSql
      .mockResolvedValueOnce(SEASON_PLAYER_ROWS)
      .mockResolvedValueOnce(LENS_TEAM_ROWS);

    const { default: handler } = await import("src/pages/api/nba/analytics/season");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json._meta.endpoint).toBe("season_analytics");
    const { scoring, rebounding, assists, shot_volume } = res._json.data.leaders;
    expect(scoring[0].name).toBe("Jayson Tatum"); // 27.1 ppg
    expect(rebounding[0].name).toBe("Anthony Davis"); // 11.9 rpg
    expect(assists[0].name).toBe("LeBron James"); // 8.3 apg
    expect(shot_volume[0].name).toBe("Jayson Tatum"); // 20.2 fga
  });

  it("caps each leader board at 20 entries", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      ...SEASON_PLAYER_ROWS[0],
      player_id: 1000 + i,
      player_name: `Player ${i}`,
      ppg: i,
    }));
    mockSql.mockResolvedValueOnce(many).mockResolvedValueOnce(LENS_TEAM_ROWS);

    const { default: handler } = await import("src/pages/api/nba/analytics/season");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._json.data.leaders.scoring).toHaveLength(20);
    expect(res._json.data.leaders.scoring[0].ppg).toBe(39); // highest first
  });

  /**
   * The rewire deliberately dropped TS%/USG%/NetRtg: no trusted free stream
   * publishes them, and the previous response advertised them anyway. This
   * guards against a future session "restoring" fabricated advanced metrics.
   */
  it("does not advertise advanced metrics no trusted source publishes", async () => {
    mockSql
      .mockResolvedValueOnce(SEASON_PLAYER_ROWS)
      .mockResolvedValueOnce(LENS_TEAM_ROWS);

    const { default: handler } = await import("src/pages/api/nba/analytics/season");
    const res = createMockRes();
    await handler(createMockReq(), res);

    const serialized = JSON.stringify(res._json);
    expect(serialized).not.toMatch(/ts_pct|usg_pct|net_rtg/i);
  });

  it("returns 503 when the DB fails", async () => {
    mockSql.mockRejectedValue(new Error("timeout"));
    const { default: handler } = await import("src/pages/api/nba/analytics/season");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
  });
});

describe("GET /api/nba/analytics/team/[id]", () => {
  function primeTeamDashboard() {
    // getTeams() → getStandingsRows() → roster query
    mockSql
      .mockResolvedValueOnce(DB_TEAM_ROWS)
      .mockResolvedValueOnce(DB_STANDINGS_ROWS)
      .mockResolvedValueOnce(ROSTER_ROWS);
  }

  it("returns identity, standing, and roster stats sorted by scoring", async () => {
    primeTeamDashboard();
    const { default: handler } = await import("src/pages/api/nba/analytics/team/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: String(LAKERS) }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.team.name).toBe("Lakers");
    expect(res._json.data.standing.wins).toBe(44);
    expect(res._json.data.standing.conference_rank).toBe(5);
    // Roster arrives ordered by name but is re-sorted by ppg descending.
    expect(res._json.data.roster_stats[0].name).toBe("Anthony Davis");
    expect(res._json.data.roster_stats[0].ppg).toBeGreaterThan(
      res._json.data.roster_stats[1].ppg
    );
  });

  it("rounds the standing win pct to 3dp", async () => {
    primeTeamDashboard();
    const { default: handler } = await import("src/pages/api/nba/analytics/team/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: String(LAKERS) }), res);
    expect(res._json.data.standing.pct).toBe(0.611); // 0.6111 → 3dp
  });

  it("returns 400 for a non-numeric team id", async () => {
    const { default: handler } = await import("src/pages/api/nba/analytics/team/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "not-a-team" }), res);
    expect(res._status).toBe(400);
    // Must reject before touching the DB.
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown team id", async () => {
    mockSql.mockResolvedValueOnce(DB_TEAM_ROWS);
    const { default: handler } = await import("src/pages/api/nba/analytics/team/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "999" }), res);
    expect(res._status).toBe(404);
  });

  it("returns 503 when the DB fails", async () => {
    mockSql.mockRejectedValue(new Error("connection reset"));
    const { default: handler } = await import("src/pages/api/nba/analytics/team/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: String(LAKERS) }), res);
    expect(res._status).toBe(503);
  });
});

describe("GET /api/nba/analytics/lakers", () => {
  it("delegates to the team dashboard for the Lakers", async () => {
    mockSql
      .mockResolvedValueOnce(DB_TEAM_ROWS)
      .mockResolvedValueOnce(DB_STANDINGS_ROWS)
      .mockResolvedValueOnce(ROSTER_ROWS);

    const { default: handler } = await import("src/pages/api/nba/analytics/lakers");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json._meta.endpoint).toBe("lakers_dashboard");
    expect(res._json.data.team.id).toBe(LAKERS);
  });

  it("returns 503 when the underlying dashboard fails", async () => {
    mockSql.mockRejectedValue(new Error("Neon down"));
    const { default: handler } = await import("src/pages/api/nba/analytics/lakers");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
  });
});
