import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await sql`
    CREATE TABLE IF NOT EXISTS characters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      one_liner VARCHAR(280) NOT NULL,
      profile TEXT NOT NULL,
      model VARCHAR(200) NOT NULL,
      color VARCHAR(7) NOT NULL,
      avatar_emoji VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  res.status(200).json({ success: true, message: "characters table created" });
}
