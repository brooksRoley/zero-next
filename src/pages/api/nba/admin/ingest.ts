/**
 * Vercel Cron endpoint: triggers NBA data ingestion.
 * Configure in vercel.json: { "crons": [{ "path": "/api/nba/admin/ingest", "schedule": "0 10 * * *" }] }
 *
 * Can also be called manually with x-admin-key header.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { fetchStats } from "src/lib/nba/client";
import { PlayerSchema, StandingsSchema } from "src/lib/nba/schemas";
import { validateRows } from "src/lib/nba/validate";
import { upsertPlayers, upsertTeams, logBronzeIngestion } from "src/lib/nba/db/writers";
import { currentNbaSeason, parseSeasonType } from "src/lib/nba/season";
import { isAuthorizedAdminRequest } from "src/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: Vercel Cron sends CRON_SECRET, manual calls use x-admin-key
  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const season = (req.query.season as string) || currentNbaSeason();
  const seasonType = parseSeasonType(req.query.season_type);
  const results: { endpoint: string; status: string; rows: number; error?: string }[] = [];

  // Players
  try {
    const rows = await fetchStats("leaguedashplayerstats", {
      Season: season, SeasonType: seasonType, PerMode: "PerGame",
      MeasureType: "Base", LeagueID: "00",
    });
    await logBronzeIngestion(sql, "stats.nba.com", "leaguedashplayerstats", { season }, rows.slice(0, 2), rows.length);
    const valid = validateRows(PlayerSchema, rows, "leaguedashplayerstats");
    const count = await upsertPlayers(sql, valid);
    results.push({ endpoint: "players", status: "ok", rows: count });
  } catch (e) {
    results.push({ endpoint: "players", status: "error", rows: 0, error: (e as Error).message });
  }

  // Standings + Teams
  try {
    const rows = await fetchStats("leaguestandingsv3", {
      LeagueID: "00", Season: season, SeasonType: seasonType,
    }, { resultSetName: "Standings" });
    await logBronzeIngestion(sql, "stats.nba.com", "leaguestandingsv3", { season }, rows.slice(0, 2), rows.length);
    const valid = validateRows(StandingsSchema, rows, "leaguestandingsv3");
    const teamCount = await upsertTeams(sql, valid);

    for (const s of valid) {
      await sql`
        INSERT INTO nba_standings (team_id, season, conference, division, wins, losses, win_pct, playoff_rank, updated_at)
        VALUES (${Number(s.TeamID)}, ${season}, ${s.Conference}, ${s.Division}, ${Number(s.WINS)}, ${Number(s.LOSSES)}, ${Number(s.WinPCT)}, ${Number(s.PlayoffRank)}, NOW())
        ON CONFLICT (team_id, season) DO UPDATE SET
          wins = EXCLUDED.wins, losses = EXCLUDED.losses, win_pct = EXCLUDED.win_pct,
          playoff_rank = EXCLUDED.playoff_rank, updated_at = NOW()
      `;
    }
    results.push({ endpoint: "standings", status: "ok", rows: teamCount + valid.length });
  } catch (e) {
    results.push({ endpoint: "standings", status: "error", rows: 0, error: (e as Error).message });
  }

  const failed = results.filter((r) => r.status === "error");
  const status = failed.length === 0 ? 200 : 207;
  res.status(status).json({ season, results, timestamp: new Date().toISOString() });
}
