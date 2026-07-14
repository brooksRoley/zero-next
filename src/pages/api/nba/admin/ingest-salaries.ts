/**
 * Vercel Cron endpoint: ingests player contracts (2026-27 salaries + CBA
 * trade values) from ESPN's core API into nba_player_salaries. Backs the
 * salary-cap / trade-machine page. Daily at 11:00 UTC, after the roster and
 * stats ingests, so free-agency signings reprice within a day.
 *
 * Contracts are fetched per player id (no bulk endpoint) for every player in
 * nba_players; unsigned players simply have no contract row that season.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { fetchContracts } from "src/lib/nba/salaries";
import { upsertPlayerSalaries, logBronzeIngestion } from "src/lib/nba/db/writers";
import { CAP_SEASON_YEAR } from "src/lib/nba/capConstants";
import { isAuthorizedAdminRequest } from "src/lib/adminAuth";

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const seasonYear = Number(req.query.season_year) || CAP_SEASON_YEAR;

  try {
    const players = (await sql`SELECT player_id FROM nba_players`) as Array<{
      player_id: number;
    }>;
    const ids = players.map((p) => Number(p.player_id));
    if (ids.length === 0) {
      return res.status(409).json({
        error: "nba_players is empty — run /api/nba/admin/ingest first",
      });
    }

    const contracts = await fetchContracts(ids, seasonYear);
    await logBronzeIngestion(
      sql, "espn.com", "athlete-contracts", { seasonYear }, contracts.slice(0, 2), contracts.length
    );
    const count = await upsertPlayerSalaries(sql, contracts);

    const unmappedTeam = contracts.filter((c) => c.teamId === null).length;
    res.status(200).json({
      ok: true,
      season_year: seasonYear,
      players_checked: ids.length,
      contracts: count,
      unmapped_team: unmappedTeam,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
}
