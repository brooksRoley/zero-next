/**
 * The Odds API client for NBA spreads.
 * https://the-odds-api.com/
 */
import { z } from "zod";

const ODDS_BASE = "https://api.the-odds-api.com/v4";

export const OddsSchema = z.object({
  event_id: z.string(),
  bookmaker: z.string(),
  spread_home: z.number(),
  spread_away: z.number(),
  over_under: z.number().nullable(),
  home_ml: z.number().nullable().optional(),
  away_ml: z.number().nullable().optional(),
  home_team: z.string(),
  away_team: z.string(),
  commence_time: z.string(),
});

export type OddsRow = z.infer<typeof OddsSchema>;

export function parseOddsResponse(event: any): OddsRow[] {
  const rows: OddsRow[] = [];

  for (const bk of event.bookmakers ?? []) {
    const spreads = bk.markets?.find((m: any) => m.key === "spreads");
    const totals = bk.markets?.find((m: any) => m.key === "totals");
    const h2h = bk.markets?.find((m: any) => m.key === "h2h");

    if (!spreads) continue;

    const homeOutcome = spreads.outcomes.find((o: any) => o.name === event.home_team);
    const awayOutcome = spreads.outcomes.find((o: any) => o.name === event.away_team);
    if (!homeOutcome || !awayOutcome) continue;

    const overOutcome = totals?.outcomes?.find((o: any) => o.name === "Over");

    const homeH2h = h2h?.outcomes?.find((o: any) => o.name === event.home_team);
    const awayH2h = h2h?.outcomes?.find((o: any) => o.name === event.away_team);

    rows.push({
      event_id: event.id,
      bookmaker: bk.key,
      spread_home: homeOutcome.point,
      spread_away: awayOutcome.point,
      over_under: overOutcome?.point ?? null,
      home_ml: homeH2h?.price ?? null,
      away_ml: awayH2h?.price ?? null,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
    });
  }

  return rows;
}

export function consensusSpread(rows: OddsRow[]): number {
  const spreads = rows.map((r) => r.spread_home).sort((a, b) => a - b);
  const mid = Math.floor(spreads.length / 2);
  if (spreads.length % 2 === 0) {
    return (spreads[mid - 1] + spreads[mid]) / 2;
  }
  return spreads[mid];
}

export async function fetchOdds(apiKey: string): Promise<any[]> {
  const url = `${ODDS_BASE}/sports/basketball_nba/odds/?apiKey=${apiKey}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Odds API returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
