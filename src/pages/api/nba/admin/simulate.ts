import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { fetchOdds, parseOddsResponse, consensusSpread } from "src/lib/nba/odds";
import { runMonteCarloSim } from "src/lib/nba/sim/monte-carlo";
import { detectEdge, classifyConfidence } from "src/lib/nba/predictions/edge-detector";
import { upsertOdds, insertPrediction } from "src/lib/nba/db/writers";
import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ODDS_API_KEY not configured" });
  }

  try {
    // 1. Fetch odds
    const events = await fetchOdds(apiKey);
    const results: any[] = [];

    for (const event of events) {
      const oddsRows = parseOddsResponse(event);
      if (oddsRows.length === 0) continue;

      // Store odds
      await upsertOdds(sql, oddsRows);

      // 2. Get consensus spread
      const vegas = consensusSpread(oddsRows);

      // 3. Build rosters from DB (placeholder: use average stats if real roster unavailable)
      // In production, query nba_players for team rosters + nba_player_season_stats for advanced stats
      // For now, use default-stat rosters
      const defaultPlayer = (id: number, name: string, team: string): EnginePlayer => ({
        id, name, team, shooting: 65, defense: 60, speed: 65, height_inches: 78, weight_lbs: 215, stamina: 75,
      });

      const homeRoster = Array.from({ length: 5 }, (_, i) =>
        defaultPlayer(i + 1, `Home ${i + 1}`, "HOME")
      );
      const awayRoster = Array.from({ length: 5 }, (_, i) =>
        defaultPlayer(i + 11, `Away ${i + 1}`, "AWAY")
      );

      // 4. Run Monte Carlo
      const simResult = runMonteCarloSim({
        homeRoster,
        awayRoster,
        simCount: 500,
        ticksPerSim: 600,
      });

      // 5. Detect edge
      const { edge } = detectEdge(simResult.medianSpread, vegas);
      const confidence = classifyConfidence(edge, simResult.stddev);

      // 6. Store prediction
      await insertPrediction(sql, {
        event_id: event.id,
        calibration_version: "v0.1.0",
        sim_count: simResult.simCount,
        sim_median_spread: simResult.medianSpread,
        sim_mean_spread: simResult.meanSpread,
        sim_stddev: simResult.stddev,
        sim_home_win_pct: simResult.homeWinPct,
        vegas_spread: vegas,
        edge,
        confidence,
        synergy_buffs_home: simResult.homeSynergies,
        synergy_buffs_away: simResult.awaySynergies,
        home_team: oddsRows[0].home_team,
        away_team: oddsRows[0].away_team,
      });

      results.push({
        event_id: event.id,
        matchup: `${oddsRows[0].home_team} vs ${oddsRows[0].away_team}`,
        vegas_spread: vegas,
        sim_spread: simResult.medianSpread,
        edge,
        confidence,
      });
    }

    res.status(200).json({
      ok: true,
      events_processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Simulation failed" });
  }
}
