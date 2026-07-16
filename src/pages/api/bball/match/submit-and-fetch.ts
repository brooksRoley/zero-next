import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { applyBballCors } from "src/lib/bballCors";
import { loadRoster } from "src/lib/bball/roster";
import { sanitizeBoard } from "src/lib/bball/validateBoard";

const BOT_BOARD = {
  is_bot: true,
  team_name: "Rookie AI",
  units: [
    { id: "bot_1", name: "Bench Warmer", cost: 1, x: 2, y: 3, stats: { shooting: 40, defense: 40, speed: 40 } },
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const { run_id, round_number, board_data } = (req.body ?? {}) as {
    run_id?: unknown;
    round_number?: unknown;
    board_data?: unknown;
  };
  if (typeof run_id !== "string" || !Number.isInteger(round_number) || !board_data) {
    return res.status(400).json({ error: "run_id, round_number, and board_data required" });
  }

  // Boards can only be filed against a live run, at its actual round —
  // otherwise anyone could seed arbitrary rounds of the ghost pool.
  const runs = await sql`
    SELECT current_round, status FROM bball_runs WHERE id = ${run_id}
  `;
  if (!runs.length) return res.status(404).json({ error: "Run not found" });
  const run = runs[0] as { current_round: number; status: string };
  if (run.status !== "active") return res.status(409).json({ error: "Run is not active" });
  if (run.current_round !== round_number) {
    return res.status(409).json({ error: `round_number ${round_number} does not match the run's current round ${run.current_round}` });
  }

  const check = sanitizeBoard(board_data, round_number as number, await loadRoster());
  if (!check.ok) return res.status(400).json({ error: check.error });

  // Upsert: re-locking the same round replaces the board instead of stacking
  // duplicate rows (unique index created in /api/bball/setup).
  await sql`
    INSERT INTO bball_board_states (run_id, round_number, board_data)
    VALUES (${run_id}, ${round_number}, ${JSON.stringify(check.board)})
    ON CONFLICT (run_id, round_number)
    DO UPDATE SET board_data = EXCLUDED.board_data
  `;

  // Fetch a random opponent from the same round (excluding this run)
  const rows = await sql`
    SELECT board_data FROM bball_board_states
    WHERE round_number = ${round_number} AND run_id != ${run_id}
    ORDER BY RANDOM() LIMIT 1
  `;

  const opponent_board = rows.length > 0 ? rows[0].board_data : BOT_BOARD;
  res.status(200).json({ opponent_board });
}
