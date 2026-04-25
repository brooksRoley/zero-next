/**
 * Query functions for NBA data tables.
 */

export async function getPlayerSeasonStats(sql: any, playerId: number, season: string) {
  const rows = await sql`
    SELECT * FROM nba_player_season_stats
    WHERE player_id = ${playerId} AND season = ${season}
  `;
  return rows[0] ?? null;
}

export async function getTeamRoster(sql: any, teamId: number) {
  const rows = await sql`
    SELECT * FROM nba_players
    WHERE team_id = ${teamId}
    ORDER BY player_name
  `;
  return rows;
}

export async function getStandings(sql: any, season: string) {
  const rows = await sql`
    SELECT s.*, t.team_name, t.team_city, t.team_abbreviation
    FROM nba_standings s
    JOIN nba_teams t ON t.team_id = s.team_id
    WHERE s.season = ${season}
    ORDER BY s.conference, s.playoff_rank
  `;
  return rows;
}

export async function getPlayerGameLog(sql: any, playerId: number, season: string) {
  const rows = await sql`
    SELECT pgs.*, g.game_date, g.home_team_id, g.away_team_id
    FROM nba_player_game_stats pgs
    JOIN nba_games g ON g.game_id = pgs.game_id
    WHERE pgs.player_id = ${playerId} AND g.season = ${season}
    ORDER BY g.game_date DESC
  `;
  return rows;
}

export async function getTeamSeasonStats(sql: any, teamId: number, season: string) {
  const rows = await sql`
    SELECT * FROM nba_team_season_stats
    WHERE team_id = ${teamId} AND season = ${season}
  `;
  return rows[0] ?? null;
}

export async function getRecentIngestions(sql: any, limit: number = 10) {
  const rows = await sql`
    SELECT id, source, endpoint, row_count, ingested_at
    FROM nba_bronze_ingestions
    ORDER BY ingested_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getTodayPredictions(sql: any) {
  return sql`
    SELECT p.*, o.spread_home as book_spread, o.bookmaker
    FROM nba_predictions p
    LEFT JOIN nba_odds o ON o.event_id = p.event_id
    WHERE p.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY ABS(p.edge) DESC
  `;
}

export async function getPrediction(sql: any, eventId: string) {
  const rows = await sql`SELECT * FROM nba_predictions WHERE event_id = ${eventId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}

export async function getPredictionAccuracy(sql: any) {
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

export async function getOddsForEvent(sql: any, eventId: string) {
  return sql`SELECT * FROM nba_odds WHERE event_id = ${eventId} ORDER BY captured_at DESC`;
}
