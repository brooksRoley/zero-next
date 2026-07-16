import type { NextApiRequest, NextApiResponse } from "next";
import { applyBballCors } from "src/lib/bballCors";
import { loadRoster } from "src/lib/bball/roster";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (applyBballCors(req, res)) return;
  try {
    const roster = await loadRoster();
    // Short cache: free-agency moves should reach shops within minutes of a
    // roster refresh, not the old 1-hour static window.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(roster);
  } catch {
    res.status(500).json({ error: "Roster unavailable" });
  }
}
