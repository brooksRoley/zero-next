/**
 * Export NBA roster to shared-core engine format.
 * Usage: POSTGRES_URL="..." npx tsx scripts/export-roster.ts [output-path]
 *
 * Fetches players from the DB (populated by ingest pipeline),
 * maps stats to engine scale, and writes roster.json.
 */
import { neon } from '@neondatabase/serverless';
import { mapPlayerToEngine, DEFAULT_COEFFICIENTS } from '../src/lib/nba/sim/stat-mapper';
import { dbRowToRealStats } from '../src/lib/nba/sim/roster-builder';
import * as fs from 'fs';
import * as path from 'path';

const SALARY_CAP = 151_000_000;

function determineCost(salary: number): number {
  const pct = salary / SALARY_CAP;
  if (pct >= 0.25) return 5;
  if (pct >= 0.15) return 4;
  if (pct >= 0.08) return 3;
  if (pct >= 0.03) return 2;
  return 1;
}

async function main() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    console.error('POSTGRES_URL required');
    process.exit(1);
  }

  const sql = neon(postgresUrl);
  const outputPath = process.argv[2] || './roster.json';

  // Fetch all players with season stats and team advanced stats for engine mapping
  const rows = await sql`
    SELECT
      p.player_id,
      p.player_name,
      p.team_id,
      p.team_abbreviation AS team,
      p.position,
      s.ppg, s.rpg, s.apg, s.spg, s.bpg, s.mpg,
      s.fg_pct, s.fg3_pct, s.ft_pct, s.plus_minus_avg,
      ts.def_rtg  AS team_def_rtg,
      ts.pace     AS team_pace
    FROM nba_players p
    JOIN nba_player_season_stats s
      ON p.player_id = s.player_id
    LEFT JOIN nba_team_season_stats ts
      ON p.team_id = ts.team_id AND s.season = ts.season
    WHERE s.season = (SELECT MAX(season) FROM nba_player_season_stats)
      AND s.mpg >= 15
    ORDER BY s.ppg DESC
    LIMIT 200
  `;

  console.log(`Fetched ${rows.length} players from DB`);

  const players = rows.map((row: any, idx: number) => {
    const realStats = dbRowToRealStats(row);
    const engine = mapPlayerToEngine(realStats, DEFAULT_COEFFICIENTS);

    return {
      id: row.player_id || idx + 1,
      name: row.player_name,
      team: row.team || '',
      position: row.position || 'SF',
      cost: determineCost(row.salary || 0),
      stats: {
        shooting: Math.round(engine.shooting),
        speed: Math.round(engine.speed),
        defense: Math.round(engine.defense),
        rebounding: Math.round(Math.min(99, Math.max(1, 50 + (Number(row.rpg) - 5) * 5))),
        playmaking: Math.round(Math.min(99, Math.max(1, 50 + (Number(row.apg) - 3) * 6))),
      },
      heightInches: realStats.height_inches,
    };
  });

  const output = { players };
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(output, null, 2));
  console.log(`Exported ${players.length} players to ${outputPath}`);
}

main().catch(console.error);
