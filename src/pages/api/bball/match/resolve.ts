import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { run_id, result } = req.body as { run_id?: string; result?: string };
  if (!run_id || !result) return res.status(400).json({ error: "run_id and result required" });

  const runs = await sql`
    SELECT health, current_round FROM bball_runs
    WHERE id = ${run_id} AND status = 'active'
  `;
  if (!runs.length) return res.status(400).json({ error: "Run not found or already ended" });

  const { health, current_round } = runs[0] as { health: number; current_round: number };
  let new_health = health;
  const new_round = current_round + 1;

  if (result === "loss") new_health -= 20;

  const status = new_health <= 0 ? "lost" : new_round > 10 ? "won" : "active";

  await sql`
    UPDATE bball_runs
    SET health = ${new_health}, current_round = ${new_round}, status = ${status}
    WHERE id = ${run_id}
  `;

  res.status(200).json({ health: new_health, current_round: new_round, status });
}
