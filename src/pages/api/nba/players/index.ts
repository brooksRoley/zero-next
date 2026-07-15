/**
 * GET /api/nba/players — league player list with per-game season stats.
 * Reads the DB gold table (ESPN-fed by the daily ingest); stats.nba.com,
 * the old direct source, stopped responding from this infra in 2026.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { cached } from "src/lib/nba/cache";
import { currentNbaSeason } from "src/lib/nba/season";

const round1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10;

async function fetchPlayers(season: string) {
  const rows = (await sql`
    SELECT p.player_id, p.player_name, p.position, p.age,
           COALESCE(p.team_id, s.team_id) AS team_id,
           s.games_played, s.mpg, s.ppg, s.rpg, s.apg, s.spg, s.bpg, s.topg,
           s.fga, s.fg3a, s.fta, s.fg_pct, s.fg3_pct, s.ft_pct
    FROM nba_player_season_stats s
    JOIN nba_players p ON p.player_id = s.player_id
    WHERE s.season = ${season}
    ORDER BY s.ppg DESC
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: Number(r.player_id),
    name: String(r.player_name),
    team_id: r.team_id == null ? null : Number(r.team_id),
    pos: String(r.position ?? ""),
    age: r.age == null ? null : Number(r.age),
    gp: Number(r.games_played) || 0,
    mpg: round1(r.mpg),
    ppg: round1(r.ppg),
    rpg: round1(r.rpg),
    apg: round1(r.apg),
    spg: round1(r.spg),
    bpg: round1(r.bpg),
    topg: round1(r.topg),
    fga: round1(r.fga),
    fg3a: round1(r.fg3a),
    fta: round1(r.fta),
    fg_pct: Math.round((Number(r.fg_pct) || 0) * 1000) / 1000,
    fg3_pct: Math.round((Number(r.fg3_pct) || 0) * 1000) / 1000,
    ft_pct: Math.round((Number(r.ft_pct) || 0) * 1000) / 1000,
  }));
}

export async function getPlayers(season: string = currentNbaSeason()) {
  return cached(`players_${season}`, () => fetchPlayers(season), 600);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const season = (req.query.season as string) || currentNbaSeason();
    let data = await getPlayers(season);
    const tid = Number(req.query.team_id);
    if (tid) data = data.filter((p) => p.team_id === tid);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
    res.status(200).json({ data, _meta: { count: data.length, season, endpoint: "players" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(503).json({ error: msg });
  }
}
