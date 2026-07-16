/**
 * The Rig Report — demo case file.
 *
 * Served when there is no odds data in Neon and no external API key, so the
 * page always renders. Every number here is realistic but invented; the API
 * labels the payload source: "demo" and the page displays that prominently.
 *
 * The four games are chosen to exercise every detector at least once.
 */
import type { GameCase } from "src/lib/rig/suspicion";

export const DEMO_CASES: GameCase[] = [
  // 1. Heavy favorite lost outright (settled) — base-rate lesson.
  {
    eventId: "demo-collapse",
    homeTeam: "Boston Celtics",
    awayTeam: "Charlotte Hornets",
    // 19:10 ET — also prime time, but Charlotte/Boston isn't the star-market pair.
    commenceTime: "2026-04-14T23:10:00Z",
    books: [
      { bookmaker: "draftkings", spreadHome: -12.5, homeMl: -650, awayMl: 475 },
      { bookmaker: "fanduel", spreadHome: -12.5, homeMl: -640, awayMl: 480 },
      { bookmaker: "betmgm", spreadHome: -13.0, homeMl: -675, awayMl: 500 },
    ],
    openingSpread: -12.0,
    closingSpread: -12.5,
    modelSpread: -11.4,
    actualMargin: -4, // home favorite lost by 4
    gameLabel: null,
  },

  // 2. Big line move — steam / information-aggregation lesson.
  {
    eventId: "demo-steam",
    homeTeam: "Oklahoma City Thunder",
    awayTeam: "Memphis Grizzlies",
    commenceTime: "2026-04-15T00:00:00Z", // 20:00 ET
    books: [
      { bookmaker: "draftkings", spreadHome: -7.0, homeMl: -290, awayMl: 235 },
      { bookmaker: "fanduel", spreadHome: -7.0, homeMl: -285, awayMl: 230 },
      { bookmaker: "caesars", spreadHome: -6.5, homeMl: -270, awayMl: 225 },
    ],
    openingSpread: -3.5,
    closingSpread: -7.0,
    modelSpread: -6.2,
    actualMargin: null,
    gameLabel: null,
  },

  // 3. Model vs Vegas disagreement + books disagreeing with each other.
  {
    eventId: "demo-dissent",
    homeTeam: "Sacramento Kings",
    awayTeam: "Portland Trail Blazers",
    commenceTime: "2026-04-15T02:00:00Z", // 22:00 ET
    books: [
      { bookmaker: "draftkings", spreadHome: 3.5, homeMl: 140, awayMl: -165 },
      { bookmaker: "fanduel", spreadHome: 4.5, homeMl: 155, awayMl: -180 },
      { bookmaker: "betmgm", spreadHome: 5.5, homeMl: 170, awayMl: -200 },
      { bookmaker: "caesars", spreadHome: 3.5, homeMl: 145, awayMl: -170 },
    ],
    openingSpread: 4.0,
    closingSpread: 4.5,
    modelSpread: -1.5, // model likes the home dog by 6 vs the consensus
    actualMargin: null,
    gameLabel: null,
  },

  // 4. Star-market teams in prime time, framed as a Game 7 — selection-bias lesson.
  {
    eventId: "demo-narrative",
    homeTeam: "Los Angeles Lakers",
    awayTeam: "Golden State Warriors",
    commenceTime: "2026-04-19T00:30:00Z", // 20:30 ET
    books: [
      { bookmaker: "draftkings", spreadHome: -2.5, homeMl: -140, awayMl: 120 },
      { bookmaker: "fanduel", spreadHome: -2.5, homeMl: -142, awayMl: 122 },
      { bookmaker: "betmgm", spreadHome: -3.0, homeMl: -145, awayMl: 125 },
    ],
    openingSpread: -2.0,
    closingSpread: -2.5,
    modelSpread: -3.1,
    actualMargin: null,
    gameLabel: "Game 7",
  },
];
