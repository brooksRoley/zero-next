/**
 * One-time setup: creates TFT calibration tables in Neon.
 * GET /api/nba/tft/setup — admin-only, safe to re-run.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isValidAdminKey(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS nba_shots (
        id            BIGSERIAL PRIMARY KEY,
        game_id       TEXT NOT NULL,
        season        TEXT NOT NULL,
        player_id     INT  NOT NULL,
        team_id       INT  NOT NULL,
        period        INT  NOT NULL,
        seconds_left  INT  NOT NULL,
        loc_x         INT  NOT NULL,
        loc_y         INT  NOT NULL,
        shot_type     TEXT NOT NULL,
        shot_zone     TEXT NOT NULL,
        made          BOOLEAN NOT NULL,
        UNIQUE (game_id, player_id, period, seconds_left, loc_x, loc_y)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS nba_shots_season_player_idx ON nba_shots (season, player_id)`;
    await sql`CREATE INDEX IF NOT EXISTS nba_shots_game_idx ON nba_shots (game_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS tft_coefficients (
        id           SERIAL PRIMARY KEY,
        version      TEXT NOT NULL UNIQUE,
        fit_season   TEXT NOT NULL,
        active       BOOLEAN NOT NULL DEFAULT false,
        coefficients JSONB NOT NULL,
        metrics      JSONB NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS tft_coefficients_active_uniq ON tft_coefficients (active) WHERE active`;

    await sql`
      CREATE TABLE IF NOT EXISTS tft_predictions (
        id                 SERIAL PRIMARY KEY,
        version            TEXT NOT NULL,
        season             TEXT NOT NULL,
        team_id            INT  NOT NULL,
        player_id          INT,
        sim_wins           REAL,
        sim_box            JSONB,
        sim_shot_bins      JSONB,
        sim_pred_wins      REAL,
        sim_pred_box       JSONB,
        sim_pred_shot_bins JSONB,
        actual_wins        REAL,
        actual_box         JSONB,
        actual_shot_bins   JSONB,
        sim_replicates     INT NOT NULL,
        created_at         TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (version, season, team_id, player_id)
      )
    `;

    res.status(200).json({ ok: true, message: "tft tables ready" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Setup failed";
    res.status(500).json({ error: msg });
  }
}
