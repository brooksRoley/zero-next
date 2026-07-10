import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { applyBballCors } from "src/lib/bballCors";

const MAX_ROUNDS = 10; // mirrors economy.js MAX_ROUNDS
const LOSS_DAMAGE = 20;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const { run_id, round_number, result } = (req.body ?? {}) as {
    run_id?: unknown;
    round_number?: unknown;
    result?: unknown;
  };
  if (typeof run_id !== "string" || !Number.isInteger(round_number)) {
    return res.status(400).json({ error: "run_id and round_number required" });
  }
  if (result !== "win" && result !== "loss") {
    return res.status(400).json({ error: 'result must be "win" or "loss"' });
  }

  // A round can only resolve if its board was actually submitted — resolve
  // without a matchup is a forged result.
  const boards = await sql`
    SELECT id FROM bball_board_states
    WHERE run_id = ${run_id} AND round_number = ${round_number}
  `;
  if (!boards.length) {
    return res.status(409).json({ error: "No board submitted for this round" });
  }

  // Atomic, round-bound update: the WHERE clause makes a stale or repeated
  // resolve (replay, double-report, race) a no-op instead of extra damage
  // or free round advancement.
  const damage = result === "loss" ? LOSS_DAMAGE : 0;
  const rows = await sql`
    UPDATE bball_runs
    SET health = health - ${damage},
        current_round = current_round + 1,
        status = CASE
          WHEN health - ${damage} <= 0 THEN 'lost'
          WHEN current_round + 1 > ${MAX_ROUNDS} THEN 'won'
          ELSE 'active'
        END
    WHERE id = ${run_id} AND status = 'active' AND current_round = ${round_number}
    RETURNING health, current_round, status
  `;
  if (!rows.length) {
    return res.status(409).json({ error: "Run not found, already ended, or round already resolved" });
  }

  const { health, current_round, status } = rows[0] as {
    health: number;
    current_round: number;
    status: string;
  };
  res.status(200).json({ health, current_round, status });
}
