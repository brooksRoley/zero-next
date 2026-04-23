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
