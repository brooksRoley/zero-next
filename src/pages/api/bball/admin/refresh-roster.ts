/**
 * Regenerates bball_roster from real NBA data (ESPN season stats + current
 * team rosters). Runs as a daily Vercel Cron so free-agency signings reach
 * the game within a day; can be triggered manually with x-admin-key.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireSql } from "src/lib/db";
import { isAuthorizedAdminRequest } from "src/lib/adminAuth";
import { fetchSeasonStats, fetchRosterStatuses } from "src/lib/bball/espn";
import { generateRoster } from "src/lib/bball/generateRoster";
import { clearRosterCache } from "src/lib/bball/roster";

export const config = { maxDuration: 60 };

/** Refuse to replace the roster with a suspiciously small one — a partial
 *  ESPN response must never wipe a good table. */
const MIN_ROSTER_SIZE = 50;

/** NBA rosters carry ~450 players; far fewer means the team-roster fetches
 *  degraded silently (empty athletes arrays) and every player would be
 *  mislabeled "FA". Refuse rather than wipe a day of franchise data. */
const MIN_ROSTERED_PLAYERS = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [stats, statuses] = await Promise.all([
      fetchSeasonStats(),
      fetchRosterStatuses(),
    ]);
    const roster = generateRoster(stats, statuses);

    if (roster.length < MIN_ROSTER_SIZE) {
      return res.status(502).json({
        error: `Generated only ${roster.length} players (min ${MIN_ROSTER_SIZE}) — keeping the existing roster`,
        stat_rows: stats.length,
      });
    }
    if (statuses.size < MIN_ROSTERED_PLAYERS) {
      return res.status(502).json({
        error: `Only ${statuses.size} rostered players seen (min ${MIN_ROSTERED_PLAYERS}) — team data degraded, keeping the existing roster`,
        stat_rows: stats.length,
      });
    }

    // Upsert + deactivate, not delete-and-replace: players who fall out of
    // the generated set stay as inactive rows, so ghost boards and in-flight
    // runs holding them keep validating. One non-interactive transaction —
    // readers see either the old roster or the new one.
    const client = requireSql();
    await client.transaction([
      client`UPDATE bball_roster SET is_active = FALSE`,
      ...roster.map(
        (p) => client`
          INSERT INTO bball_roster
            (id, name, team, cost, shooting, speed, defense, is_active, injury_status, updated_at)
          VALUES
            (${p.id}, ${p.name}, ${p.team}, ${p.cost}, ${p.stats.shooting},
             ${p.stats.speed}, ${p.stats.defense}, ${p.is_active}, ${p.injury_status}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            team = EXCLUDED.team,
            cost = EXCLUDED.cost,
            shooting = EXCLUDED.shooting,
            speed = EXCLUDED.speed,
            defense = EXCLUDED.defense,
            is_active = EXCLUDED.is_active,
            injury_status = EXCLUDED.injury_status,
            updated_at = NOW()
        `
      ),
    ]);
    clearRosterCache();

    const costs: Record<number, number> = {};
    let freeAgents = 0;
    for (const p of roster) {
      costs[p.cost] = (costs[p.cost] ?? 0) + 1;
      if (p.team === "FA") freeAgents++;
    }

    res.status(200).json({
      ok: true,
      players: roster.length,
      free_agents: freeAgents,
      costs,
      stat_rows: stats.length,
      rostered_players_seen: statuses.size,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
}
