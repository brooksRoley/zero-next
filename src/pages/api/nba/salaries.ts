/**
 * GET /api/nba/salaries — team payrolls and per-player contracts for the
 * salary-cap visualization and trade machine. Data is the latest
 * nba_player_salaries ingest (ESPN contracts, refreshed daily by cron).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { TEAMS_BY_ID } from "src/lib/nba/teams-static";
import {
  CAP_SEASON_LABEL,
  CAP_SEASON_YEAR,
  SALARY_CAP,
  SALARY_FLOOR,
  LUXURY_TAX,
  FIRST_APRON,
  SECOND_APRON,
} from "src/lib/nba/capConstants";

export type SalaryPlayer = {
  id: number;
  name: string;
  salary: number;
  incoming: number;
  outgoing: number;
  yearsRemaining: number;
  optionType: number;
  minimum: boolean;
};

export type SalaryTeam = {
  teamId: number;
  abbrev: string;
  name: string;
  payroll: number;
  players: SalaryPlayer[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = (await sql`
      SELECT s.player_id, s.team_id, s.salary, s.incoming_trade_value,
             s.outgoing_trade_value, s.years_remaining, s.option_type,
             s.minimum_salary_exception, p.player_name,
             MAX(s.updated_at) OVER () AS latest
      FROM nba_player_salaries s
      LEFT JOIN nba_players p ON p.player_id = s.player_id
      WHERE s.season_year = ${CAP_SEASON_YEAR}
      ORDER BY s.salary DESC
    `) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return res.status(503).json({
        error: "No salary data ingested yet — run /api/nba/admin/ingest-salaries",
      });
    }

    const byTeam = new Map<number, SalaryTeam>();
    let unattributed = 0;
    for (const r of rows) {
      const teamId = r.team_id == null ? null : Number(r.team_id);
      const staticTeam = teamId != null ? TEAMS_BY_ID.get(teamId) : undefined;
      if (!staticTeam) {
        unattributed++;
        continue;
      }
      let team = byTeam.get(staticTeam.id);
      if (!team) {
        team = {
          teamId: staticTeam.id,
          abbrev: staticTeam.abbreviation,
          name: staticTeam.full_name,
          payroll: 0,
          players: [],
        };
        byTeam.set(staticTeam.id, team);
      }
      const salary = Number(r.salary);
      team.payroll += salary;
      team.players.push({
        id: Number(r.player_id),
        name: String(r.player_name ?? `Player ${r.player_id}`),
        salary,
        incoming: Number(r.incoming_trade_value ?? salary),
        outgoing: Number(r.outgoing_trade_value ?? salary),
        yearsRemaining: Number(r.years_remaining ?? 0),
        optionType: Number(r.option_type ?? 0),
        minimum: Boolean(r.minimum_salary_exception),
      });
    }

    const teams = [...byTeam.values()].sort((a, b) => b.payroll - a.payroll);

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({
      season: CAP_SEASON_LABEL,
      thresholds: {
        cap: SALARY_CAP,
        floor: SALARY_FLOOR,
        tax: LUXURY_TAX,
        firstApron: FIRST_APRON,
        secondApron: SECOND_APRON,
      },
      teams,
      contracts: rows.length,
      unattributed,
      updatedAt: rows[0]?.latest ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}
