import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { fetchOdds, parseOddsResponse, consensusSpread } from "src/lib/nba/odds";
import { runMonteCarloSim } from "src/lib/nba/sim/monte-carlo";
import { detectEdge, classifyConfidence } from "src/lib/nba/predictions/edge-detector";
import { upsertOdds, insertPrediction } from "src/lib/nba/db/writers";
import { getTeamRosterForSim } from "src/lib/nba/db/readers";
import { resolveTeam, buildRosterFromDb, fallbackRoster } from "src/lib/nba/sim/roster-builder";
import { currentNbaSeason } from "src/lib/nba/season";
import { CALIBRATION_VERSION } from "src/lib/nba/predictions/version";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ODDS_API_KEY not configured" });
  }

  const season = currentNbaSeason();

  try {
    const events = await fetchOdds(apiKey);
    const results: any[] = [];

    for (const event of events) {
      const oddsRows = parseOddsResponse(event);
      if (oddsRows.length === 0) continue;

      await upsertOdds(sql, oddsRows);
      const vegas = consensusSpread(oddsRows);

      const homeTeam = resolveTeam(oddsRows[0].home_team);
      const awayTeam = resolveTeam(oddsRows[0].away_team);

      const [homeRows, awayRows] = await Promise.all([
        homeTeam ? getTeamRosterForSim(sql, homeTeam.id, season) : Promise.resolve([]),
        awayTeam ? getTeamRosterForSim(sql, awayTeam.id, season) : Promise.resolve([]),
      ]);

      const homeResult = homeTeam
        ? buildRosterFromDb(homeRows, homeTeam.abbrev)
        : { roster: fallbackRoster("HOME"), source: "fallback" as const };
      const awayResult = awayTeam
        ? buildRosterFromDb(awayRows, awayTeam.abbrev)
        : { roster: fallbackRoster("AWAY"), source: "fallback" as const };

      const rosterSource =
        homeResult.source === "db" && awayResult.source === "db"
          ? "db"
          : homeResult.source === "db" || awayResult.source === "db"
            ? "partial"
            : "fallback";

      const simResult = runMonteCarloSim({
        homeRoster: homeResult.roster,
        awayRoster: awayResult.roster,
        simCount: 500,
        ticksPerSim: 600,
      });

      const { edge, direction } = detectEdge(simResult.medianSpread, vegas);
      const confidence = classifyConfidence(edge, simResult.stddev);

      await insertPrediction(sql, {
        event_id: event.id,
        calibration_version: CALIBRATION_VERSION,
        sim_count: simResult.simCount,
        sim_median_spread: simResult.medianSpread,
        sim_mean_spread: simResult.meanSpread,
        sim_stddev: simResult.stddev,
        sim_home_win_pct: simResult.homeWinPct,
        vegas_spread: vegas,
        edge,
        edge_direction: direction,
        confidence,
        synergy_buffs_home: simResult.homeSynergies,
        synergy_buffs_away: simResult.awaySynergies,
        home_team: oddsRows[0].home_team,
        away_team: oddsRows[0].away_team,
        roster_source: rosterSource,
      });

      results.push({
        event_id: event.id,
        matchup: `${oddsRows[0].home_team} vs ${oddsRows[0].away_team}`,
        vegas_spread: vegas,
        sim_spread: simResult.medianSpread,
        edge,
        edge_direction: direction,
        confidence,
        roster_source: rosterSource,
      });
    }

    res.status(200).json({
      ok: true,
      events_processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    console.error("[nba/admin/simulate] failed:", e);
    res.status(500).json({ error: "Simulation failed" });
  }
}
