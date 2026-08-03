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
import { findTeamByEspnName, findTeamByNickname } from "src/lib/nba/teams-static";
import { currentNbaSeason } from "src/lib/nba/season";
import { isAuthorizedAdminRequest } from "src/lib/adminAuth";

export const config = { maxDuration: 60 };

/** "2025-26" → 2026, the ending year ESPN keys seasons by. */
function espnYearFromSeason(season: string): number {
  return Number(season.slice(0, 4)) + 1;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: Vercel Cron sends CRON_SECRET, manual calls use x-admin-key
  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const season = (req.query.season as string) || currentNbaSeason();
  // Backfill mode: past-season stats only. The roster and standings feeds are
  // current-day snapshots — writing them under a historical season label
  // would store false history.
  const statsOnly = req.query.only === "season_stats";
  const results: { endpoint: string; status: string; rows: number; error?: string }[] = [];

  // Players — identity + current team from the 30 live team rosters (the
  // feed that moves during free agency). espn player id → canonical team id,
  // reused below so gold stat rows carry the same team mapping.
  const teamIdByPlayer = new Map<number, number | null>();
  if (!statsOnly) try {
    const rosterPlayers = await fetchTeamRosters();
    await logBronzeIngestion(
      sql, "espn.com", "team-rosters", {}, rosterPlayers.slice(0, 2), rosterPlayers.length
    );
    const rows = rosterPlayers.map((p) => {
      const team = findTeamByEspnName(p.teamName);
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
    // Identity rows for players on no current roster (unsigned free agents —
    // or, in backfill mode where no rosters were fetched, anyone not already
    // known). Never clobber an existing row here: in backfill mode every
    // player looks "unsigned", and upserting them would null out live teams.
    let unsigned = stats.filter((s) => !teamIdByPlayer.has(s.id));
    if (statsOnly && unsigned.length > 0) {
      const known = (await sql`SELECT player_id FROM nba_players`) as Array<{
        player_id: number;
      }>;
      const knownIds = new Set(known.map((k) => Number(k.player_id)));
      unsigned = unsigned.filter((s) => !knownIds.has(s.id));
    }
    if (unsigned.length > 0) {
      await upsertPlayers(
        sql,
        unsigned.map((s) => ({
          PLAYER_ID: s.id,
          PLAYER_NAME: s.name,
          TEAM_ID: null,
          TEAM_ABBREVIATION: null,
          POSITION: null,
          AGE: s.age,
        }))
      );
    }
    // byathlete is the only feed that carries age; write it for rostered
    // players too (upsertPlayers keeps existing age when the feed omits it).
    const rostered = stats.filter((s) => s.age != null && teamIdByPlayer.has(s.id));
    for (const s of rostered) {
      await sql`UPDATE nba_players SET age = ${s.age} WHERE player_id = ${s.id}`;
    }
    // Season rows carry the team byathlete attributes the stats to — the
    // season-correct team (matters for backfilled seasons and for traded
    // players, whose current team lives on nba_players instead). Today's
    // roster is only a fallback when the nickname doesn't map.
    const rows: PlayerSeasonStatsRow[] = stats.map((s) => ({
      player_id: s.id,
      team_id:
        (s.teamNickname && findTeamByNickname(s.teamNickname)?.id) ||
        teamIdByPlayer.get(s.id) ||
        null,
      games_played: s.gamesPlayed,
      mpg: s.avgMinutes,
      ppg: s.avgPoints,
      rpg: s.avgRebounds,
      apg: s.avgAssists,
      spg: s.avgSteals,
      bpg: s.avgBlocks,
      topg: s.avgTurnovers,
      fgm: s.avgFgm,
      fga: s.avgFga,
      fg3m: s.avgFg3m,
      fg3a: s.avgFg3a,
      ftm: s.avgFtm,
      fta: s.avgFta,
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
  if (!statsOnly) try {
    const standings = await fetchStandings();
    await logBronzeIngestion(
      sql, "espn.com", "standings", { season }, standings.slice(0, 2), standings.length
    );
    let count = 0;
    const teamRows = [];
    for (const s of standings) {
      const team = findTeamByEspnName(s.teamName);
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
          conference = EXCLUDED.conference,
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
