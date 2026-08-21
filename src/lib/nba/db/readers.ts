/**
 * Query functions for NBA data tables.
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { RosterSimRow } from "../sim/roster-builder";

type Sql = NeonQueryFunction<false, false>;

export async function getPlayerSeasonStats(sql: Sql, playerId: number, season: string) {
  const rows = await sql`
    SELECT * FROM nba_player_season_stats
    WHERE player_id = ${playerId} AND season = ${season}
  `;
  return rows[0] ?? null;
}

export async function getTeamRoster(sql: Sql, teamId: number) {
  const rows = await sql`
    SELECT * FROM nba_players
    WHERE team_id = ${teamId}
    ORDER BY player_name
  `;
  return rows;
}

export async function getStandings(sql: Sql, season: string) {
  const rows = await sql`
    SELECT s.*, t.team_name, t.team_city, t.team_abbreviation
    FROM nba_standings s
    JOIN nba_teams t ON t.team_id = s.team_id
    WHERE s.season = ${season}
    ORDER BY s.conference, s.playoff_rank
  `;
  return rows;
}

export async function getPlayerGameLog(sql: Sql, playerId: number, season: string) {
  const rows = await sql`
    SELECT pgs.*, g.game_date, g.home_team_id, g.away_team_id
    FROM nba_player_game_stats pgs
    JOIN nba_games g ON g.game_id = pgs.game_id
    WHERE pgs.player_id = ${playerId} AND g.season = ${season}
    ORDER BY g.game_date DESC
  `;
  return rows;
}

export async function getTeamSeasonStats(sql: Sql, teamId: number, season: string) {
  const rows = await sql`
    SELECT * FROM nba_team_season_stats
    WHERE team_id = ${teamId} AND season = ${season}
  `;
  return rows[0] ?? null;
}

export async function getRecentIngestions(sql: Sql, limit: number = 10) {
  const rows = await sql`
    SELECT id, source, endpoint, row_count, ingested_at
    FROM nba_bronze_ingestions
    ORDER BY ingested_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getTodayPredictions(sql: Sql) {
  return sql`
    SELECT p.*, o.spread_home as book_spread, o.bookmaker
    FROM nba_predictions p
    LEFT JOIN nba_odds o ON o.event_id = p.event_id
    WHERE p.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY ABS(p.edge) DESC
  `;
}

export async function getPrediction(sql: Sql, eventId: string) {
  const rows = await sql`SELECT * FROM nba_predictions WHERE event_id = ${eventId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}

export async function getPredictionAccuracy(sql: Sql) {
  return sql`
    SELECT
      COUNT(*) as total_predictions,
      COUNT(*) FILTER (WHERE beat_vegas = true) as beat_vegas_count,
      COUNT(*) FILTER (WHERE ats_result = 'cover') as covers,
      COUNT(*) FILTER (WHERE ats_result = 'miss') as misses,
      COUNT(*) FILTER (WHERE ats_result = 'push') as pushes,
      ROUND(AVG(ABS(predicted_spread - actual_margin)), 2) as model_mae,
      ROUND(AVG(ABS(vegas_spread - actual_margin)), 2) as vegas_mae
    FROM nba_prediction_results
  `;
}

/**
 * Prediction accuracy broken out per calendar month so you can see whether the
 * model is drifting (model_mae creeping up, or beat_vegas rate decaying) instead
 * of one flattened all-time average. Scoped to fully-settled predictions — the
 * same filter the accuracy endpoint uses — so the monthly rows reconcile with
 * its overall totals. Bucketed by created_at (when the prediction was made).
 * Most-recent month first.
 */
export async function getPredictionAccuracyByMonth(sql: Sql) {
  return sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
      COUNT(*) as total_predictions,
      COUNT(*) FILTER (WHERE beat_vegas = true) as beat_vegas_count,
      COUNT(*) FILTER (WHERE ats_result = 'cover') as covers,
      COUNT(*) FILTER (WHERE ats_result = 'miss') as misses,
      COUNT(*) FILTER (WHERE ats_result = 'push') as pushes,
      ROUND(AVG(ABS(predicted_spread - actual_margin)), 2) as model_mae,
      ROUND(AVG(ABS(vegas_spread - actual_margin)), 2) as vegas_mae
    FROM nba_prediction_results
    WHERE settled_at IS NOT NULL
      AND predicted_spread IS NOT NULL
      AND vegas_spread IS NOT NULL
      AND actual_margin IS NOT NULL
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at) DESC
  `;
}

export async function getOddsForEvent(sql: Sql, eventId: string) {
  return sql`SELECT * FROM nba_odds WHERE event_id = ${eventId} ORDER BY captured_at DESC`;
}

/**
 * Get roster stats for simulation engine.
 * Joins players + season stats + team stats to produce data compatible with RealPlayerStats.
 * Missing advanced stats (ts_pct, stl_pct, blk_pct) are derived from available per-game data.
 */
export async function getTeamRosterForSim(
  sql: Sql,
  teamId: number,
  season: string
): Promise<RosterSimRow[]> {
  const rows = await sql`
    SELECT
      p.player_id,
      p.player_name,
      p.team_id,
      p.position,
      ps.games_played,
      ps.mpg,
      ps.ppg,
      ps.rpg,
      ps.apg,
      ps.spg,
      ps.bpg,
      ps.fg_pct,
      ps.fg3_pct,
      ps.ft_pct,
      ts.pace AS team_pace,
      ts.def_rtg AS team_def_rtg
    FROM nba_players p
    JOIN nba_player_season_stats ps ON ps.player_id = p.player_id AND ps.season = ${season}
    LEFT JOIN nba_team_season_stats ts ON ts.team_id = p.team_id AND ts.season = ${season}
    WHERE p.team_id = ${teamId}
      AND ps.mpg > 10
    ORDER BY ps.mpg DESC
    LIMIT 8
  `;
  return rows as unknown as RosterSimRow[];
}
