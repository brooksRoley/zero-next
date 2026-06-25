/**
 * API Route Contract Tests
 * Mocks fetchStats/fetchStatsMulti to test route handler transforms,
 * error handling, and parameter validation without hitting stats.nba.com.
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

const MOCK_PLAYER_ROWS = [
  { PLAYER_ID: 2544, PLAYER_NAME: "LeBron James", TEAM_ID: 1610612747, TEAM_ABBREVIATION: "LAL", GP: 62, MIN: 35.2, PTS: 24.8, REB: 7.1, AST: 8.3, STL: 1.2, BLK: 0.6, TOV: 3.4, FGM: 9.2, FGA: 18.6, FG_PCT: 0.495, FG3M: 2.1, FG3A: 5.8, FG3_PCT: 0.362, FTM: 4.3, FTA: 5.6, FT_PCT: 0.768, PLUS_MINUS: 3.2 },
  { PLAYER_ID: 203076, PLAYER_NAME: "Anthony Davis", TEAM_ID: 1610612747, TEAM_ABBREVIATION: "LAL", GP: 58, MIN: 34.1, PTS: 26.3, REB: 11.9, AST: 3.2, STL: 1.3, BLK: 2.1, TOV: 2.1, FGM: 10.1, FGA: 19.4, FG_PCT: 0.521, FG3M: 1.2, FG3A: 3.5, FG3_PCT: 0.343, FTM: 4.9, FTA: 6.3, FT_PCT: 0.778, PLUS_MINUS: 5.1 },
];

const MOCK_STANDINGS_ROWS = [
  { TeamID: 1610612747, TeamName: "Lakers", TeamCity: "Los Angeles", Conference: "West", Division: "Pacific", PlayoffRank: 5, WINS: 44, LOSSES: 28, WinPCT: 0.611 },
  { TeamID: 1610612738, TeamName: "Celtics", TeamCity: "Boston", Conference: "East", Division: "Atlantic", PlayoffRank: 1, WINS: 54, LOSSES: 18, WinPCT: 0.75 },
  { TeamID: 1610612760, TeamName: "Thunder", TeamCity: "Oklahoma City", Conference: "West", Division: "Northwest", PlayoffRank: 1, WINS: 58, LOSSES: 14, WinPCT: 0.806 },
];

const MOCK_GAME_FINDER_ROWS = [
  { GAME_ID: "0022500850", GAME_DATE: "2026-03-15", MATCHUP: "LAL vs. BOS", TEAM_ABBREVIATION: "LAL", WL: "W", PTS: 118 },
  { GAME_ID: "0022500850", GAME_DATE: "2026-03-15", MATCHUP: "BOS @ LAL", TEAM_ABBREVIATION: "BOS", WL: "L", PTS: 105 },
  { GAME_ID: "0022500855", GAME_DATE: "2026-03-17", MATCHUP: "DEN vs. LAL", TEAM_ABBREVIATION: "DEN", WL: "W", PTS: 112 },
  { GAME_ID: "0022500855", GAME_DATE: "2026-03-17", MATCHUP: "LAL @ DEN", TEAM_ABBREVIATION: "LAL", WL: "L", PTS: 105 },
];

const MOCK_PLAYER_INFO_ROWS = [
  { DISPLAY_FIRST_LAST: "LeBron James", TEAM_ID: 1610612747, POSITION: "Forward", JERSEY: "23", HEIGHT: "6-9", WEIGHT: "250", COUNTRY: "USA" },
];

const MOCK_GAMELOG_ROWS = [
  { GAME_DATE: "MAR 15, 2026", MATCHUP: "LAL vs. BOS", WL: "W", PTS: 32, REB: 8, AST: 10, FG_PCT: 0.545, MIN: "36:00" },
  { GAME_DATE: "MAR 17, 2026", MATCHUP: "LAL @ DEN", WL: "L", PTS: 22, REB: 6, AST: 7, FG_PCT: 0.4, MIN: "38:00" },
  { GAME_DATE: "MAR 19, 2026", MATCHUP: "LAL vs. GSW", WL: "W", PTS: 28, REB: 7, AST: 9, FG_PCT: 0.48, MIN: "35:00" },
];

const MOCK_ROSTER_ROWS = [
  { PLAYER_ID: 2544, PLAYER: "LeBron James", POSITION: "F", NUM: "23" },
  { PLAYER_ID: 203076, PLAYER: "Anthony Davis", POSITION: "F-C", NUM: "3" },
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
});

describe("GET /api/nba/players", () => {
  it("transforms player rows into API response shape", async () => {
    mockFetchStats.mockResolvedValue(MOCK_PLAYER_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(2);
    expect(res._json.data[0]).toEqual({
      id: 2544,
      name: "LeBron James",
      team_id: 1610612747,
      pos: "",
      ppg: 24.8,
      rpg: 7.1,
      apg: 8.3,
    });
    expect(res._json._meta.endpoint).toBe("players");
  });

  it("filters by team_id query param", async () => {
    mockFetchStats.mockResolvedValue(MOCK_PLAYER_ROWS);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq({ team_id: "1610612747" }), res);
    expect(res._json.data).toHaveLength(2);

    // Filter for a team that doesn't exist
    const res2 = createMockRes();
    await handler(createMockReq({ team_id: "999" }), res2);
    expect(res2._json.data).toHaveLength(0);
  });

  it("returns 503 when fetchStats throws", async () => {
    mockFetchStats.mockRejectedValue(new Error("stats.nba.com returned 403"));
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
    expect(res._json.error).toContain("403");
  });

  it("handles empty response from stats.nba.com", async () => {
    mockFetchStats.mockResolvedValue([]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(0);
  });
});

describe("GET /api/nba/teams", () => {
  it("transforms standings rows into team list", async () => {
    mockFetchStats.mockResolvedValue(MOCK_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/teams/index");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    expect(res._json.data).toHaveLength(3);
    const lakers = res._json.data.find((t: any) => t.id === 1610612747);
    expect(lakers.name).toBe("Lakers");
    expect(lakers.city).toBe("Los Angeles");
    expect(lakers.conference).toBe("West");
  });

  it("returns 503 on fetch failure", async () => {
    mockFetchStats.mockRejectedValue(new Error("timeout"));
    const { default: handler } = await import("src/pages/api/nba/teams/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
  });
});

describe("GET /api/nba/standings", () => {
  it("returns ranked standings sorted by win pct", async () => {
    mockFetchStats.mockResolvedValue(MOCK_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res._status).toBe(200);
    const data = res._json.data;
    expect(data[0].pct).toBeGreaterThanOrEqual(data[1].pct);
    expect(data[0].rank).toBe(1);
    expect(data[0].wins).toBe(58); // Thunder first
  });

  it("filters by conference", async () => {
    mockFetchStats.mockResolvedValue(MOCK_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq({ conference: "East" }), res);

    expect(res._json.data).toHaveLength(1);
    expect(res._json.data[0].name).toBe("Celtics");
  });

  it("conference filter is case-insensitive", async () => {
    mockFetchStats.mockResolvedValue(MOCK_STANDINGS_ROWS);
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
  it("returns player detail with bio and stats", async () => {
    // First call: commonplayerinfo, second call: leaguedashplayerstats (from getPlayers)
    mockFetchStats
      .mockResolvedValueOnce(MOCK_PLAYER_INFO_ROWS)
      .mockResolvedValueOnce(MOCK_PLAYER_ROWS);

    const { default: handler } = await import("src/pages/api/nba/players/[id]/index");
    const res = createMockRes();
    await handler(createMockReq({ id: "2544" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.name).toBe("LeBron James");
    expect(res._json.data.pos).toBe("Forward");
    expect(res._json.data.height).toBe("6-9");
    expect(res._json.data.ppg).toBe(24.8);
  });

  it("returns 400 for non-numeric ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/players/[id]/index");
    const res = createMockRes();
    await handler(createMockReq({ id: "abc" }), res);
    expect(res._status).toBe(400);
  });

  it("returns 404 when player not found", async () => {
    mockFetchStats.mockResolvedValue([]);
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
    // First call: standings (for team lookup), second call: roster
    mockFetchStats
      .mockResolvedValueOnce(MOCK_STANDINGS_ROWS)
      .mockResolvedValueOnce(MOCK_ROSTER_ROWS);

    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "1610612747" }), res);

    expect(res._status).toBe(200);
    expect(res._json.data.name).toBe("Lakers");
    expect(res._json.data.roster).toHaveLength(2);
    expect(res._json.data.roster[0].name).toBe("LeBron James");
  });

  it("returns 400 for non-numeric ID", async () => {
    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "xyz" }), res);
    expect(res._status).toBe(400);
  });

  it("returns 404 for unknown team", async () => {
    mockFetchStats.mockResolvedValue(MOCK_STANDINGS_ROWS);
    const { default: handler } = await import("src/pages/api/nba/teams/[id]");
    const res = createMockRes();
    await handler(createMockReq({ id: "999" }), res);
    expect(res._status).toBe(404);
  });
});

describe("Error boundary: stats.nba.com failures", () => {
  it("all routes return 503 with error message on network failure", async () => {
    const networkError = new Error("stats.nba.com leaguedashplayerstats returned 403");
    mockFetchStats.mockRejectedValue(networkError);
    mockFetchStatsMulti.mockRejectedValue(networkError);

    const routes = [
      { path: "src/pages/api/nba/players/index", req: createMockReq() },
      { path: "src/pages/api/nba/teams/index", req: createMockReq() },
      { path: "src/pages/api/nba/standings", req: createMockReq() },
      { path: "src/pages/api/nba/games/index", req: createMockReq() },
    ];

    for (const route of routes) {
      const mod = await import(route.path);
      const res = createMockRes();
      await mod.default(route.req, res);
      expect(res._status).toBe(503);
      expect(res._json.error).toBeTruthy();
    }
  });

  it("route handlers propagate timeout errors", async () => {
    mockFetchStats.mockRejectedValue(new Error("AbortError: The operation was aborted"));
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._status).toBe(503);
    expect(res._json.error).toContain("aborted");
  });
});

describe("Data transform correctness", () => {
  it("PPG rounds to 1 decimal place", async () => {
    mockFetchStats.mockResolvedValue([
      { ...MOCK_PLAYER_ROWS[0], PTS: 24.85 },
    ]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    // 24.85 rounded to 1 decimal = 24.9
    expect(res._json.data[0].ppg).toBe(24.9);
  });

  it("win pct rounds to 3 decimal places in standings", async () => {
    mockFetchStats.mockResolvedValue([
      { ...MOCK_STANDINGS_ROWS[0], WinPCT: 0.6111 },
    ]);
    const { default: handler } = await import("src/pages/api/nba/standings");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._json.data[0].pct).toBe(0.611);
  });

  it("handles null stat values gracefully", async () => {
    mockFetchStats.mockResolvedValue([
      { PLAYER_ID: 1, PLAYER_NAME: "Rookie", TEAM_ID: 1610612747, TEAM_ABBREVIATION: "LAL", GP: 5, PTS: null, REB: null, AST: null },
    ]);
    const { default: handler } = await import("src/pages/api/nba/players/index");
    const res = createMockRes();
    await handler(createMockReq(), res);
    expect(res._json.data[0].ppg).toBe(0);
    expect(res._json.data[0].rpg).toBe(0);
    expect(res._json.data[0].apg).toBe(0);
  });
});
