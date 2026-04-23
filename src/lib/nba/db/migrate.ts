/**
 * Database migration: creates all NBA medallion architecture tables.
 * Uses CREATE TABLE IF NOT EXISTS — safe to run repeatedly.
 */

const TABLES = [
  "nba_bronze_ingestions",
  "nba_players",
  "nba_teams",
  "nba_games",
  "nba_player_game_stats",
  "nba_standings",
  "nba_player_season_stats",
  "nba_team_season_stats",
] as const;

export async function runMigrations(sql: any): Promise<string[]> {
  // Bronze
  await sql`
    CREATE TABLE IF NOT EXISTS nba_bronze_ingestions (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      params_json JSONB,
      raw_response JSONB NOT NULL,
      row_count INT NOT NULL DEFAULT 0,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Silver
  await sql`
    CREATE TABLE IF NOT EXISTS nba_players (
      player_id INT PRIMARY KEY,
      player_name TEXT NOT NULL,
      team_id INT,
      team_abbreviation TEXT,
      position TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nba_teams (
      team_id INT PRIMARY KEY,
      team_name TEXT NOT NULL,
      team_city TEXT,
      team_abbreviation TEXT,
      conference TEXT,
      division TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nba_games (
      game_id TEXT PRIMARY KEY,
      game_date DATE,
      season TEXT,
      home_team_id INT,
      away_team_id INT,
      home_score INT,
      away_score INT,
      status TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nba_player_game_stats (
      id SERIAL PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_id INT NOT NULL,
      team_id INT,
      minutes NUMERIC,
      pts INT,
      reb INT,
      ast INT,
      stl INT,
      blk INT,
      tov INT,
      fgm INT,
      fga INT,
      fg_pct NUMERIC,
      fg3m INT,
      fg3a INT,
      fg3_pct NUMERIC,
      ftm INT,
      fta INT,
      ft_pct NUMERIC,
      plus_minus INT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (game_id, player_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nba_standings (
      team_id INT NOT NULL,
      season TEXT NOT NULL,
      conference TEXT,
      division TEXT,
      wins INT,
      losses INT,
      win_pct NUMERIC,
      playoff_rank INT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (team_id, season)
    )
  `;

  // Gold
  await sql`
    CREATE TABLE IF NOT EXISTS nba_player_season_stats (
      player_id INT NOT NULL,
      season TEXT NOT NULL,
      team_id INT,
      games_played INT,
      mpg NUMERIC,
      ppg NUMERIC,
      rpg NUMERIC,
      apg NUMERIC,
      spg NUMERIC,
      bpg NUMERIC,
      topg NUMERIC,
      fg_pct NUMERIC,
      fg3_pct NUMERIC,
      ft_pct NUMERIC,
      plus_minus_avg NUMERIC,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, season)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS nba_team_season_stats (
      team_id INT NOT NULL,
      season TEXT NOT NULL,
      games_played INT,
      ppg NUMERIC,
      opp_ppg NUMERIC,
      rpg NUMERIC,
      apg NUMERIC,
      pace NUMERIC,
      off_rtg NUMERIC,
      def_rtg NUMERIC,
      net_rtg NUMERIC,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (team_id, season)
    )
  `;

  return [...TABLES];
}
