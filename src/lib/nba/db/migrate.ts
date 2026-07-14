/**
 * Database migration: creates all NBA medallion architecture tables.
 * Uses CREATE TABLE IF NOT EXISTS — safe to run repeatedly.
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

const TABLES = [
  "nba_bronze_ingestions",
  "nba_players",
  "nba_teams",
  "nba_games",
  "nba_player_game_stats",
  "nba_standings",
  "nba_player_season_stats",
  "nba_team_season_stats",
  "nba_odds",
  "nba_predictions",
  "nba_prediction_results",
  "nba_calibration",
] as const;

export async function runMigrations(sql: Sql): Promise<string[]> {
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
    CREATE TABLE IF NOT EXISTS nba_player_salaries (
      player_id INT NOT NULL,
      season_year INT NOT NULL,
      team_id BIGINT,
      salary BIGINT NOT NULL,
      incoming_trade_value BIGINT,
      outgoing_trade_value BIGINT,
      years_remaining INT,
      option_type INT,
      bird_status INT,
      minimum_salary_exception BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, season_year)
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

  // Odds
  await sql`
    CREATE TABLE IF NOT EXISTS nba_odds (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT NOT NULL,
      bookmaker TEXT NOT NULL,
      spread_home NUMERIC,
      spread_away NUMERIC,
      over_under NUMERIC,
      home_ml INT,
      away_ml INT,
      home_team TEXT,
      away_team TEXT,
      commence_time TIMESTAMPTZ,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, bookmaker, captured_at)
    )
  `;

  // Predictions
  await sql`
    CREATE TABLE IF NOT EXISTS nba_predictions (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT,
      calibration_version TEXT NOT NULL,
      sim_count INT NOT NULL,
      sim_median_spread NUMERIC,
      sim_mean_spread NUMERIC,
      sim_stddev NUMERIC,
      sim_home_win_pct NUMERIC,
      vegas_spread NUMERIC,
      edge NUMERIC,
      confidence TEXT,
      synergy_buffs_home JSONB,
      synergy_buffs_away JSONB,
      home_team TEXT,
      away_team TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, calibration_version)
    )
  `;

  // Prediction results
  await sql`
    CREATE TABLE IF NOT EXISTS nba_prediction_results (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT,
      predicted_spread NUMERIC,
      vegas_spread NUMERIC,
      actual_margin NUMERIC,
      beat_vegas BOOLEAN,
      ats_result TEXT,
      calibration_version TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      settled_at TIMESTAMPTZ
    )
  `;
  await sql`ALTER TABLE nba_prediction_results ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ`;
  // Idempotent logging: one row per (event_id, calibration_version)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pred_results_event_calver ON nba_prediction_results (event_id, calibration_version)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pred_results_unsettled ON nba_prediction_results (settled_at) WHERE settled_at IS NULL`;

  // Additive columns on nba_predictions (idempotent)
  await sql`ALTER TABLE nba_predictions ADD COLUMN IF NOT EXISTS edge_direction TEXT`;
  await sql`ALTER TABLE nba_predictions ADD COLUMN IF NOT EXISTS roster_source TEXT`;

  // Calibration
  await sql`
    CREATE TABLE IF NOT EXISTS nba_calibration (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      stat_mappings JSONB NOT NULL,
      backtest_games INT,
      backtest_mae NUMERIC,
      backtest_rmse NUMERIC,
      backtest_r2 NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return [...TABLES];
}
