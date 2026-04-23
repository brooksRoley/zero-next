/**
 * Seed NBA silver tables with fixture data for development/testing.
 * Usage: POSTGRES_URL="postgres://..." npx tsx scripts/seed-fixtures.ts
 */
import { neon } from "@neondatabase/serverless";
import { upsertPlayers, upsertTeams, upsertPlayerGameStats, logBronzeIngestion } from "../src/lib/nba/db/writers";
import {
  SAMPLE_PLAYERS, SAMPLE_TEAMS, SAMPLE_GAMES, SAMPLE_GAME_LOG,
  PLAYER_LEBRON, PLAYER_AD, PLAYER_REAVES,
} from "../src/lib/nba/tests/fixtures";
import type { NbaRow } from "../src/lib/nba/client";

// Expanded team roster from static data for silver seeding
const ALL_TEAMS: NbaRow[] = [
  { TeamID: 1610612737, TeamName: "Hawks", TeamCity: "Atlanta", TEAM_ABBREVIATION: "ATL", Conference: "East", Division: "Southeast" },
  { TeamID: 1610612738, TeamName: "Celtics", TeamCity: "Boston", TEAM_ABBREVIATION: "BOS", Conference: "East", Division: "Atlantic" },
  { TeamID: 1610612751, TeamName: "Nets", TeamCity: "Brooklyn", TEAM_ABBREVIATION: "BKN", Conference: "East", Division: "Atlantic" },
  { TeamID: 1610612766, TeamName: "Hornets", TeamCity: "Charlotte", TEAM_ABBREVIATION: "CHA", Conference: "East", Division: "Southeast" },
  { TeamID: 1610612741, TeamName: "Bulls", TeamCity: "Chicago", TEAM_ABBREVIATION: "CHI", Conference: "East", Division: "Central" },
  { TeamID: 1610612739, TeamName: "Cavaliers", TeamCity: "Cleveland", TEAM_ABBREVIATION: "CLE", Conference: "East", Division: "Central" },
  { TeamID: 1610612742, TeamName: "Mavericks", TeamCity: "Dallas", TEAM_ABBREVIATION: "DAL", Conference: "West", Division: "Southwest" },
  { TeamID: 1610612743, TeamName: "Nuggets", TeamCity: "Denver", TEAM_ABBREVIATION: "DEN", Conference: "West", Division: "Northwest" },
  { TeamID: 1610612765, TeamName: "Pistons", TeamCity: "Detroit", TEAM_ABBREVIATION: "DET", Conference: "East", Division: "Central" },
  { TeamID: 1610612744, TeamName: "Warriors", TeamCity: "Golden State", TEAM_ABBREVIATION: "GSW", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612745, TeamName: "Rockets", TeamCity: "Houston", TEAM_ABBREVIATION: "HOU", Conference: "West", Division: "Southwest" },
  { TeamID: 1610612754, TeamName: "Pacers", TeamCity: "Indiana", TEAM_ABBREVIATION: "IND", Conference: "East", Division: "Central" },
  { TeamID: 1610612746, TeamName: "Clippers", TeamCity: "Los Angeles", TEAM_ABBREVIATION: "LAC", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612747, TeamName: "Lakers", TeamCity: "Los Angeles", TEAM_ABBREVIATION: "LAL", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612763, TeamName: "Grizzlies", TeamCity: "Memphis", TEAM_ABBREVIATION: "MEM", Conference: "West", Division: "Southwest" },
  { TeamID: 1610612748, TeamName: "Heat", TeamCity: "Miami", TEAM_ABBREVIATION: "MIA", Conference: "East", Division: "Southeast" },
  { TeamID: 1610612749, TeamName: "Bucks", TeamCity: "Milwaukee", TEAM_ABBREVIATION: "MIL", Conference: "East", Division: "Central" },
  { TeamID: 1610612750, TeamName: "Timberwolves", TeamCity: "Minnesota", TEAM_ABBREVIATION: "MIN", Conference: "West", Division: "Northwest" },
  { TeamID: 1610612740, TeamName: "Pelicans", TeamCity: "New Orleans", TEAM_ABBREVIATION: "NOP", Conference: "West", Division: "Southwest" },
  { TeamID: 1610612752, TeamName: "Knicks", TeamCity: "New York", TEAM_ABBREVIATION: "NYK", Conference: "East", Division: "Atlantic" },
  { TeamID: 1610612760, TeamName: "Thunder", TeamCity: "Oklahoma City", TEAM_ABBREVIATION: "OKC", Conference: "West", Division: "Northwest" },
  { TeamID: 1610612753, TeamName: "Magic", TeamCity: "Orlando", TEAM_ABBREVIATION: "ORL", Conference: "East", Division: "Southeast" },
  { TeamID: 1610612755, TeamName: "76ers", TeamCity: "Philadelphia", TEAM_ABBREVIATION: "PHI", Conference: "East", Division: "Atlantic" },
  { TeamID: 1610612756, TeamName: "Suns", TeamCity: "Phoenix", TEAM_ABBREVIATION: "PHX", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612757, TeamName: "Trail Blazers", TeamCity: "Portland", TEAM_ABBREVIATION: "POR", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612758, TeamName: "Kings", TeamCity: "Sacramento", TEAM_ABBREVIATION: "SAC", Conference: "West", Division: "Pacific" },
  { TeamID: 1610612759, TeamName: "Spurs", TeamCity: "San Antonio", TEAM_ABBREVIATION: "SAS", Conference: "West", Division: "Southwest" },
  { TeamID: 1610612761, TeamName: "Raptors", TeamCity: "Toronto", TEAM_ABBREVIATION: "TOR", Conference: "East", Division: "Atlantic" },
  { TeamID: 1610612762, TeamName: "Jazz", TeamCity: "Utah", TEAM_ABBREVIATION: "UTA", Conference: "West", Division: "Northwest" },
  { TeamID: 1610612764, TeamName: "Wizards", TeamCity: "Washington", TEAM_ABBREVIATION: "WAS", Conference: "East", Division: "Southeast" },
];

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL required");
    process.exit(1);
  }

  const sql = neon(url);
  console.log("=== Seeding NBA Silver Tables ===\n");

  // Teams (all 30)
  const teamCount = await upsertTeams(sql, ALL_TEAMS);
  console.log(`[teams] Seeded ${teamCount} teams`);

  // Players (Lakers core)
  const playerCount = await upsertPlayers(sql, SAMPLE_PLAYERS);
  console.log(`[players] Seeded ${playerCount} players`);

  // Games
  for (const g of SAMPLE_GAMES) {
    await sql`
      INSERT INTO nba_games (game_id, game_date, season, status, updated_at)
      VALUES (${g.GAME_ID}, ${g.GAME_DATE}, '2025-26', 'Final', NOW())
      ON CONFLICT (game_id) DO UPDATE SET status = 'Final', updated_at = NOW()
    `;
  }
  console.log(`[games] Seeded ${SAMPLE_GAMES.length} games`);

  // Player game stats (LeBron's game log entries)
  const gameLogWithPlayer = SAMPLE_GAME_LOG.map((gl) => ({
    ...gl,
    PLAYER_ID: 2544,
    TEAM_ID: 1610612747,
  }));
  const statCount = await upsertPlayerGameStats(sql, gameLogWithPlayer);
  console.log(`[game_stats] Seeded ${statCount} player game stat rows`);

  // Standings
  const standingsData = [
    { teamId: 1610612760, conf: "West", div: "Northwest", w: 58, l: 14, pct: 0.806, rank: 1 },
    { teamId: 1610612739, conf: "East", div: "Central", w: 55, l: 17, pct: 0.764, rank: 1 },
    { teamId: 1610612738, conf: "East", div: "Atlantic", w: 54, l: 18, pct: 0.75, rank: 2 },
    { teamId: 1610612743, conf: "West", div: "Northwest", w: 50, l: 22, pct: 0.694, rank: 3 },
    { teamId: 1610612747, conf: "West", div: "Pacific", w: 44, l: 28, pct: 0.611, rank: 5 },
  ];
  for (const s of standingsData) {
    await sql`
      INSERT INTO nba_standings (team_id, season, conference, division, wins, losses, win_pct, playoff_rank, updated_at)
      VALUES (${s.teamId}, '2025-26', ${s.conf}, ${s.div}, ${s.w}, ${s.l}, ${s.pct}, ${s.rank}, NOW())
      ON CONFLICT (team_id, season) DO UPDATE SET
        wins = EXCLUDED.wins, losses = EXCLUDED.losses, win_pct = EXCLUDED.win_pct,
        playoff_rank = EXCLUDED.playoff_rank, updated_at = NOW()
    `;
  }
  console.log(`[standings] Seeded ${standingsData.length} standings rows`);

  // Gold: compute LeBron's season stats from game log
  const lebronGames = SAMPLE_GAME_LOG;
  const gp = lebronGames.length;
  const ppg = lebronGames.reduce((s, g) => s + Number(g.PTS), 0) / gp;
  const rpg = lebronGames.reduce((s, g) => s + Number(g.REB), 0) / gp;
  const apg = lebronGames.reduce((s, g) => s + Number(g.AST), 0) / gp;
  const mpg = lebronGames.reduce((s, g) => s + Number(g.MIN), 0) / gp;

  await sql`
    INSERT INTO nba_player_season_stats (player_id, season, team_id, games_played, mpg, ppg, rpg, apg, updated_at)
    VALUES (2544, '2025-26', 1610612747, ${gp}, ${mpg}, ${ppg}, ${rpg}, ${apg}, NOW())
    ON CONFLICT (player_id, season) DO UPDATE SET
      games_played = EXCLUDED.games_played, mpg = EXCLUDED.mpg,
      ppg = EXCLUDED.ppg, rpg = EXCLUDED.rpg, apg = EXCLUDED.apg, updated_at = NOW()
  `;
  console.log(`[gold] Computed LeBron season stats: ${ppg.toFixed(1)} ppg, ${rpg.toFixed(1)} rpg, ${apg.toFixed(1)} apg`);

  // Bronze: log the seed as an ingestion
  await logBronzeIngestion(sql, "seed-fixtures", "manual", {}, { note: "fixture seed" }, playerCount + teamCount);
  console.log(`[bronze] Logged seed ingestion`);

  // Verify
  console.log("\n=== DB Verification ===");
  const checks = await Promise.all([
    sql`SELECT COUNT(*) as count FROM nba_teams`,
    sql`SELECT COUNT(*) as count FROM nba_players`,
    sql`SELECT COUNT(*) as count FROM nba_games`,
    sql`SELECT COUNT(*) as count FROM nba_player_game_stats`,
    sql`SELECT COUNT(*) as count FROM nba_standings`,
    sql`SELECT COUNT(*) as count FROM nba_player_season_stats`,
    sql`SELECT COUNT(*) as count FROM nba_bronze_ingestions`,
  ]);
  const labels = ["nba_teams", "nba_players", "nba_games", "nba_player_game_stats", "nba_standings", "nba_player_season_stats", "nba_bronze_ingestions"];
  checks.forEach((c, i) => console.log(`  ${labels[i].padEnd(28)} ${c[0].count} rows`));
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
