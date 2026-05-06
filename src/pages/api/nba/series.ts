import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";

/**
 * Parse the playoff round from an NBA game ID.
 *
 * Playoff game IDs follow the format: 0042XYYZZZ
 *   004  = league prefix
 *   2    = last digit of season year
 *   X    = round (1=First Round, 2=Conf Semis, 3=Conf Finals, 4=Finals)
 *   YY   = series number within the round
 *   ZZZ  = game number within the series (1-indexed)
 *
 * Regular-season IDs start with 002, so we only parse IDs starting with 004.
 */
function parsePlayoffGameId(gameId: string): { round: number; seriesNum: number; gameInSeries: number } | null {
  // Playoff IDs: 10 chars, starts with "004"
  if (!gameId || gameId.length !== 10 || !gameId.startsWith("004")) return null;
  const round = parseInt(gameId[4], 10);
  const seriesNum = parseInt(gameId.slice(5, 7), 10);
  const gameInSeries = parseInt(gameId.slice(7), 10);
  if (isNaN(round) || isNaN(seriesNum) || isNaN(gameInSeries)) return null;
  return { round, seriesNum, gameInSeries };
}

const ROUND_NAMES: Record<number, string> = {
  1: "First Round",
  2: "Conference Semifinals",
  3: "Conference Finals",
  4: "NBA Finals",
};

/**
 * Normalize a matchup string to a canonical sorted pair key.
 *
 * leaguegamefinder returns matchups from the perspective of the queried team:
 *   "LAL vs. GSW"  (LAL is home)
 *   "GSW @ LAL"    (GSW is away, LAL is home)
 *
 * We extract the two abbreviations and sort them to form a stable key.
 */
function normalizeMatchupKey(matchup: string): string {
  // "LAL vs. GSW" or "GSW @ LAL"
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  if (parts.length !== 2) return matchup;
  return [parts[0].trim(), parts[1].trim()].sort().join("-");
}

interface TeamRecord {
  id: number;
  name: string;
  abbreviation: string;
  wins: number;
}

interface SeriesResult {
  seriesKey: string;
  matchup: string;
  roundNumber: number;
  roundName: string;
  teamA: TeamRecord;
  teamB: TeamRecord;
  gamesPlayed: number;
  maxGameInSeries: number;
  isElimination: boolean;
  seriesStatus: string;
}

async function fetchPlayoffGames() {
  const season = currentNbaSeason();
  return fetchStats("leaguegamefinder", {
    Season: season,
    SeasonType: "Playoffs",
    LeagueID: "00",
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const rows = await cached("playoff_games", fetchPlayoffGames, 300);

    if (!rows.length) {
      return res.status(200).json({ series: [], season: currentNbaSeason(), _meta: { count: 0 } });
    }

    // Map: normalizedKey -> { teams: Map<teamId, record>, round, maxGameInSeries, matchupLabel }
    interface SeriesAccumulator {
      matchupKey: string;
      matchupLabel: string;
      round: number;
      teams: Map<number, { id: number; name: string; abbreviation: string; wins: number }>;
      gamesPlayed: number;
      maxGameInSeries: number;
    }

    const seriesMap = new Map<string, SeriesAccumulator>();

    for (const row of rows) {
      const gameId = String(row.GAME_ID ?? "");
      const parsed = parsePlayoffGameId(gameId);
      if (!parsed) continue; // skip non-playoff game IDs

      const matchup = String(row.MATCHUP ?? "");
      const normalizedKey = normalizeMatchupKey(matchup);
      const teamId = Number(row.TEAM_ID);
      const teamName = String(row.TEAM_NAME ?? "");
      const teamAbbr = String(row.TEAM_ABBREVIATION ?? "");
      const wl = String(row.WL ?? "");

      if (!seriesMap.has(normalizedKey)) {
        seriesMap.set(normalizedKey, {
          matchupKey: normalizedKey,
          matchupLabel: "", // filled below
          round: parsed.round,
          teams: new Map(),
          gamesPlayed: 0,
          maxGameInSeries: 0,
        });
      }

      const acc = seriesMap.get(normalizedKey)!;

      // Build a human-readable matchup label (e.g. "LAL vs. GSW") from the first vs. form we see
      if (!acc.matchupLabel && matchup.includes("vs.")) {
        acc.matchupLabel = matchup;
      }

      // Track per-team wins
      if (!acc.teams.has(teamId)) {
        acc.teams.set(teamId, { id: teamId, name: teamName, abbreviation: teamAbbr, wins: 0 });
      }
      const teamEntry = acc.teams.get(teamId)!;
      if (wl === "W") teamEntry.wins += 1;

      acc.gamesPlayed += 1; // each row = one team's game; we'll halve later
      acc.maxGameInSeries = Math.max(acc.maxGameInSeries, parsed.gameInSeries);
    }

    const seriesList: SeriesResult[] = [];

    for (const acc of Array.from(seriesMap.values())) {
      const teamsArray = Array.from(acc.teams.values());
      if (teamsArray.length < 2) continue; // incomplete data

      const teamA: TeamRecord = teamsArray[0];
      const teamB: TeamRecord = teamsArray[1];

      // Each game produces 2 rows (one per team), so actual games played = gamesPlayed / 2
      const actualGamesPlayed = Math.round(acc.gamesPlayed / 2);

      // Elimination: either team has 3 wins (next win = series win in best-of-7)
      const isElimination = teamA.wins === 3 || teamB.wins === 3;

      // Build status string
      const leader = teamA.wins > teamB.wins ? teamA : teamB.wins > teamA.wins ? teamB : null;
      const trailer = leader === teamA ? teamB : teamA;

      let seriesStatus: string;
      if (teamA.wins === teamB.wins) {
        seriesStatus = `Series tied ${teamA.wins}-${teamB.wins}`;
      } else if (teamA.wins === 4 || teamB.wins === 4) {
        const winner = teamA.wins === 4 ? teamA : teamB;
        const loser = winner === teamA ? teamB : teamA;
        seriesStatus = `${winner.abbreviation} wins ${winner.wins}-${loser.wins}`;
      } else {
        seriesStatus = `${leader!.abbreviation} leads ${leader!.wins}-${trailer.wins}`;
        if (isElimination) {
          seriesStatus += ` (elimination)`;
        }
      }

      // Resolve matchup label (fallback if we only saw @ forms)
      const matchupLabel =
        acc.matchupLabel ||
        `${teamA.abbreviation} vs. ${teamB.abbreviation}`;

      seriesList.push({
        seriesKey: acc.matchupKey,
        matchup: matchupLabel,
        roundNumber: acc.round,
        roundName: ROUND_NAMES[acc.round] ?? `Round ${acc.round}`,
        teamA,
        teamB,
        gamesPlayed: actualGamesPlayed,
        maxGameInSeries: acc.maxGameInSeries,
        isElimination,
        seriesStatus,
      });
    }

    // Sort by round, then series key for stable ordering
    seriesList.sort((a, b) => a.roundNumber - b.roundNumber || a.seriesKey.localeCompare(b.seriesKey));

    return res.status(200).json({
      series: seriesList,
      season: currentNbaSeason(),
      _meta: {
        count: seriesList.length,
        endpoint: "series",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(503).json({ error: msg });
  }
}
