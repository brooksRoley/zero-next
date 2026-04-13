import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

const BOT_BOARD = {
  is_bot: true,
  team_name: "Rookie AI",
  units: [
    { id: "bot_1", name: "Bench Warmer", cost: 1, x: 2, y: 3, stats: { shooting: 40, defense: 40, speed: 40 } },
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { run_id, round_number, board_data } = req.body as {
    run_id?: string;
    round_number?: number;
    board_data?: object;
  };
  if (!run_id || round_number == null || !board_data) {
    return res.status(400).json({ error: "run_id, round_number, and board_data required" });
  }

  // Save this player's board
  await sql`
    INSERT INTO bball_board_states (run_id, round_number, board_data)
    VALUES (${run_id}, ${round_number}, ${JSON.stringify(board_data)})
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
