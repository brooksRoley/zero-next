import path from "path";
import fs from "fs";

export type RosterStats = { shooting: number; speed: number; defense: number };

export type RosterPlayer = {
  id: number;
  name: string;
  team: string;
  cost: number;
  is_active: boolean;
  injury_status: string;
  stats: RosterStats;
};

let cache: RosterPlayer[] | null = null;

/**
 * Canonical server-side roster — the same public/engine_roster.json the
 * client shops from. Boards are validated and rebuilt against this, so a
 * client can never persist stats the roster doesn't grant.
 */
export function loadRoster(): RosterPlayer[] {
  if (cache) return cache;
  const rosterPath = path.join(process.cwd(), "public", "engine_roster.json");
  cache = JSON.parse(fs.readFileSync(rosterPath, "utf-8")) as RosterPlayer[];
  return cache;
}
