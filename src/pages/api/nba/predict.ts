import type { NextApiRequest, NextApiResponse } from "next";
import { fetchStats } from "src/lib/nba/client";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason, currentSeasonType } from "src/lib/nba/season";

const HOME_COURT_ADJ = 3.0;

function safe(val: unknown): number | null {
  const n = Number(val);
  return isNaN(n) ? null : n;
}

async function fetchAllTeamAdvanced() {
  const season = currentNbaSeason();
  const rows = await fetchStats("leaguedashteamstats", {
    Season: season,
    SeasonType: currentSeasonType(),
    PerMode: "PerGame",
    MeasureType: "Advanced",
    LeagueID: "00",
  });
  return rows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const homeId = Number(req.query.home);
  const awayId = Number(req.query.away);

  if (!homeId || !awayId) {
    return res.status(400).json({ error: "home and away team IDs required" });
  }

  if (homeId === awayId) {
    return res.status(400).json({ error: "home and away team IDs must differ" });
  }

  try {
    const teamRows = await cached("team_advanced_all", fetchAllTeamAdvanced, 600);

    const homeRow = teamRows.find((r) => Number(r.TEAM_ID) === homeId);
    const awayRow = teamRows.find((r) => Number(r.TEAM_ID) === awayId);

    if (!homeRow) return res.status(404).json({ error: `Team not found: home=${homeId}` });
    if (!awayRow) return res.status(404).json({ error: `Team not found: away=${awayId}` });

    const homeNetRating = safe(homeRow.NET_RATING) ?? 0;
    const awayNetRating = safe(awayRow.NET_RATING) ?? 0;
    const homeOffRating = safe(homeRow.OFF_RATING);
    const awayOffRating = safe(awayRow.OFF_RATING);
    const homeDefRating = safe(homeRow.DEF_RATING);
    const awayDefRating = safe(awayRow.DEF_RATING);
    const homePace = safe(homeRow.PACE);
    const awayPace = safe(awayRow.PACE);

    const paceDelta =
      homePace !== null && awayPace !== null
        ? Math.round((homePace - awayPace) * 10) / 10
        : null;

    const delta = homeNetRating - awayNetRating + HOME_COURT_ADJ;
    const homeWinProb = 1 / (1 + Math.pow(10, -delta / 10));

    return res.status(200).json({
      homeWinProb: Math.round(homeWinProb * 1000) / 1000,
      awayWinProb: Math.round((1 - homeWinProb) * 1000) / 1000,
      homeNetRating: Math.round(homeNetRating * 10) / 10,
      awayNetRating: Math.round(awayNetRating * 10) / 10,
      homeOffRating,
      awayOffRating,
      homeDefRating,
      awayDefRating,
      homePace,
      awayPace,
      paceDelta,
      homeCourtAdj: HOME_COURT_ADJ,
      model: "elo-net-rating",
      _meta: {
        endpoint: "predict",
        homeTeamId: homeId,
        awayTeamId: awayId,
        season: currentNbaSeason(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(503).json({ error: msg });
  }
}
