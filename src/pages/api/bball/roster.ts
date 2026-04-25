import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rosterPath = path.join(process.cwd(), "public", "engine_roster.json");
  if (!fs.existsSync(rosterPath)) {
    return res.status(404).json({ error: "Roster not found" });
  }
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf-8"));
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.status(200).json(roster);
}
