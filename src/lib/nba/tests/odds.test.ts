import { describe, it, expect } from "vitest";
import { parseOddsResponse, OddsSchema, consensusSpread, type OddsRow } from "../odds";

const SAMPLE_ODDS_API_RESPONSE = {
  id: "abc123",
  sport_key: "basketball_nba",
  sport_title: "NBA",
  commence_time: "2026-04-22T23:30:00Z",
  home_team: "Los Angeles Lakers",
  away_team: "Denver Nuggets",
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Los Angeles Lakers", price: -110, point: -3.5 },
            { name: "Denver Nuggets", price: -110, point: 3.5 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", price: -110, point: 224.5 },
            { name: "Under", price: -110, point: 224.5 },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      title: "FanDuel",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Los Angeles Lakers", price: -108, point: -3.0 },
            { name: "Denver Nuggets", price: -112, point: 3.0 },
          ],
        },
      ],
    },
  ],
};

describe("parseOddsResponse", () => {
  it("extracts spread rows from API response", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dk = rows.find((r) => r.bookmaker === "draftkings");
    expect(dk).toBeDefined();
    expect(dk!.spread_home).toBe(-3.5);
    expect(dk!.spread_away).toBe(3.5);
    expect(dk!.over_under).toBe(224.5);
  });

  it("handles bookmaker with no totals market", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    const fd = rows.find((r) => r.bookmaker === "fanduel");
    expect(fd).toBeDefined();
    expect(fd!.spread_home).toBe(-3.0);
    expect(fd!.over_under).toBeNull();
  });

  it("includes home and away team names", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    expect(rows[0].home_team).toBe("Los Angeles Lakers");
    expect(rows[0].away_team).toBe("Denver Nuggets");
  });

  it("validates with OddsSchema", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    for (const r of rows) {
      expect(OddsSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("consensus spread", () => {
  it("calculates median spread across bookmakers", () => {
    const rows: OddsRow[] = [
      { event_id: "abc", bookmaker: "dk", spread_home: -3.5, spread_away: 3.5, over_under: 224.5, home_ml: -150, away_ml: 130, home_team: "LAL", away_team: "DEN", commence_time: "" },
      { event_id: "abc", bookmaker: "fd", spread_home: -3.0, spread_away: 3.0, over_under: null, home_ml: -145, away_ml: 125, home_team: "LAL", away_team: "DEN", commence_time: "" },
      { event_id: "abc", bookmaker: "mgm", spread_home: -4.0, spread_away: 4.0, over_under: 225, home_ml: -155, away_ml: 135, home_team: "LAL", away_team: "DEN", commence_time: "" },
    ];
    const consensus = consensusSpread(rows);
    expect(consensus).toBe(-3.5); // median of [-4, -3.5, -3]
  });
});
