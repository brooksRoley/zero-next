/**
 * API Route Contract Tests
 * DB-backed routes (players, teams, standings) mock the Neon sql client;
 * game-level routes still mock fetchStats/fetchStatsMulti (stats.nba.com)
 * until a trusted boxscore stream replaces them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the external data layer ──────────────────────────────────────────────

// Mock fetchStats and fetchStatsMulti
const mockFetchStats = vi.fn();
const mockFetchStatsMulti = vi.fn();
vi.mock("src/lib/nba/client", () => ({
  fetchStats: (...args: any[]) => mockFetchStats(...args),
  fetchStatsMulti: (...args: any[]) => mockFetchStatsMulti(...args),
}));

// Mock the Neon tagged-template client (sql`...` → mockSql(strings, ...values))
const mockSql = vi.fn();
vi.mock("src/lib/db", () => ({
  sql: (...args: any[]) => mockSql(...args),
}));

// Disable caching — every call goes through the mock
vi.mock("src/lib/nba/cache", () => ({
  cached: async (_key: string, fn: () => Promise<any>, _ttl?: number) => fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockReq(query: Record<string, string> = {}, headers: Record<string, string> = {}): any {
  return { query, headers, method: "GET" };
}

function createMockRes(): any {
  const res: any = { _status: 200, _json: null, _headers: {} as Record<string, string> };
  res.status = (code: number) => { res._status = code; return res; };
  res.json = (data: any) => { res._json = data; return res; };
  // Route handlers set Cache-Control before sending. The real NextApiResponse
  // implements setHeader; the mock must too, or success paths throw and fall
  // into the catch → 503 (which is what silently red-lined CI from 2026-05-08).
  res.setHeader = (key: string, value: string) => { res._headers[key] = value; return res; };
  return res;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// DB row shapes (snake_case, as the Neon queries return them)
const DB_PLAYER_ROWS = [
  { player_id: 2544, player_name: "LeBron James", position: "F", age: 41, team_id: 1610612747, games_played: 62, mpg: 35.2, ppg: 24.8, rpg: 7.1, apg: 8.3, spg: 1.2, bpg: 0.6, topg: 3.4, fga: 18.6, fg3a: 5.8, fta: 5.6, fg_pct: 0.495, fg3_pct: 0.362, ft_pct: 0.768 },
  { player_id: 203076, player_name: "Anthony Davis", position: "F-C", age: 33, team_id: 1610612747, games_played: 58, mpg: 34.1, ppg: 26.3, rpg: 11.9, apg: 3.2, spg: 1.3, bpg: 2.1, topg: 2.1, fga: 19.4, fg3a: 3.5, fta: 6.3, fg_pct: 0.521, fg3_pct: 0.343, ft_pct: 0.778 },
];

const DB_STANDINGS_ROWS = [
  { team_id: 1610612747, team_name: "Lakers", team_city: "Los Angeles", conference: "Western Conference", division: null, playoff_rank: 5, wins: 44, losses: 28, win_pct: 0.611 },
  { team_id: 1610612738, team_name: "Celtics", team_city: "Boston", conference: "East", division: null, playoff_rank: 1, wins: 54, losses: 18, win_pct: 0.75 },
  { team_id: 1610612760, team_name: "Thunder", team_city: "Oklahoma City", conference: "Western Conference", division: null, playoff_rank: 1, wins: 58, losses: 14, win_pct: 0.806 },
];

const DB_TEAM_ROWS = [
  { team_id: 1610612747, team_name: "Lakers", team_city: "Los Angeles", team_abbreviation: "LAL", conference: "Western Conference", division: null },
  { team_id: 1610612738, team_name: "Celtics", team_city: "Boston", team_abbreviation: "BOS", conference: "Eastern Conference", division: null },
  { team_id: 1610612760, team_name: "Thunder", team_city: "Oklahoma City", team_abbreviation: "OKC", conference: "Western Conference", division: null },
];


const MOCK_GAME_FINDER_ROWS = [
  { GAME_ID: "0022500850", GAME_DATE: "2026-03-15", MATCHUP: "LAL vs. BOS", TEAM_ABBREVIATION: "LAL", WL: "W", PTS: 118 },
  { GAME_ID: "0022500850", GAME_DATE: "2026-03-15", MATCHUP: "BOS @ LAL", TEAM_ABBREVIATION: "BOS", WL: "L", PTS: 105 },
  { GAME_ID: "0022500855", GAME_DATE: "2026-03-17", MATCHUP: "DEN vs. LAL", TEAM_ABBREVIATION: "DEN", WL: "W", PTS: 112 },
  { GAME_ID: "0022500855", GAME_DATE: "2026-03-17", MATCHUP: "LAL @ DEN", TEAM_ABBREVIATION: "LAL", WL: "L", PTS: 105 },
];

const MOCK_GAMELOG_ROWS = [
  { GAME_DATE: "MAR 15, 2026", MATCHUP: "LAL vs. BOS", WL: "W", PTS: 32, REB: 8, AST: 10, FG_PCT: 0.545, MIN: "36:00" },
  { GAME_DATE: "MAR 17, 2026", MATCHUP: "LAL @ DEN", WL: "L", PTS: 22, REB: 6, AST: 7, FG_PCT: 0.4, MIN: "38:00" },
  { GAME_DATE: "MAR 19, 2026", MATCHUP: "LAL vs. GSW", WL: "W", PTS: 28, REB: 7, AST: 9, FG_PCT: 0.48, MIN: "35:00" },
];

const MOCK_BOXSCORE_SETS: Record<string, any[]> = {
  TeamStats: [
    { teamTricode: "LAL", teamCity: "Los Angeles", teamName: "Lakers", teamId: 1610612747, points: 118 },
    { teamTricode: "BOS", teamCity: "Boston", teamName: "Celtics", teamId: 1610612738, points: 105 },
  ],
  PlayerStats: [
    { teamTricode: "LAL", firstName: "LeBron", familyName: "James", points: 32, reboundsTotal: 8, assists: 10 },
    { teamTricode: "LAL", firstName: "Anthony", familyName: "Davis", points: 28, reboundsTotal: 14, assists: 3 },
    { teamTricode: "BOS", firstName: "Jayson", familyName: "Tatum", points: 30, reboundsTotal: 7, assists: 5 },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetchStats.mockReset();
  mockFetchStatsMulti.mockReset();
  mockSql.mockReset();
});

describe("GET /api/nba/players", () => {
  it("transforms DB rows into API response shape", async () => {
    mockSql.mockResolvedValue(DB_PLAYER_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(2);
    expect(res._json.data[0]).toMatchObject({
      id: 2544,
      name: "LeBron James",
      team_id: 1610612747,
      pos: "F",
      age: 41,
      gp: 62,
      ppg: 24.8,
      rpg: 7.1,
      apg: 8.3,
      fga: 18.6,
    });
    expect(res._json._meta.endpoint).toBe("players");
  });

  it("filters by team_id query param", async () => {
    mockSql.mockResolvedValue(DB_PLAYER_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq({ team_id: "1610612747" }), res);
    expect(res._json.data).toHaveLength(2);

    // Filter for a team that doesn't exist
    const res2 = createMockRes();
    await handler(createMockReq({ team_id: "999" }), res2);
    expect(res2._json.data).toHaveLength(0);
  });

  it("returns 503 when the DB throws", async () => {
    mockSql.mockRejectedValue(new Error("connection refused"));
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
    expect(res._json.error).toContain("refused");
  });

  it("handles an empty table", async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(0);
  });
});

describe("GET /api/nba/teams", () => {
  it("transforms DB team rows into team list", async () => {
    mockSql.mockResolvedValue(DB_TEAM_ROWS);
    const { default: handler } = await import("src/pages/api/nba/teams/index");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(3);
    const lakers = res._json.data.find((t: any) => t.id === 1610612747);
    expect(lakers.name).toBe("Lakers");
    expect(lakers.city).toBe("Los Angeles");
    expect(lakers.conference).toBe("West"); // normalized from "Western Conference"
  });

  it("returns 503 on DB failure", async () => {
    mockSql.mockRejectedValue(new Error("timeout"));
    const { default: handler } = await import("src/pages/api/nba/teams/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
  });
});

describe("GET /api/nba/standings", () => {
  it("returns ranked standings sorted by win pct", async () => {
    mockSql.mockResolvedValue(DB_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    const data = res._json.data;
    expect(data[0].pct).toBeGreaterThanOrEqual(data[1].pct);
    expect(data[0].rank).toBe(1);
    expect(data[0].wins).toBe(58); // Thunder first
  });

  it("filters by conference, tolerating mixed stored labels", async () => {
    mockSql.mockResolvedValue(DB_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq({ conference: "East" }), res);

    // "East" and "Eastern Conference" both normalize to East
    expect(res._json.data).toHaveLength(1);
    expect(res._json.data[0].name).toBe("Celtics");
  });

  it("conference filter is case-insensitive", async () => {
    mockSql.mockResolvedValue(DB_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq({ conference: "west" }), res);
    expect(res._json.data).toHaveLength(2);
  });
});

describe("GET /api/nba/games", () => {
  it("deduplicates game rows and identifies home/away", async () => {
    mockFetchStats.mockResolvedValue(MOCK_GAME_FINDER_ROWS);
    const { default: handler } = await import("src/pages/api/nba/games/index");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(2);

    const game1 = res._json.data.find((g: any) => g.id === 22500850);
    expect(game1.home).toBe("LAL");
    expect(game1.away).toBe("BOS");
    expect(game1.home_score).toBe(118);
    expect(game1.away_score).toBe(105);
    expect(game1.winner).toBe("LAL");
  });

  it("accepts date query param", async () => {
    mockFetchStats.mockResolvedValue([]);
    const { default: handler } = await import("src/pages/api/nba/games/index");
    const res = createMockRes();
    await handler(createMockReq({ date: "2026-03-15" }), res);

    expect(res._status).toBe(200);
    // Verify fetchStats was called with leaguegamefinder and a date-formatted param
    expect(mockFetchStats).toHaveBeenCalledWith(
      "leaguegamefinder",
      expect.objectContaining({ Season: "2025-26" }),
      expect.anything(),
    );
    // DateFrom and DateTo should match (same day) regardless of timezone
    const callArgs = mockFetchStats.mock.calls[0][1];
    expect(callArgs.DateFrom).toBe(callArgs.DateTo);
  });
});

describe("GET /api/nba/games/[id]", () => {
  it("returns box score with team and player data", async () => {
    mockFetchStatsMulti.mockResolvedValue(MOCK_BOXSCORE_SETS);
    const { default: handler } = await import("src/pages/api/nba/games/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "22500850" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.home.abbrev).toBe("LAL");
    expect(res._json.data.away.abbrev).toBe("BOS");
    expect(res._json.data.home_score).toBe(118);
    expect(res._json.data.box_score.LAL).toHaveLength(2);
    expect(res._json.data.box_score.BOS).toHaveLength(1);
  });

  it("returns 400 for non-numeric ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/games/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "abc" }), res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain("Invalid");
  });

  it("returns 404 when game not found", async () => {
    mockFetchStatsMulti.mockResolvedValue({ TeamStats: [], PlayerStats: [] });
    const { default: handler } = await import("src/pages/api/nba/games/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "9999999999" }), res);
    expect(res._status).toBe(404);
  });
});

describe("GET /api/nba/players/[id]", () => {
  it("returns player detail with identity and season stats", async () => {
    // First query: nba_players identity row; second: season stats (from getPlayers)
    mockSql
      .mockResolvedValueOnce([
        { player_id: 2544, player_name: "LeBron James", team_id: 1610612747, team_abbreviation: "LAL", position: "F", age: 41 },
      ])
      .mockResolvedValueOnce(DB_PLAYER_ROWS);

    const { default: handler } = await import("src/pages/api/nba/players/[id]/index");
    const res = createMockRes();
    await handler(createMockReq({ id: "2544" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.name).toBe("LeBron James");
    expect(res._json.data.pos).toBe("F");
    expect(res._json.data.team).toBe("LAL");
    expect(res._json.data.age).toBe(41);
    expect(res._json.data.ppg).toBe(24.8);
  });

  it("returns 400 for non-numeric ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/players/[id]/index");
    const res = createMockRes();
    await handler(createMockReq({ id: "abc" }), res);
    expect(res._status).toBe(400);
  });

  it("returns 404 when player not found", async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import("src/pages/api/nba/players/[id]/index");
    const res = createMockRes();
    await handler(createMockReq({ id: "99999" }), res);
    expect(res._status).toBe(404);
  });
});

describe("GET /api/nba/players/[id]/gamelog", () => {
  it("returns game-by-game stats limited by n param", async () => {
    mockFetchStats.mockResolvedValue(MOCK_GAMELOG_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/[id]/gamelog");
    const res = createMockRes();
    await handler(createMockReq({ id: "2544", n: "2" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(2);
    expect(res._json.data[0].pts).toBe(32);
    expect(res._json.data[0].fg_pct).toBe(0.545);
  });

  it("defaults to 10 games when n not specified", async () => {
    mockFetchStats.mockResolvedValue(MOCK_GAMELOG_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/[id]/gamelog");
    const res = createMockRes();
    await handler(createMockReq({ id: "2544" }), res);
    // Only 3 games in mock, so returns all 3
    expect(res._json.data).toHaveLength(3);
  });

  it("returns 400 for invalid player ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/players/[id]/gamelog");
    const res = createMockRes();
    await handler(createMockReq({ id: "notanumber" }), res);
    expect(res._status).toBe(400);
  });
});

describe("GET /api/nba/teams/[id]", () => {
  it("returns team detail with roster", async () => {
    // First query: nba_teams (from getTeams), second: roster players
    mockSql
      .mockResolvedValueOnce(DB_TEAM_ROWS)
      .mockResolvedValueOnce([
        // Mocked in the query's ORDER BY player_name order
        { player_id: 203076, player_name: "Anthony Davis", position: "F-C", age: 33 },
        { player_id: 2544, player_name: "LeBron James", position: "F", age: 41 },
      ]);

    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "1610612747" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.name).toBe("Lakers");
    expect(res._json.data.roster).toHaveLength(2);
    expect(res._json.data.roster[0].name).toBe("Anthony Davis"); // ordered by name
  });

  it("returns 400 for non-numeric ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "xyz" }), res);
    expect(res._status).toBe(400);
  });

  it("returns 404 for unknown team", async () => {
    mockSql.mockResolvedValue(DB_TEAM_ROWS);
    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "999" }), res);
    expect(res._status).toBe(404);
  });
});

describe("Error boundary: data-layer failures", () => {
  it("DB-backed routes return 503 with error message on DB failure", async () => {
    mockSql.mockRejectedValue(new Error("Neon connection refused"));

    const routes = [
      { path: "src/pages/api/nba/players/index", req: createMockReq() },
      { path: "src/pages/api/nba/teams/index", req: createMockReq() },
      { path: "src/pages/api/nba/standings", req: createMockReq() },
    ];

    for (const route of routes) {
      const mod = await import(route.path);
      const res = createMockRes();
      await mod.default(route.req, res);
      expect(res._status).toBe(503);
      expect(res._json.error).toBeTruthy();
    }
  });

  it("game routes still 503 on stats.nba.com failure", async () => {
    const networkError = new Error("stats.nba.com leaguegamefinder returned 403");
    mockFetchStats.mockRejectedValue(networkError);
    mockFetchStatsMulti.mockRejectedValue(networkError);

    const { default: handler } = await import("src/pages/api/nba/games/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
    expect(res._json.error).toBeTruthy();
  });
});

describe("Data transform correctness", () => {
  it("PPG rounds to 1 decimal place", async () => {
    mockSql.mockResolvedValue([{ ...DB_PLAYER_ROWS[0], ppg: 24.85 }]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    // 24.85 rounded to 1 decimal = 24.9
    expect(res._json.data[0].ppg).toBe(24.9);
  });

  it("win pct rounds to 3 decimal places in standings", async () => {
    mockSql.mockResolvedValue([{ ...DB_STANDINGS_ROWS[0], win_pct: 0.6111 }]);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._json.data[0].pct).toBe(0.611);
  });

  it("handles null stat values gracefully", async () => {
    mockSql.mockResolvedValue([
      { player_id: 1, player_name: "Rookie", position: null, age: null, team_id: 1610612747, games_played: 5, mpg: null, ppg: null, rpg: null, apg: null, spg: null, bpg: null, topg: null, fga: null, fg3a: null, fta: null, fg_pct: null, fg3_pct: null, ft_pct: null },
    ]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._json.data[0].ppg).toBe(0);
    expect(res._json.data[0].rpg).toBe(0);
    expect(res._json.data[0].apg).toBe(0);
    expect(res._json.data[0].age).toBeNull();
  });
});
