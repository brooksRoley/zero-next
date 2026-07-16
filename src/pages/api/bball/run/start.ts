import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { randomUUID } from "crypto";
import { applyBballCors } from "src/lib/bballCors";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const { player_id } = req.body as { player_id?: string };
  if (!player_id) return res.status(400).json({ error: "player_id required" });

  const run_id = randomUUID();
  await sql`
    INSERT INTO bball_runs (id, player_id, current_round, health, status)
    VALUES (${run_id}, ${player_id}, 1, 100, 'active')
  `;

  res.status(200).json({ run_id, health: 100, current_round: 1 });
}
