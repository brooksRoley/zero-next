/**
 * stats.nba.com TypeScript client
 * Replaces the Python nba_api package with direct HTTP calls.
 */

const STATS_BASE = "https://stats.nba.com/stats";

const HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export interface NbaRow {
  [key: string]: string | number | null;
}

interface ResultSet {
  name: string;
  headers: string[];
  rowSet: (string | number | null)[][];
}

interface StatsResponse {
  resultSets?: ResultSet[];
  resultSet?: ResultSet;
}

/**
 * Call a stats.nba.com endpoint and return rows as keyed objects.
 * @param endpoint - e.g. "leaguestandingsv3"
 * @param params - query parameters
 * @param resultSetIndex - which resultSet to use (default 0)
 * @param resultSetName - optionally select by name instead of index
 */
export async function fetchStats(
  endpoint: string,
  params: Record<string, string | number> = {},
  options: { resultSetIndex?: number; resultSetName?: string } = {}
): Promise<NbaRow[]> {
  const url = new URL(`${STATS_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`stats.nba.com ${endpoint} returned ${res.status}`);
  }

  const json: StatsResponse = await res.json();

  // Some endpoints use resultSets (array), others use resultSet (single)
  let rs: ResultSet | undefined;
  if (json.resultSets) {
    if (options.resultSetName) {
      rs = json.resultSets.find((s) => s.name === options.resultSetName);
    } else {
      rs = json.resultSets[options.resultSetIndex ?? 0];
    }
  } else if (json.resultSet) {
    rs = json.resultSet;
  }

  if (!rs) return [];

  return rs.rowSet.map((row) => {
    const obj: NbaRow = {};
    rs!.headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

/**
 * Fetch multiple result sets from a single endpoint call.
 */
export async function fetchStatsMulti(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<Record<string, NbaRow[]>> {
  const url = new URL(`${STATS_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`stats.nba.com ${endpoint} returned ${res.status}`);
  }

  const json: StatsResponse = await res.json();
  const result: Record<string, NbaRow[]> = {};

  const sets = json.resultSets ?? (json.resultSet ? [json.resultSet] : []);
  for (const rs of sets) {
    result[rs.name] = rs.rowSet.map((row) => {
      const obj: NbaRow = {};
      rs.headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
  }

  return result;
}
