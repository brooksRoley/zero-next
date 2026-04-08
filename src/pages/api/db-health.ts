import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    res.status(200).json({
      status: "connected",
      time: result[0].current_time,
      version: result[0].pg_version,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ status: "error", message });
  }
}
