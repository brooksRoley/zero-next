/**
 * Upsert functions for NBA silver tables.
 * Each function maps NbaRow fields to table columns and uses ON CONFLICT for idempotency.
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { OddsRow } from "../odds";

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, any>;

export async function upsertPlayers(sql: Sql, players: Row[]): Promise<number> {
  let count = 0;
  for (const p of players) {
    await sql`
      INSERT INTO nba_players (player_id, player_name, team_id, team_abbreviation, position, updated_at)
      VALUES (
        ${Number(p.PLAYER_ID)},
        ${p.PLAYER_NAME},
        ${p.TEAM_ID != null ? Number(p.TEAM_ID) : null},
        ${p.TEAM_ABBREVIATION ?? null},
        ${p.POSITION ?? null},
        NOW()
      )
      ON CONFLICT (player_id) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        team_id = EXCLUDED.team_id,
        team_abbreviation = EXCLUDED.team_abbreviation,
        position = EXCLUDED.position,
        updated_at = NOW()
    `;
    count++;
  }
  return count;
}

export async function upsertTeams(sql: Sql, teams: Row[]): Promise<number> {
  let count = 0;
  for (const t of teams) {
    await sql`
      INSERT INTO nba_teams (team_id, team_name, team_city, team_abbreviation, conference, division, updated_at)
      VALUES (
        ${Number(t.TeamID ?? t.TEAM_ID)},
        ${t.TeamName ?? t.TEAM_NAME ?? ""},
        ${t.TeamCity ?? t.TEAM_CITY ?? null},
        ${t.TEAM_ABBREVIATION ?? t.TeamAbbreviation ?? null},
        ${t.Conference ?? t.CONFERENCE ?? null},
        ${t.Division ?? t.DIVISION ?? null},
        NOW()
      )
      ON CONFLICT (team_id) DO UPDATE SET
        team_name = EXCLUDED.team_name,
        team_city = EXCLUDED.team_city,
        team_abbreviation = EXCLUDED.team_abbreviation,
        conference = EXCLUDED.conference,
        division = EXCLUDED.division,
        updated_at = NOW()
    `;
    count++;
  }
  return count;
}

/** Gold-layer per-game season averages. Percentages are 0–1 fractions
 *  (roster-builder derives ts_pct from them). */
export type PlayerSeasonStatsRow = {
  player_id: number;
  team_id: number | null;
  games_played: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
};

export async function upsertPlayerSeasonStats(
  sql: Sql,
  season: string,
  stats: PlayerSeasonStatsRow[]
): Promise<number> {
  let count = 0;
  for (const s of stats) {
    await sql`
      INSERT INTO nba_player_season_stats
        (player_id, season, team_id, games_played, mpg, ppg, rpg, apg, spg, bpg, topg, fg_pct, fg3_pct, ft_pct, updated_at)
      VALUES
        (${s.player_id}, ${season}, ${s.team_id}, ${s.games_played}, ${s.mpg}, ${s.ppg}, ${s.rpg},
         ${s.apg}, ${s.spg}, ${s.bpg}, ${s.topg}, ${s.fg_pct}, ${s.fg3_pct}, ${s.ft_pct}, NOW())
      ON CONFLICT (player_id, season) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        games_played = EXCLUDED.games_played,
        mpg = EXCLUDED.mpg,
        ppg = EXCLUDED.ppg,
        rpg = EXCLUDED.rpg,
        apg = EXCLUDED.apg,
        spg = EXCLUDED.spg,
        bpg = EXCLUDED.bpg,
        topg = EXCLUDED.topg,
        fg_pct = EXCLUDED.fg_pct,
        fg3_pct = EXCLUDED.fg3_pct,
        ft_pct = EXCLUDED.ft_pct,
        updated_at = NOW()
    `;
    count++;
  }
  return count;
}

export async function upsertPlayerSalaries(
  sql: Sql,
  contracts: Array<{
    playerId: number;
    seasonYear: number;
    teamId: number | null;
    salary: number;
    incomingTradeValue: number;
    outgoingTradeValue: number;
    yearsRemaining: number;
    optionType: number;
    birdStatus: number;
    minimumSalaryException: boolean;
  }>
): Promise<number> {
  let count = 0;
  for (const c of contracts) {
    await sql`
      INSERT INTO nba_player_salaries
        (player_id, season_year, team_id, salary, incoming_trade_value, outgoing_trade_value,
         years_remaining, option_type, bird_status, minimum_salary_exception, updated_at)
      VALUES
        (${c.playerId}, ${c.seasonYear}, ${c.teamId}, ${c.salary}, ${c.incomingTradeValue},
         ${c.outgoingTradeValue}, ${c.yearsRemaining}, ${c.optionType}, ${c.birdStatus},
         ${c.minimumSalaryException}, NOW())
      ON CONFLICT (player_id, season_year) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        salary = EXCLUDED.salary,
        incoming_trade_value = EXCLUDED.incoming_trade_value,
        outgoing_trade_value = EXCLUDED.outgoing_trade_value,
        years_remaining = EXCLUDED.years_remaining,
        option_type = EXCLUDED.option_type,
        bird_status = EXCLUDED.bird_status,
        minimum_salary_exception = EXCLUDED.minimum_salary_exception,
        updated_at = NOW()
    `;
    count++;
  }
  return count;
}

export async function upsertGames(sql: Sql, games: Row[]): Promise<number> {
  let count = 0;
  for (const g of games) {
    await sql`
      INSERT INTO nba_games (game_id, game_date, season, home_team_id, away_team_id, home_score, away_score, status, updated_at)
      VALUES (
        ${g.GAME_ID},
        ${g.GAME_DATE ?? null},
        ${g.SEASON ?? null},
        ${g.HOME_TEAM_ID != null ? Number(g.HOME_TEAM_ID) : null},
        ${g.AWAY_TEAM_ID != null ? Number(g.AWAY_TEAM_ID) : null},
        ${g.HOME_SCORE != null ? Number(g.HOME_SCORE) : null},
        ${g.AWAY_SCORE != null ? Number(g.AWAY_SCORE) : null},
        ${g.STATUS ?? null},
        NOW()
      )
      ON CONFLICT (game_id) DO UPDATE SET
        game_date = EXCLUDED.game_date,
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;
    count++;
  }
  return count;
}

export async function upsertPlayerGameStats(sql: Sql, stats: Row[]): Promise<number> {
  let count = 0;
  for (const s of stats) {
    await sql`
      INSERT INTO nba_player_game_stats (
        game_id, player_id, team_id, minutes, pts, reb, ast, stl, blk, tov,
        fgm, fga, fg_pct, fg3m, fg3a, fg3_pct, ftm, fta, ft_pct, plus_minus, updated_at
      ) VALUES (
        ${s.GAME_ID},
        ${Number(s.PLAYER_ID)},
        ${s.TEAM_ID != null ? Number(s.TEAM_ID) : null},
        ${s.MIN != null ? Number(s.MIN) : null},
        ${s.PTS != null ? Number(s.PTS) : null},
        ${s.REB != null ? Number(s.REB) : null},
        ${s.AST != null ? Number(s.AST) : null},
        ${s.STL != null ? Number(s.STL) : null},
        ${s.BLK != null ? Number(s.BLK) : null},
        ${s.TOV != null ? Number(s.TOV) : null},
        ${s.FGM != null ? Number(s.FGM) : null},
        ${s.FGA != null ? Number(s.FGA) : null},
        ${s.FG_PCT != null ? Number(s.FG_PCT) : null},
        ${s.FG3M != null ? Number(s.FG3M) : null},
        ${s.FG3A != null ? Number(s.FG3A) : null},
        ${s.FG3_PCT != null ? Number(s.FG3_PCT) : null},
        ${s.FTM != null ? Number(s.FTM) : null},
        ${s.FTA != null ? Number(s.FTA) : null},
        ${s.FT_PCT != null ? Number(s.FT_PCT) : null},
        ${s.PLUS_MINUS != null ? Number(s.PLUS_MINUS) : null},
        NOW()
      )
      ON CONFLICT (game_id, player_id) DO UPDATE SET
        pts = EXCLUDED.pts, reb = EXCLUDED.reb, ast = EXCLUDED.ast,
        stl = EXCLUDED.stl, blk = EXCLUDED.blk, tov = EXCLUDED.tov,
        fgm = EXCLUDED.fgm, fga = EXCLUDED.fga, fg_pct = EXCLUDED.fg_pct,
        fg3m = EXCLUDED.fg3m, fg3a = EXCLUDED.fg3a, fg3_pct = EXCLUDED.fg3_pct,
        ftm = EXCLUDED.ftm, fta = EXCLUDED.fta, ft_pct = EXCLUDED.ft_pct,
        plus_minus = EXCLUDED.plus_minus, updated_at = NOW()
    `;
    count++;
  }
  return count;
}

/** Log a raw ingestion to the bronze table */
export async function logBronzeIngestion(
  sql: Sql,
  source: string,
  endpoint: string,
  params: Record<string, string | number>,
  rawResponse: unknown,
  rowCount: number
): Promise<void> {
  await sql`
    INSERT INTO nba_bronze_ingestions (source, endpoint, params_json, raw_response, row_count)
    VALUES (${source}, ${endpoint}, ${JSON.stringify(params)}, ${JSON.stringify(rawResponse)}, ${rowCount})
  `;
}

export async function upsertOdds(sql: Sql, rows: OddsRow[]): Promise<number> {
  let count = 0;
  for (const r of rows) {
    await sql`
      INSERT INTO nba_odds (event_id, bookmaker, spread_home, spread_away, over_under, home_ml, away_ml, home_team, away_team, commence_time)
      VALUES (${r.event_id}, ${r.bookmaker}, ${r.spread_home}, ${r.spread_away}, ${r.over_under}, ${r.home_ml ?? null}, ${r.away_ml ?? null}, ${r.home_team}, ${r.away_team}, ${r.commence_time})
      ON CONFLICT (event_id, bookmaker, captured_at) DO NOTHING
    `;
    count++;
  }
  return count;
}

/**
 * Log a served prediction for later accuracy settlement.
 * Idempotent on (event_id, calibration_version) — calling repeatedly with the
 * same event/version is a no-op, so the today.ts endpoint can safely fire it
 * on every fetch without inflating the table.
 */
export async function logPredictionServed(sql: Sql, row: {
  event_id: string;
  game_id?: string | null;
  predicted_spread: number;
  vegas_spread: number | null;
  calibration_version: string;
}): Promise<void> {
  await sql`
    INSERT INTO nba_prediction_results (event_id, game_id, predicted_spread, vegas_spread, calibration_version)
    VALUES (${row.event_id}, ${row.game_id ?? null}, ${row.predicted_spread}, ${row.vegas_spread ?? null}, ${row.calibration_version})
    ON CONFLICT (event_id, calibration_version) DO NOTHING
  `;
}

/**
 * Fill in actual_margin and derived ATS/beat_vegas fields for predictions
 * whose game has finished. Returns the count of rows newly settled.
 */
export async function settlePredictions(sql: Sql): Promise<number> {
  const rows = await sql`
    WITH unsettled AS (
      SELECT pr.id, pr.predicted_spread, pr.vegas_spread, g.home_score, g.away_score
      FROM nba_prediction_results pr
      JOIN nba_games g ON g.game_id = pr.game_id
      WHERE pr.settled_at IS NULL
        AND pr.game_id IS NOT NULL
        AND g.home_score IS NOT NULL
        AND g.away_score IS NOT NULL
        AND g.status = 'Final'
    )
    UPDATE nba_prediction_results pr
    SET actual_margin = (u.home_score - u.away_score),
        beat_vegas = (
          ABS(pr.predicted_spread - (u.home_score - u.away_score)) <
          ABS(COALESCE(pr.vegas_spread, 0) - (u.home_score - u.away_score))
        ),
        ats_result = CASE
          WHEN pr.vegas_spread IS NULL THEN NULL
          WHEN pr.predicted_spread < pr.vegas_spread THEN
            CASE
              WHEN (u.home_score - u.away_score) < pr.vegas_spread THEN 'cover'
              WHEN (u.home_score - u.away_score) = pr.vegas_spread THEN 'push'
              ELSE 'miss'
            END
          ELSE
            CASE
              WHEN (u.home_score - u.away_score) > pr.vegas_spread THEN 'cover'
              WHEN (u.home_score - u.away_score) = pr.vegas_spread THEN 'push'
              ELSE 'miss'
            END
        END,
        settled_at = NOW()
    FROM unsettled u
    WHERE pr.id = u.id
    RETURNING pr.id
  `;
  return rows.length;
}

export async function insertPrediction(sql: Sql, pred: {
  event_id: string; game_id?: string; calibration_version: string;
  sim_count: number; sim_median_spread: number; sim_mean_spread: number;
  sim_stddev: number; sim_home_win_pct: number; vegas_spread: number;
  edge: number; edge_direction: string; confidence: string;
  synergy_buffs_home: any; synergy_buffs_away: any;
  home_team: string; away_team: string; roster_source: string;
}): Promise<void> {
  await sql`
    INSERT INTO nba_predictions (event_id, game_id, calibration_version, sim_count, sim_median_spread, sim_mean_spread, sim_stddev, sim_home_win_pct, vegas_spread, edge, edge_direction, confidence, synergy_buffs_home, synergy_buffs_away, home_team, away_team, roster_source)
    VALUES (${pred.event_id}, ${pred.game_id ?? null}, ${pred.calibration_version}, ${pred.sim_count}, ${pred.sim_median_spread}, ${pred.sim_mean_spread}, ${pred.sim_stddev}, ${pred.sim_home_win_pct}, ${pred.vegas_spread}, ${pred.edge}, ${pred.edge_direction}, ${pred.confidence}, ${JSON.stringify(pred.synergy_buffs_home)}, ${JSON.stringify(pred.synergy_buffs_away)}, ${pred.home_team}, ${pred.away_team}, ${pred.roster_source})
    ON CONFLICT (event_id, calibration_version) DO UPDATE SET
      sim_median_spread = EXCLUDED.sim_median_spread, sim_mean_spread = EXCLUDED.sim_mean_spread,
      sim_stddev = EXCLUDED.sim_stddev, sim_home_win_pct = EXCLUDED.sim_home_win_pct,
      vegas_spread = EXCLUDED.vegas_spread, edge = EXCLUDED.edge,
      edge_direction = EXCLUDED.edge_direction, confidence = EXCLUDED.confidence,
      synergy_buffs_home = EXCLUDED.synergy_buffs_home, synergy_buffs_away = EXCLUDED.synergy_buffs_away,
      roster_source = EXCLUDED.roster_source
  `;
}
