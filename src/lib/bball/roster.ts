import path from "path";
import fs from "fs";
import { sql } from "src/lib/db";

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

const TTL_MS = 5 * 60_000;
// The static fallback's ids are disjoint from the DB roster's ESPN ids, so a
// transient DB error mid-run would otherwise 400 every board submit for the
// full TTL. Retry the DB much sooner when we're serving the fallback.
const FALLBACK_TTL_MS = 30_000;
let cache: { data: RosterPlayer[]; at: number; ttl: number } | null = null;

/** Bust the in-memory copy after a refresh writes a new roster. */
export function clearRosterCache(): void {
  cache = null;
}

function loadStaticRoster(): RosterPlayer[] {
  const rosterPath = path.join(process.cwd(), "public", "engine_roster.json");
  return JSON.parse(fs.readFileSync(rosterPath, "utf-8")) as RosterPlayer[];
}

/**
 * Canonical server-side roster — what the client shops from and what boards
 * are validated and rebuilt against, so a client can never persist stats the
 * roster doesn't grant.
 *
 * DB-first: bball_roster is regenerated from real NBA data by
 * /api/bball/admin/refresh-roster (daily cron — free-agency team moves land
 * within a day). The checked-in public/engine_roster.json is the fallback
 * for fresh databases and offline dev. Inactive players stay in the result:
 * the shop filters them client-side, but boards already holding one must
 * keep validating.
 */
export async function loadRoster(): Promise<RosterPlayer[]> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.data;

  let data: RosterPlayer[] | null = null;
  try {
    const rows = (await sql`
      SELECT id, name, team, cost, shooting, speed, defense, is_active, injury_status
      FROM bball_roster
      ORDER BY cost DESC, name ASC
    `) as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      data = rows.map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        team: String(r.team ?? ""),
        cost: Number(r.cost),
        is_active: Boolean(r.is_active),
        injury_status: String(r.injury_status ?? ""),
        stats: {
          shooting: Number(r.shooting),
          speed: Number(r.speed),
          defense: Number(r.defense),
        },
      }));
    }
  } catch {
    // DB unreachable or table missing — serve the static fallback.
  }

  cache = data
    ? { data, at: Date.now(), ttl: TTL_MS }
    : { data: loadStaticRoster(), at: Date.now(), ttl: FALLBACK_TTL_MS };
  return cache.data;
}
