/**
 * Vercel Cron endpoint: triggers NBA data ingestion.
 * Configure in vercel.json: { "crons": [{ "path": "/api/nba/admin/ingest", "schedule": "0 10 * * *" }] }
 *
 * Can also be called manually with x-admin-key header.
 *
 * Source is ESPN's public JSON API (shared client in src/lib/bball/espn.ts):
 * stats.nba.com stopped responding from both Vercel and residential IPs in
 * 2026, which left this cron silently ingesting nothing for months. Player
 * ids are therefore ESPN athlete ids; team ids stay canonical NBA ids by
 * joining ESPN's team names against NBA_TEAMS, so the sim pipeline
 * (resolveTeam → getTeamRosterForSim) keeps working unchanged. Regular
 * season only — the old ?season_type param is ignored.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import {
  fetchTeamRosters,
  fetchSeasonStats,
  fetchStandings,
} from "src/lib/bball/espn";
import {
  upsertPlayers,
  upsertTeams,
  upsertPlayerSeasonStats,
  logBronzeIngestion,
  type PlayerSeasonStatsRow,
} from "src/lib/nba/db/writers";
import { NBA_TEAMS } from "src/lib/nba/teams-static";
import { currentNbaSeason } from "src/lib/nba/season";
import { isAuthorizedAdminRequest } from "src/lib/adminAuth";

export const config = { maxDuration: 60 };

/** "2025-26" → 2026, the ending year ESPN keys seasons by. */
function espnYearFromSeason(season: string): number {
  return Number(season.slice(0, 4)) + 1;
}

const TEAM_BY_NAME = new Map(NBA_TEAMS.map((t) => [t.full_name, t]));
// ESPN display names that differ from the canonical full_name in NBA_TEAMS.
const ESPN_NAME_ALIASES: Record<string, string> = {
  "LA Clippers": "Los Angeles Clippers",
};
for (const [alias, fullName] of Object.entries(ESPN_NAME_ALIASES)) {
  const team = TEAM_BY_NAME.get(fullName);
  if (team) TEAM_BY_NAME.set(alias, team);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: Vercel Cron sends CRON_SECRET, manual calls use x-admin-key
  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const season = (req.query.season as string) || currentNbaSeason();
  const results: { endpoint: string; status: string; rows: number; error?: string }[] = [];

  // Players — identity + current team from the 30 live team rosters (the
  // feed that moves during free agency). espn player id → canonical team id,
  // reused below so gold stat rows carry the same team mapping.
  const teamIdByPlayer = new Map<number, number | null>();
  try {
    const rosterPlayers = await fetchTeamRosters();
    await logBronzeIngestion(
      sql, "espn.com", "team-rosters", {}, rosterPlayers.slice(0, 2), rosterPlayers.length
    );
    const rows = rosterPlayers.map((p) => {
      const team = TEAM_BY_NAME.get(p.teamName);
      teamIdByPlayer.set(p.id, team?.id ?? null);
      return {
        PLAYER_ID: p.id,
        PLAYER_NAME: p.name,
        TEAM_ID: team?.id ?? null,
        TEAM_ABBREVIATION: team?.abbreviation ?? p.teamAbbrev,
        POSITION: p.position,
      };
    });
    const count = await upsertPlayers(sql, rows);
    results.push({ endpoint: "players", status: "ok", rows: count });
  } catch (e) {
    results.push({ endpoint: "players", status: "error", rows: 0, error: (e as Error).message });
  }

  // Player season stats (gold) — qualified players' per-game averages.
  // Unsigned free agents keep their stat row (team_id null) and get an
  // identity row too, since they're on no roster above.
  try {
    const stats = await fetchSeasonStats(espnYearFromSeason(season));
    await logBronzeIngestion(
      sql, "espn.com", "statistics-byathlete", { season }, stats.slice(0, 2), stats.length
    );
    const unsigned = stats.filter((s) => !teamIdByPlayer.has(s.id));
    if (unsigned.length > 0) {
      await upsertPlayers(
        sql,
        unsigned.map((s) => ({
          PLAYER_ID: s.id,
          PLAYER_NAME: s.name,
          TEAM_ID: null,
          TEAM_ABBREVIATION: null,
          POSITION: null,
        }))
      );
    }
    const rows: PlayerSeasonStatsRow[] = stats.map((s) => ({
      player_id: s.id,
      team_id: teamIdByPlayer.get(s.id) ?? null,
      games_played: s.gamesPlayed,
      mpg: s.avgMinutes,
      ppg: s.avgPoints,
      rpg: s.avgRebounds,
      apg: s.avgAssists,
      spg: s.avgSteals,
      bpg: s.avgBlocks,
      topg: s.avgTurnovers,
      fg_pct: s.fgPct,
      fg3_pct: s.fg3Pct,
      ft_pct: s.ftPct,
    }));
    const count = await upsertPlayerSeasonStats(sql, season, rows);
    results.push({ endpoint: "season_stats", status: "ok", rows: count });
  } catch (e) {
    results.push({ endpoint: "season_stats", status: "error", rows: 0, error: (e as Error).message });
  }

  // Standings + Teams — ESPN standings joined to canonical NBA team ids.
  try {
    const standings = await fetchStandings();
    await logBronzeIngestion(
      sql, "espn.com", "standings", { season }, standings.slice(0, 2), standings.length
    );
    let count = 0;
    const teamRows = [];
    for (const s of standings) {
      const team = TEAM_BY_NAME.get(s.teamName);
      if (!team) continue; // expansion/all-star oddities: skip, don't fail
      teamRows.push({
        TeamID: team.id,
        TeamName: team.nickname,
        TeamCity: team.city,
        TEAM_ABBREVIATION: team.abbreviation,
        Conference: s.conference,
        Division: null,
      });
      await sql`
        INSERT INTO nba_standings (team_id, season, conference, division, wins, losses, win_pct, playoff_rank, updated_at)
        VALUES (${team.id}, ${season}, ${s.conference}, ${null}, ${s.wins}, ${s.losses}, ${s.winPercent}, ${s.playoffSeed}, NOW())
        ON CONFLICT (team_id, season) DO UPDATE SET
          wins = EXCLUDED.wins, losses = EXCLUDED.losses, win_pct = EXCLUDED.win_pct,
          playoff_rank = EXCLUDED.playoff_rank, updated_at = NOW()
      `;
      count++;
    }
    const teamCount = await upsertTeams(sql, teamRows);
    results.push({ endpoint: "standings", status: "ok", rows: teamCount + count });
  } catch (e) {
    results.push({ endpoint: "standings", status: "error", rows: 0, error: (e as Error).message });
  }

  const failed = results.filter((r) => r.status === "error");
  const status = failed.length === 0 ? 200 : 207;
  res.status(status).json({ season, source: "espn.com", results, timestamp: new Date().toISOString() });
}
