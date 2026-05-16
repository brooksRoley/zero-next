-- NBA Data Platform: Medallion Architecture
-- Bronze → Silver → Gold

-- ============================================================
-- BRONZE: Raw ingestion logs
-- ============================================================

CREATE TABLE IF NOT EXISTS nba_bronze_ingestions (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,              -- e.g. 'stats.nba.com'
  endpoint TEXT NOT NULL,            -- e.g. 'leaguedashplayerstats'
  params_json JSONB,
  raw_response JSONB NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bronze_endpoint ON nba_bronze_ingestions (endpoint);
CREATE INDEX IF NOT EXISTS idx_bronze_ingested_at ON nba_bronze_ingestions (ingested_at);

-- ============================================================
-- SILVER: Cleaned, typed, deduplicated
-- ============================================================

CREATE TABLE IF NOT EXISTS nba_players (
  player_id INT PRIMARY KEY,
  player_name TEXT NOT NULL,
  team_id INT,
  team_abbreviation TEXT,
  position TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nba_teams (
  team_id INT PRIMARY KEY,
  team_name TEXT NOT NULL,
  team_city TEXT,
  team_abbreviation TEXT,
  conference TEXT,
  division TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS idx_games_date ON nba_games (game_date);
CREATE INDEX IF NOT EXISTS idx_games_season ON nba_games (season);

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
);

CREATE INDEX IF NOT EXISTS idx_player_stats_player ON nba_player_game_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game ON nba_player_game_stats (game_id);

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
);

-- ============================================================
-- GOLD: Analytics-ready aggregations
-- ============================================================

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
);

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
);

CREATE INDEX IF NOT EXISTS idx_player_season ON nba_player_season_stats (season);
CREATE INDEX IF NOT EXISTS idx_team_season ON nba_team_season_stats (season);

-- ============================================================
-- PREDICTIONS: served picks + settled outcomes for accuracy tracking
-- ============================================================

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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pred_results_event_calver
  ON nba_prediction_results (event_id, calibration_version);
CREATE INDEX IF NOT EXISTS idx_pred_results_unsettled
  ON nba_prediction_results (settled_at) WHERE settled_at IS NULL;
