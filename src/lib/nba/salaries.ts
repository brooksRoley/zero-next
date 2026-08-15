/**
 * ESPN contract-data client for the salary-cap / trade-machine feature.
 *
 * ESPN's core API exposes per-player, per-season contract detail including
 * the CBA trade-matching numbers (incoming/outgoing trade value). There is
 * no bulk endpoint — contracts are fetched per player id with bounded
 * concurrency (~0.25s each, so a full league sweep is a few seconds).
 */
import { findTeamByEspnName } from "src/lib/nba/teams-static";

const CORE_BASE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
const SITE_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 25;

export type PlayerContract = {
  playerId: number;
  seasonYear: number;
  /** Canonical NBA team id (null when the ESPN team ref can't be mapped). */
  teamId: number | null;
  salary: number;
  incomingTradeValue: number;
  outgoingTradeValue: number;
  yearsRemaining: number;
  optionType: number;
  birdStatus: number;
  minimumSalaryException: boolean;
};

/** Minimal shape of an ESPN athlete-contract payload — only the fields
 *  parseContract reads; ESPN doesn't publish a schema for this endpoint. */
type EspnContractJson = {
  salary?: number;
  team?: { $ref?: string };
  incomingTradeValue?: number;
  outgoingTradeValue?: number;
  yearsRemaining?: number;
  optionType?: number;
  birdStatus?: number;
  minimumSalaryException?: boolean;
};

async function fetchJson<T = unknown>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 404) return null; // no contract for that season
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

/**
 * ESPN team id → canonical NBA team id, joined via displayName. Contract
 * payloads reference teams only by ESPN id.
 */
type EspnTeamsPage = {
  sports?: Array<{
    leagues?: Array<{ teams?: Array<{ team?: { id?: string; displayName?: string } }> }>;
  }>;
};

export async function fetchEspnTeamIdMap(): Promise<Map<number, number>> {
  const page = await fetchJson<EspnTeamsPage>(SITE_TEAMS);
  const map = new Map<number, number>();
  for (const entry of page?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
    const team = entry?.team;
    const espnId = Number(team?.id);
    const canonical = findTeamByEspnName(team?.displayName ?? "");
    if (Number.isInteger(espnId) && canonical) map.set(espnId, canonical.id);
  }
  if (map.size === 0) throw new Error("ESPN teams list came back empty");
  return map;
}

/** Exported for tests. */
export function parseContract(
  json: EspnContractJson,
  playerId: number,
  seasonYear: number,
  espnTeamToNba: Map<number, number>
): PlayerContract | null {
  const salary = Number(json?.salary);
  if (!Number.isFinite(salary) || salary <= 0) return null;
  const teamRef: string = json?.team?.$ref ?? "";
  const espnTeamId = Number(/\/teams\/(\d+)/.exec(teamRef)?.[1]);
  return {
    playerId,
    seasonYear,
    teamId: espnTeamToNba.get(espnTeamId) ?? null,
    salary,
    incomingTradeValue: Number(json?.incomingTradeValue) || salary,
    outgoingTradeValue: Number(json?.outgoingTradeValue) || salary,
    yearsRemaining: Number(json?.yearsRemaining) || 0,
    optionType: Number(json?.optionType) || 0,
    birdStatus: Number(json?.birdStatus) || 0,
    minimumSalaryException: Boolean(json?.minimumSalaryException),
  };
}

/**
 * Fetch one season's contract for every given player id. Players without a
 * contract that season (unsigned, retired) are skipped, not errors.
 */
export async function fetchContracts(
  playerIds: number[],
  seasonYear: number
): Promise<PlayerContract[]> {
  const espnTeamToNba = await fetchEspnTeamIdMap();
  const contracts: PlayerContract[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < playerIds.length) {
      const id = playerIds[cursor++];
      const json = await fetchJson<EspnContractJson>(
        `${CORE_BASE}/athletes/${id}/contracts/${seasonYear}?lang=en&region=us`
      );
      if (!json) continue;
      const parsed = parseContract(json, id, seasonYear, espnTeamToNba);
      if (parsed) contracts.push(parsed);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, playerIds.length) }, worker)
  );
  return contracts;
}
