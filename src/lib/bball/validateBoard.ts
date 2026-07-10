import type { RosterPlayer, RosterStats } from "src/lib/bball/roster";

/**
 * Server-side board sanitizer for the ghost-matchmaking pool.
 *
 * Every board stored in bball_board_states is later served verbatim as a
 * real opponent to other players, so nothing client-supplied can be trusted:
 * a forged 99/99/99 board would poison every future match in its round.
 * Instead of rejecting bad stats, we rebuild each unit from the canonical
 * roster entry — name, team, cost, and stats all come from the server's
 * engine_roster.json; only rosterId, star level, and grid position are
 * accepted from the client (and each is bounds-checked).
 *
 * The rules mirrored here (team size cap, star-up multiplier, stat cap,
 * 5x5 planning grid) must stay in sync with BballTactics
 * client/game/economy.js and shared-core PlayerEntity::ClampStats.
 */

export const STAT_CAP = 99;
export const STAR_MULTIPLIER = 1.8;
export const MAX_STAR = 2;
export const GRID_MAX = 4; // planning grid coords are 0-4
export const TEAM_NAME_MAX = 40;

const SCHEME_ID = /^[a-z0-9_]{1,32}$/;

export type SanitizedUnit = {
  id: string;
  rosterId: number;
  name: string;
  team: string;
  cost: number;
  star: number;
  x: number;
  y: number;
  stats: RosterStats;
};

export type SanitizedBoard = {
  team_name: string;
  offense?: string;
  coverage?: string;
  units: SanitizedUnit[];
};

export type SanitizeResult =
  | { ok: true; board: SanitizedBoard }
  | { ok: false; error: string };

/** Max units on court, growing with the round (mirrors economy.js teamSizeCap). */
export function teamSizeCap(round: number): number {
  return Math.min(3 + Math.floor((round - 1) / 2), 5);
}

/** 2-star stats: base ×1.8, rounded, clamped (mirrors economy.js starUpStats). */
export function starUpStats(stats: RosterStats): RosterStats {
  const boost = (v: number) => Math.min(STAT_CAP, Math.round(v * STAR_MULTIPLIER));
  return {
    shooting: boost(stats.shooting),
    speed: boost(stats.speed),
    defense: boost(stats.defense),
  };
}

function cleanTeamName(value: unknown): string {
  if (typeof value !== "string") return "Ghost Team";
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, TEAM_NAME_MAX);
  return cleaned || "Ghost Team";
}

function cleanSchemeId(value: unknown): string | undefined {
  return typeof value === "string" && SCHEME_ID.test(value) ? value : undefined;
}

export function sanitizeBoard(
  input: unknown,
  round: number,
  roster: RosterPlayer[]
): SanitizeResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "board_data must be an object" };
  }
  const board = input as Record<string, unknown>;

  const units = board.units;
  if (!Array.isArray(units) || units.length === 0) {
    return { ok: false, error: "board_data.units must be a non-empty array" };
  }
  const cap = teamSizeCap(round);
  if (units.length > cap) {
    return { ok: false, error: `too many units: ${units.length} exceeds the round ${round} cap of ${cap}` };
  }

  const byId = new Map(roster.map((p) => [p.id, p]));
  const sanitized: SanitizedUnit[] = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (typeof u !== "object" || u === null || Array.isArray(u)) {
      return { ok: false, error: `unit ${i} must be an object` };
    }
    const unit = u as Record<string, unknown>;

    const rosterId = Number(unit.rosterId ?? unit.id);
    const player = Number.isInteger(rosterId) ? byId.get(rosterId) : undefined;
    if (!player) {
      return { ok: false, error: `unit ${i} has unknown rosterId ${String(unit.rosterId ?? unit.id)}` };
    }

    const star = unit.star === undefined ? 1 : unit.star;
    if (star !== 1 && star !== MAX_STAR) {
      return { ok: false, error: `unit ${i} has invalid star level ${String(unit.star)}` };
    }

    const x = unit.x;
    const y = unit.y;
    if (
      !Number.isInteger(x) || !Number.isInteger(y) ||
      (x as number) < 0 || (x as number) > GRID_MAX ||
      (y as number) < 0 || (y as number) > GRID_MAX
    ) {
      return { ok: false, error: `unit ${i} position must be integers in 0-${GRID_MAX}` };
    }

    // Rebuild everything else from the roster — client stats are ignored.
    sanitized.push({
      id: `unit_${i + 1}`,
      rosterId: player.id,
      name: player.name,
      team: player.team,
      cost: player.cost,
      star: star as number,
      x: x as number,
      y: y as number,
      stats: star === MAX_STAR ? starUpStats(player.stats) : { ...player.stats },
    });
  }

  return {
    ok: true,
    board: {
      team_name: cleanTeamName(board.team_name),
      offense: cleanSchemeId(board.offense),
      coverage: cleanSchemeId(board.coverage),
      units: sanitized,
    },
  };
}
