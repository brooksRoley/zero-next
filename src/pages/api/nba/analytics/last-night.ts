import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason, currentSeasonType } from "src/lib/nba/season";

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

async function fetchLastNight() {
  const season = currentNbaSeason();
  const seasonType = currentSeasonType();

  async function gamesForDate(dateStr: string) {
    return fetchStats("leaguegamefinder", {
      DateFrom: dateStr,
      DateTo: dateStr,
      Season: season,
      SeasonType: seasonType,
      LeagueID: "00",
    }, { resultSetName: "LeagueGameFinderResults" });
  }

  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayStr = formatDate(yesterday);
  let rows = await gamesForDate(yesterdayStr);
  let usedDate = yesterdayStr;

  if (!rows.length) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    usedDate = formatDate(twoDaysAgo);
    rows = await gamesForDate(usedDate);
  }

  if (!rows.length) {
    return { date: yesterdayStr, game_count: 0, games: [], top_performers: [] };
  }

  // Deduplicate into game summaries
  const seen = new Set<string>();
  const games: Record<string, unknown>[] = [];
  const uniqueGameIds = Array.from(new Set(rows.map((r) => String(r.GAME_ID))));
  for (const gid of uniqueGameIds) {
    if (seen.has(gid)) continue;
    seen.add(gid);
    const matchRows = rows.filter((r) => String(r.GAME_ID) === gid);
    if (matchRows.length < 2) continue;
    const [r1, r2] = matchRows;
    const [home, away] = String(r1.MATCHUP).includes("vs.") ? [r1, r2] : [r2, r1];
    const s1 = Number(home.PTS) || 0;
    const s2 = Number(away.PTS) || 0;
    games.push({
      id: Number(gid),
      date: home.GAME_DATE,
      home: home.TEAM_ABBREVIATION,
      away: away.TEAM_ABBREVIATION,
      home_score: s1,
      away_score: s2,
      winner: s1 >= s2 ? home.TEAM_ABBREVIATION : away.TEAM_ABBREVIATION,
    });
  }

  // Player stats for that date
  const playerRows = await fetchStats("leaguedashplayerstats", {
    Season: season,
    SeasonType: seasonType,
    PerMode: "Totals",
    MeasureType: "Base",
    LeagueID: "00",
    DateFrom: usedDate,
    DateTo: usedDate,
  });

  const withPts = playerRows
    .filter((r) => Number(r.PTS) > 0)
    .sort((a, b) => Number(b.PTS) - Number(a.PTS))
    .slice(0, 15);

  const performers = withPts.map((r) => {
    const pts = Number(r.PTS);
    const fga = Number(r.FGA);
    const fta = Number(r.FTA);
    const denom = 2 * (fga + 0.44 * fta);
    const tsPct = denom > 0 ? Math.round((pts / denom) * 1000) / 10 : null;
    return {
      name: r.PLAYER_NAME,
      team: r.TEAM_ABBREVIATION,
      pts,
      reb: Number(r.REB) || 0,
      ast: Number(r.AST) || 0,
      stl: Number(r.STL) || 0,
      blk: Number(r.BLK) || 0,
      tov: Number(r.TOV) || 0,
      fg_pct: Math.round((Number(r.FG_PCT) || 0) * 1000) / 1000,
      ts_pct: tsPct,
      min: String(r.MIN ?? ""),
    };
  });

  const dateDisplay = rows[0]?.GAME_DATE ?? usedDate;
  return {
    date: dateDisplay,
    game_count: games.length,
    games,
    top_performers: performers,
  };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await cached("last_night", fetchLastNight, 3600);
    res.status(200).json({ data, _meta: { endpoint: "last_night" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
