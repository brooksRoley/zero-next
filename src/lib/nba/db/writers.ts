/**
 * Upsert functions for NBA silver tables.
 * Each function maps NbaRow fields to table columns and uses ON CONFLICT for idempotency.
 */
import type { NbaRow } from "../client";

export async function upsertPlayers(sql: any, players: NbaRow[]): Promise<number> {
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

export async function upsertTeams(sql: any, teams: NbaRow[]): Promise<number> {
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

export async function upsertGames(sql: any, games: NbaRow[]): Promise<number> {
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

export async function upsertPlayerGameStats(sql: any, stats: NbaRow[]): Promise<number> {
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
  sql: any,
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
