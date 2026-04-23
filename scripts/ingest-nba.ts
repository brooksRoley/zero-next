/**
 * Ingest live NBA data from stats.nba.com into Neon silver tables.
 * Usage: POSTGRES_URL="postgres://..." npx tsx scripts/ingest-nba.ts
 *
 * Fetches: players, standings (teams derived), and logs to bronze.
 */
import { neon } from "@neondatabase/serverless";
import { fetchStats } from "../src/lib/nba/client";
import { PlayerSchema, StandingsSchema } from "../src/lib/nba/schemas";
import { validateRows } from "../src/lib/nba/validate";
import { upsertPlayers, upsertTeams, logBronzeIngestion } from "../src/lib/nba/db/writers";
import { currentNbaSeason } from "../src/lib/nba/season";
import type { NbaRow } from "../src/lib/nba/client";

// Accept season as CLI arg, default to current
const season = process.argv[2] || currentNbaSeason();

async function ingestPlayers(sql: any) {
  console.log(`\n[players] Fetching leaguedashplayerstats for ${season}...`);
  const params = {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Base",
    LeagueID: "00",
  };

  const rows = await fetchStats("leaguedashplayerstats", params);
  console.log(`[players] Received ${rows.length} rows`);

  // Bronze: log raw ingestion
  await logBronzeIngestion(sql, "stats.nba.com", "leaguedashplayerstats", params, rows.slice(0, 3), rows.length);
  console.log(`[players] Bronze ingestion logged`);

  // Validate
  const valid = validateRows(PlayerSchema, rows, "leaguedashplayerstats");
  console.log(`[players] ${valid.length}/${rows.length} passed validation`);

  // Silver: upsert
  const count = await upsertPlayers(sql, valid);
  console.log(`[players] Upserted ${count} players to silver`);
  return count;
}

async function ingestStandings(sql: any) {
  console.log(`\n[standings] Fetching leaguestandingsv3 for ${season}...`);
  const params = {
    LeagueID: "00",
    Season: season,
    SeasonType: "Regular Season",
  };

  const rows = await fetchStats("leaguestandingsv3", params, { resultSetName: "Standings" });
  console.log(`[standings] Received ${rows.length} rows`);

  // Bronze
  await logBronzeIngestion(sql, "stats.nba.com", "leaguestandingsv3", params, rows.slice(0, 3), rows.length);
  console.log(`[standings] Bronze ingestion logged`);

  // Validate
  const valid = validateRows(StandingsSchema, rows, "leaguestandingsv3");
  console.log(`[standings] ${valid.length}/${rows.length} passed validation`);

  // Silver: upsert teams from standings data
  const teamCount = await upsertTeams(sql, valid);
  console.log(`[standings] Upserted ${teamCount} teams to silver`);

  // Silver: upsert standings
  let standingsCount = 0;
  for (const s of valid) {
    await sql`
      INSERT INTO nba_standings (team_id, season, conference, division, wins, losses, win_pct, playoff_rank, updated_at)
      VALUES (
        ${Number(s.TeamID)}, ${season}, ${s.Conference}, ${s.Division},
        ${Number(s.WINS)}, ${Number(s.LOSSES)}, ${Number(s.WinPCT)},
        ${Number(s.PlayoffRank)}, NOW()
      )
      ON CONFLICT (team_id, season) DO UPDATE SET
        wins = EXCLUDED.wins, losses = EXCLUDED.losses,
        win_pct = EXCLUDED.win_pct, playoff_rank = EXCLUDED.playoff_rank,
        updated_at = NOW()
    `;
    standingsCount++;
  }
  console.log(`[standings] Upserted ${standingsCount} standings rows to silver`);
  return { teamCount, standingsCount };
}

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL required");
    process.exit(1);
  }

  const sql = neon(url);
  console.log(`=== NBA Data Ingestion — Season ${season} ===`);

  const playerCount = await ingestPlayers(sql);

  // Small delay to avoid rate limiting
  await new Promise((r) => setTimeout(r, 1000));

  const { teamCount, standingsCount } = await ingestStandings(sql);

  console.log("\n=== Summary ===");
  console.log(`Players:   ${playerCount}`);
  console.log(`Teams:     ${teamCount}`);
  console.log(`Standings: ${standingsCount}`);
  console.log("Bronze ingestion logs: 2 entries");

  // Verify counts
  const playerCheck = await sql`SELECT COUNT(*) as count FROM nba_players`;
  const teamCheck = await sql`SELECT COUNT(*) as count FROM nba_teams`;
  const standingsCheck = await sql`SELECT COUNT(*) as count FROM nba_standings`;
  const bronzeCheck = await sql`SELECT COUNT(*) as count FROM nba_bronze_ingestions`;

  console.log("\n=== DB Verification ===");
  console.log(`nba_players:            ${playerCheck[0].count} rows`);
  console.log(`nba_teams:              ${teamCheck[0].count} rows`);
  console.log(`nba_standings:          ${standingsCheck[0].count} rows`);
  console.log(`nba_bronze_ingestions:  ${bronzeCheck[0].count} rows`);
}

main().catch((e) => {
  console.error("Ingestion failed:", e);
  process.exit(1);
});
