/**
 * The Rig Report — suspicion engine.
 *
 * Satirical "Entertainment Integrity Bureau" detectors. Each detector looks
 * at real numbers from a game and, when a pattern *looks* rigged, files an
 * exhibit with three parts:
 *
 *   conspiracy — the Bureau's breathless claim (the joke)
 *   sober      — what the number actually means statistically (the lesson)
 *   lesson     — the named analytics shortcoming it demonstrates
 *
 * Everything is deterministic given its inputs. Detectors punch at processes
 * (book margins, scheduling incentives, TV narratives) — never at named
 * referees or players.
 */
import { detectEdge } from "src/lib/nba/predictions/edge-detector";
import { impliedProbability, round } from "src/lib/rig/odds-math";

export interface BookLine {
  bookmaker: string;
  spreadHome: number;
  homeMl: number | null;
  awayMl: number | null;
}

export interface GameCase {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  /** ISO timestamp of tip-off. */
  commenceTime: string;
  /** Current/closing lines, one per bookmaker. */
  books: BookLine[];
  /** Earliest captured consensus home spread, if we have line history. */
  openingSpread?: number | null;
  /** Latest consensus home spread. */
  closingSpread?: number | null;
  /** Model's predicted home spread (negative = home favored), if simulated. */
  modelSpread?: number | null;
  /** Final margin home - away, if the game is settled. */
  actualMargin?: number | null;
  /** Optional narrative label, e.g. "Game 7". */
  gameLabel?: string | null;
}

export interface Exhibit {
  id: string;
  title: string;
  /** Headline number for the exhibit card, e.g. "83% favorite lost". */
  stat: string;
  conspiracy: string;
  sober: string;
  lesson: string;
  /** 0–100 contribution to the Rigged-o-Meter. */
  severity: number;
}

export interface SuspicionReport {
  /** 0–100. Higher = more "rigged-looking" (which is the joke). */
  suspicionScore: number;
  exhibits: Exhibit[];
}

/** Teams the Bureau considers "television-revenue assets". Aggregate-market
 *  satire only — this is a list of big media markets, not an accusation. */
export const STAR_MARKET_TEAMS = [
  "Los Angeles Lakers",
  "Golden State Warriors",
  "Boston Celtics",
  "New York Knicks",
  "Chicago Bulls",
  "Miami Heat",
  "Dallas Mavericks",
  "Philadelphia 76ers",
  "Los Angeles Clippers",
  "Brooklyn Nets",
];

/** Hour of day in US Eastern time, deterministic for a given ISO string. */
export function easternHour(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(d);
  return parseInt(h, 10) % 24;
}

/** Median home spread across books. */
export function consensusHomeSpread(books: BookLine[]): number | null {
  const spreads = books
    .map((b) => b.spreadHome)
    .filter((s): s is number => Number.isFinite(s))
    .sort((a, b) => a - b);
  if (spreads.length === 0) return null;
  const mid = Math.floor(spreads.length / 2);
  return spreads.length % 2 === 0 ? (spreads[mid - 1] + spreads[mid]) / 2 : spreads[mid];
}

function fmtSpread(n: number): string {
  return (n > 0 ? "+" : "") + n.toFixed(1);
}

function fmtMl(n: number): string {
  return (n > 0 ? "+" : "") + String(n);
}

// ---------------------------------------------------------------------------
// Detectors. Each returns an Exhibit or null.
// ---------------------------------------------------------------------------

/** A moneyline favorite at >= 70% implied probability lost outright. */
export function detectHeavyFavoriteLoss(game: GameCase): Exhibit | null {
  if (game.actualMargin == null || game.actualMargin === 0) return null;
  const book = game.books.find((b) => b.homeMl != null && b.awayMl != null);
  if (!book || book.homeMl == null || book.awayMl == null) return null;

  const homeProb = impliedProbability(book.homeMl);
  const awayProb = impliedProbability(book.awayMl);
  const homeIsFav = homeProb >= awayProb;
  const favProb = homeIsFav ? homeProb : awayProb;
  const favTeam = homeIsFav ? game.homeTeam : game.awayTeam;
  const favMl = homeIsFav ? book.homeMl : book.awayMl;
  const favLost = homeIsFav ? game.actualMargin < 0 : game.actualMargin > 0;

  if (favProb < 0.7 || !favLost) return null;

  const pct = round(favProb * 100, 0);
  const lossOdds = Math.max(2, Math.round(1 / (1 - favProb)));
  return {
    id: "heavy-favorite-loss",
    title: "Exhibit A: The Collapse",
    stat: `${pct}% favorite lost outright`,
    conspiracy: `${favTeam} closed at ${fmtMl(favMl)} — the market said ${pct}% — and then simply forgot how to play basketball. The Bureau notes that an unexpected result generates approximately 100% more content than an expected one.`,
    sober: `A ${pct}% favorite loses about 1 game in ${lossOdds}. The NBA plays 1,230 regular-season games a year, so upsets like this are not anomalies — they're the schedule working as probability requires. Remembering the shocking ones and forgetting the routine ones is how this pattern gets invented.`,
    lesson:
      "Base rates: a high win probability is not a guarantee, and rare-looking events are common at league scale. Narratives are built from memorable samples, not representative ones.",
    severity: Math.round(20 + (favProb - 0.7) * 100), // 20 at 70%, 40 at 90%
  };
}

/** The consensus spread moved 2+ points between open and close. */
export function detectBigLineMove(game: GameCase): Exhibit | null {
  if (game.openingSpread == null || game.closingSpread == null) return null;
  const move = game.closingSpread - game.openingSpread;
  if (Math.abs(move) < 2) return null;

  const dir = move < 0 ? game.homeTeam : game.awayTeam;
  return {
    id: "big-line-move",
    title: "Exhibit B: Somebody Knew Something",
    stat: `Line moved ${round(Math.abs(move), 1)} pts (${fmtSpread(game.openingSpread)} → ${fmtSpread(game.closingSpread)})`,
    conspiracy: `The spread lurched ${round(Math.abs(move), 1)} points toward ${dir} before tip-off. Money doesn't move by itself. The Bureau asks: who called whom, and on which phone?`,
    sober: `Lines move because information arrives — injury reports, lineup news, and sharp bettors whose action the books respect. A big move is the market updating in public, and closing lines are measurably more accurate than opening lines. If anything, the move is evidence the market *works*.`,
    lesson:
      "Line movement is information aggregation, not manipulation. The opening number is a first draft; treating any single snapshot of odds as 'the truth' ignores that odds are a living estimate.",
    severity: Math.min(35, Math.round(Math.abs(move) * 8)),
  };
}

/** Our Monte Carlo model disagrees with Vegas by more than 3 points. */
export function detectModelDisagreement(game: GameCase): Exhibit | null {
  if (game.modelSpread == null) return null;
  const vegas = game.closingSpread ?? consensusHomeSpread(game.books);
  if (vegas == null) return null;

  const { edge, direction } = detectEdge(game.modelSpread, vegas);
  if (Math.abs(edge) <= 3) return null;

  const likedTeam = direction === "home" ? game.homeTeam : game.awayTeam;
  return {
    id: "model-vs-vegas",
    title: "Exhibit C: The Robot Dissents",
    stat: `Model vs Vegas gap: ${Math.abs(edge)} pts`,
    conspiracy: `Our in-house simulation — which has no television contract — likes ${likedTeam} by ${Math.abs(edge)} points more than the sportsbooks do. When the machine and the market disagree, the Bureau assumes the market has a motive.`,
    sober: `A single-game gap between one model and the market is almost always model error, not market corruption. NBA spread models (including this one) carry a mean absolute error near 9–10 points per game; a ${Math.abs(edge)}-point disagreement is well inside that noise. Vegas closing lines remain the hardest public benchmark to beat.`,
    lesson:
      "Model humility: an 'edge' on paper must survive its own error bars. Most detected edges are variance in the model, which is why edge-hunters track accuracy over hundreds of games, not one.",
    severity: Math.min(25, Math.round(Math.abs(edge) * 4)),
  };
}

/** Prime-time slot + star-market team, or a "Game 7"-style label. */
export function detectRevenueConvenience(game: GameCase): Exhibit | null {
  const hour = easternHour(game.commenceTime);
  const primeTime = hour >= 19 && hour <= 22;
  const starTeams = [game.homeTeam, game.awayTeam].filter((t) =>
    STAR_MARKET_TEAMS.includes(t)
  );
  const isGame7 = /game\s*7/i.test(game.gameLabel ?? "");

  if (!isGame7 && !(primeTime && starTeams.length > 0)) return null;

  const flavor = isGame7
    ? "A Game 7 — the single most profitable broadcast in team sports — has materialized, again."
    : `${starTeams.join(" and ")} in the ${hour}:00 ET window, where advertising rates are highest.`;

  return {
    id: "revenue-convenient",
    title: "Exhibit D: Follow the Broadcast Money",
    stat: isGame7 ? "Game 7 detected" : `Star market × prime time (${hour}:00 ET)`,
    conspiracy: `${flavor} The Bureau finds it remarkable how often the league's most profitable outcomes are also its actual outcomes.`,
    sober: `This one is selection bias you can see being performed: leagues *openly* schedule big-market teams into national prime-time windows before the season starts, so "star team in prime time" is a certainty, not a coincidence. And series that reach Game 7 do so at rates consistent with evenly matched teams flipping close games — you only remember the sample that survived to a seventh game.`,
    lesson:
      "Survivorship and selection bias: when the process visibly selects for a pattern (scheduling, seeding, matchup popularity), observing the pattern is not evidence of a hidden hand.",
    severity: isGame7 ? 20 : 12,
  };
}

/** Bookmakers' spreads disagree with each other by 1.5+ points. */
export function detectBooksDisagree(game: GameCase): Exhibit | null {
  const spreads = game.books
    .map((b) => b.spreadHome)
    .filter((s): s is number => Number.isFinite(s));
  if (spreads.length < 2) return null;
  const spreadOfSpreads = Math.max(...spreads) - Math.min(...spreads);
  if (spreadOfSpreads < 1.5) return null;

  return {
    id: "books-disagree",
    title: "Exhibit E: They Can't Keep Their Story Straight",
    stat: `${round(spreadOfSpreads, 1)}-pt gap between books (${spreads.length} books)`,
    conspiracy: `${game.books.length} licensed sportsbooks looked at the same two teams and published numbers ${round(spreadOfSpreads, 1)} points apart. If the fix were in, gentlemen, you'd think someone would have circulated a memo.`,
    sober: `Books aren't a cartel sharing one number — each manages its own risk. A book heavy with liability on one side shades its line to attract balancing money, and lines also differ by when they were last updated. Disagreement between books is exactly what a decentralized market looks like, and it's why line-shopping is the one genuinely free edge a bettor has.`,
    lesson:
      "There is no single 'true line.' Odds are inventory-management prices, not probability oracles — comparing books reveals the margin of disagreement hiding inside every 'favorability rating.'",
    severity: Math.min(20, Math.round(spreadOfSpreads * 6)),
  };
}

const DETECTORS: Array<(g: GameCase) => Exhibit | null> = [
  detectHeavyFavoriteLoss,
  detectBigLineMove,
  detectModelDisagreement,
  detectRevenueConvenience,
  detectBooksDisagree,
];

/**
 * Run every detector against a game and produce the Bureau's official
 * suspicion report. Score = 5 (ambient institutional paranoia) + the sum of
 * exhibit severities, capped at 100.
 */
export function suspicionEngine(game: GameCase): SuspicionReport {
  const exhibits = DETECTORS.map((d) => d(game)).filter(
    (e): e is Exhibit => e !== null
  );
  const raw = 5 + exhibits.reduce((sum, e) => sum + e.severity, 0);
  return {
    suspicionScore: Math.max(0, Math.min(100, raw)),
    exhibits,
  };
}
