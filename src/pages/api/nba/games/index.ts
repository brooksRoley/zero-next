import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason, parseSeasonType } from "src/lib/nba/season";

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

async function fetchGames(dateFrom: string, dateTo: string, seasonType: string) {
  const season = currentNbaSeason();
  const rows = await fetchStats("leaguegamefinder", {
    DateFrom: dateFrom,
    DateTo: dateTo,
    Season: season,
    SeasonType: seasonType,
    LeagueID: "00",
  }, { resultSetName: "LeagueGameFinderResults" });

  const seen = new Set<string>();
  const games: Record<string, unknown>[] = [];

  for (const row of rows) {
    const gid = String(row.GAME_ID);
    if (seen.has(gid)) continue;

    const matchRows = rows.filter((r) => String(r.GAME_ID) === gid);
    if (matchRows.length < 2) continue;
    seen.add(gid);

    const [r1, r2] = matchRows;
    const [home, away] = String(r1.MATCHUP).includes("vs.") ? [r1, r2] : [r2, r1];

    const s1 = Number(home.PTS) || 0;
    const s2 = Number(away.PTS) || 0;

    games.push({
      id: Number(gid),
      date: home.GAME_DATE as string,
      home: home.TEAM_ABBREVIATION as string,
      away: away.TEAM_ABBREVIATION as string,
      home_score: s1,
      away_score: s2,
      winner: s1 >= s2 ? home.TEAM_ABBREVIATION : away.TEAM_ABBREVIATION,
    });
  }

  return games.slice(0, 20);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    let dateFrom: string;
    let dateTo: string;

    const dateStr = req.query.date as string;
    if (dateStr) {
      const d = new Date(dateStr);
      dateFrom = dateTo = formatDate(d);
    } else {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFrom = formatDate(weekAgo);
      dateTo = formatDate(today);
    }

    const seasonType = parseSeasonType(req.query.season_type);
    const cacheKey = `games_${dateFrom}_${dateTo}_${seasonType}`;
    const data = await cached(cacheKey, () => fetchGames(dateFrom, dateTo, seasonType), 300);

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
    res.status(200).json({ data, _meta: { endpoint: "games" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
