/**
 * TFT backtest: CMA-ES regression of engine coefficients against the 2025-26
 * NBA season. Fits team W-L only in v1 (box + spatial deferred — player-id
 * spaces don't join between bball_roster and nba_player_season_stats).
 *
 * v1 compromises (documented in commit message):
 * 1. Roster source: bball_roster (top 5 by cost per team). ESPN athlete ids,
 *    not NBA player_ids — no join to nba_player_season_stats in v1.
 * 2. Actual wins from nba_standings.wins.
 * 3. W-L fit only: weights = {wl: 1, box: 0, spa: 0}. Regression code + tests
 *    remain live for when box/spatial data is joinable.
 * 4. Team join: match bball_roster.team → nba_teams.team_abbreviation.
 *    Rows with team='FA' or unmatched abbrev are skipped.
 * 5. CMA-ES: inline implementation (~μ/μ_w, λ)-CMA-ES with ask()/tell() API.
 *    No npm package for cma-es was found (E404 from registry as of 2026-07-16).
 *
 * Usage:
 *   yarn tft:backtest [--season 2025-26] [--generations 100]
 */
import { sql } from "src/lib/db";
import { simulateSeason, type SeasonInput } from "src/lib/nba/tft/season-sim";
import { lossWL, combinedLoss } from "src/lib/nba/tft/regression";
import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";
import { DEFAULT_COEFFICIENTS } from "src/lib/nba/sim/stat-mapper";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Minimal inline CMA-ES (μ/μ_w, λ) with ask()/tell() interface
// Reference: Hansen 2016, "The CMA Evolution Strategy: A Tutorial"
// This is the standard (1+λ)-ranked variant, adequate for ~17-dimensional
// smooth loss functions. No third-party dep required.
// ---------------------------------------------------------------------------

interface CMAESOptions {
  initialSolution: number[];
  initialStepSize: number;
  populationSize: number;
}

class CMAES {
  private readonly n: number;       // dimension
  private readonly lambda: number;  // population size
  private readonly mu: number;      // number of parents
  private readonly weights: number[];
  private readonly mueff: number;
  private readonly cc: number;
  private readonly cs: number;
  private readonly c1: number;
  private readonly cmu: number;
  private readonly damps: number;
  private readonly chiN: number;

  private mean: number[];
  private sigma: number;
  private pc: number[];
  private ps: number[];
  private B: number[][];            // eigenvectors
  private D: number[];              // sqrt eigenvalues
  private C: number[][];            // covariance matrix
  private eigeneval: number;
  private counteval: number;

  constructor(opts: CMAESOptions) {
    this.n = opts.initialSolution.length;
    this.lambda = opts.populationSize;
    this.mu = Math.floor(this.lambda / 2);
    this.sigma = opts.initialStepSize;
    this.mean = [...opts.initialSolution];

    // Weights (log-linear)
    const rawW = Array.from({ length: this.mu }, (_, i) =>
      Math.log(this.mu + 0.5) - Math.log(i + 1)
    );
    const sumW = rawW.reduce((a, b) => a + b, 0);
    this.weights = rawW.map((w) => w / sumW);
    this.mueff = 1 / this.weights.reduce((s, w) => s + w * w, 0);

    const n = this.n;
    this.cc = (4 + this.mueff / n) / (n + 4 + 2 * this.mueff / n);
    this.cs = (this.mueff + 2) / (n + this.mueff + 5);
    this.c1 = 2 / ((n + 1.3) ** 2 + this.mueff);
    this.cmu = Math.min(
      1 - this.c1,
      2 * (this.mueff - 2 + 1 / this.mueff) / ((n + 2) ** 2 + this.mueff)
    );
    this.damps = 1 + 2 * Math.max(0, Math.sqrt((this.mueff - 1) / (n + 1)) - 1) + this.cs;
    this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n ** 2));

    // State
    this.pc = new Array(n).fill(0);
    this.ps = new Array(n).fill(0);
    this.B = identity(n);
    this.D = new Array(n).fill(1);
    this.C = identity(n);
    this.eigeneval = 0;
    this.counteval = 0;
  }

  /** Sample λ candidate solutions. */
  ask(): number[][] {
    this._maybeUpdateEigen();
    const pop: number[][] = [];
    for (let k = 0; k < this.lambda; k++) {
      const z = sampleStdNormal(this.n);
      const x = this.mean.map((m, i) => {
        let s = 0;
        for (let j = 0; j < this.n; j++) s += this.B[i][j] * this.D[j] * z[j];
        return m + this.sigma * s;
      });
      pop.push(x);
    }
    return pop;
  }

  /**
   * Update distribution from evaluated population.
   * @param pop  candidates from ask()
   * @param fitness  loss values (lower = better)
   */
  tell(pop: number[][], fitness: number[]): void {
    this.counteval += pop.length;
    const n = this.n;

    // Rank by ascending fitness (lower is better)
    const ranked = fitness
      .map((f, i) => ({ f, x: pop[i] })  )
      .sort((a, b) => a.f - b.f)
      .slice(0, this.mu);

    const oldMean = [...this.mean];
    // Weighted recombination
    this.mean = new Array(n).fill(0);
    for (let i = 0; i < this.mu; i++) {
      for (let j = 0; j < n; j++) {
        this.mean[j] += this.weights[i] * ranked[i].x[j];
      }
    }

    // Step-size control (CSA)
    const invBD = (v: number[]) => {
      // Compute (BD)^{-1} v = D^{-1} B^T v (since B is orthogonal)
      const Btv = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) Btv[i] += this.B[j][i] * v[j];
      return Btv.map((val, i) => val / this.D[i]);
    };

    const step = this.mean.map((m, i) => m - oldMean[i]);
    const inormstep = invBD(step);

    const c1sqrt = Math.sqrt(this.cs * (2 - this.cs) * this.mueff);
    for (let i = 0; i < n; i++) {
      this.ps[i] = (1 - this.cs) * this.ps[i] + c1sqrt * inormstep[i] / this.sigma;
    }

    const psNorm = Math.sqrt(this.ps.reduce((s, v) => s + v * v, 0));
    this.sigma *= Math.exp((this.cs / this.damps) * (psNorm / this.chiN - 1));

    // Covariance matrix adaptation (CMA)
    const hsig = psNorm / Math.sqrt(1 - (1 - this.cs) ** (2 * this.counteval / this.lambda)) / this.chiN
      < 1.4 + 2 / (n + 1) ? 1 : 0;

    const c1sqrt2 = Math.sqrt(this.cc * (2 - this.cc) * this.mueff);
    for (let i = 0; i < n; i++) {
      this.pc[i] = (1 - this.cc) * this.pc[i] + hsig * c1sqrt2 * step[i] / this.sigma;
    }

    // Rank-1 update
    const pc = this.pc;
    const deltahs = (1 - hsig) * this.cc * (2 - this.cc);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.C[i][j] = (1 - this.c1 - this.cmu) * this.C[i][j]
          + this.c1 * (pc[i] * pc[j] + deltahs * this.C[i][j]);
      }
    }
    // Rank-mu update
    for (let k = 0; k < this.mu; k++) {
      const dy = ranked[k].x.map((v, i) => (v - oldMean[i]) / this.sigma);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          this.C[i][j] += this.cmu * this.weights[k] * dy[i] * dy[j];
        }
      }
    }
  }

  private _maybeUpdateEigen(): void {
    // Decompose C every lambda/(c1+cmu)/n/10 evaluations
    if (this.counteval - this.eigeneval > this.lambda / (this.c1 + this.cmu) / this.n / 10) {
      this.eigeneval = this.counteval;
      const { eigenvectors, eigenvalues } = symEigen(this.C);
      this.B = eigenvectors;
      this.D = eigenvalues.map((v) => Math.sqrt(Math.max(1e-20, v)));
    }
  }
}

// ---------------------------------------------------------------------------
// Linear-algebra helpers (no external deps)
// ---------------------------------------------------------------------------

function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

function sampleStdNormal(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 2) {
    // Box-Muller
    const u1 = Math.random(), u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(Math.max(1e-15, u1)));
    out.push(r * Math.cos(2 * Math.PI * u2));
    if (i + 1 < n) out.push(r * Math.sin(2 * Math.PI * u2));
  }
  return out;
}

/**
 * Symmetric eigen-decomposition via iterative Jacobi method.
 * Returns eigenvectors (columns) and eigenvalues, both in ascending order.
 * Adequate for n ≤ 30.
 */
function symEigen(C: number[][]): { eigenvectors: number[][]; eigenvalues: number[] } {
  const n = C.length;
  // Copy C
  const A = C.map((row) => [...row]);
  // Accumulate eigenvectors
  let V = identity(n);

  for (let sweep = 0; sweep < 100; sweep++) {
    // Find max off-diagonal
    let p = 0, q = 1, maxVal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const aij = Math.abs(A[i][j]);
        if (aij > maxVal) { maxVal = aij; p = i; q = j; }
      }
    }
    if (maxVal < 1e-12) break;

    // Jacobi rotation
    const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    const tau = s / (1 + c);

    // Update A
    const app = A[p][p], aqq = A[q][q], apq = A[p][q];
    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0; A[q][p] = 0;
    for (let r = 0; r < n; r++) {
      if (r !== p && r !== q) {
        const arp = A[r][p], arq = A[r][q];
        A[r][p] = arp - s * (arq + tau * arp);
        A[p][r] = A[r][p];
        A[r][q] = arq + s * (arp - tau * arq);
        A[q][r] = A[r][q];
      }
      // Accumulate rotation in V
      const vrp = V[r][p], vrq = V[r][q];
      V[r][p] = vrp - s * (vrq + tau * vrp);
      V[r][q] = vrq + s * (vrp - tau * vrq);
    }
  }

  // Extract eigenvalues
  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]);
  // Sort ascending
  const order = eigenvalues.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const sortedEigenvalues = order.map((o) => o.v);
  const sortedEigenvectors = identity(n).map((_, col) =>
    order.map((o) => V[col][o.i])
  );

  return { eigenvectors: sortedEigenvectors, eigenvalues: sortedEigenvalues };
}

// ---------------------------------------------------------------------------
// Coefficients ↔ flat vector
// ---------------------------------------------------------------------------

type Coefficients = typeof DEFAULT_COEFFICIENTS;

function coefficientsToVector(c: Coefficients): number[] {
  return [
    c.shooting.ts_weight, c.shooting.fg_weight, c.shooting.fg3_weight, c.shooting.scale, c.shooting.offset,
    c.defense.drtg_weight, c.defense.stl_weight, c.defense.blk_weight, c.defense.drtg_center, c.defense.scale,
    c.speed.pace_weight, c.speed.pace_center, c.speed.age_penalty, c.speed.scale,
    c.stamina.mpg_weight, c.stamina.age_penalty, c.stamina.scale,
  ];
}

function vectorToCoefficients(v: number[]): Coefficients {
  return {
    shooting: { ts_weight: v[0], fg_weight: v[1], fg3_weight: v[2], scale: v[3], offset: v[4] },
    defense:  { drtg_weight: v[5], stl_weight: v[6], blk_weight: v[7], drtg_center: v[8], scale: v[9] },
    speed:    { pace_weight: v[10], pace_center: v[11], age_penalty: v[12], scale: v[13] },
    stamina:  { mpg_weight: v[14], age_penalty: v[15], scale: v[16] },
  };
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadRosters(): Promise<Record<number, EnginePlayer[]>> {
  const rows = (await sql`
    SELECT id, name, team, cost, shooting, speed, defense
    FROM bball_roster WHERE is_active = TRUE
    ORDER BY team, cost DESC, name
  `) as Array<{
    id: number; name: string; team: string; cost: number;
    shooting: number; speed: number; defense: number;
  }>;

  const teamRows = (await sql`
    SELECT team_id, team_abbreviation FROM nba_teams
  `) as Array<{ team_id: number; team_abbreviation: string }>;

  const abbrevToId: Record<string, number> = {};
  for (const t of teamRows) {
    if (t.team_abbreviation) abbrevToId[t.team_abbreviation] = t.team_id;
  }

  const byTeam: Record<number, EnginePlayer[]> = {};
  for (const r of rows) {
    if (!r.team || r.team === "FA") continue;
    const teamId = abbrevToId[r.team];
    if (!teamId) continue;
    if ((byTeam[teamId]?.length ?? 0) >= 5) continue;
    (byTeam[teamId] ??= []).push({
      id: r.id,
      name: r.name,
      team: r.team,
      shooting: r.shooting,
      defense: r.defense,
      speed: r.speed,
      height_inches: 78,   // default: missing from bball_roster in v1
      weight_lbs: 200,     // default: missing from bball_roster in v1
      stamina: 60,         // default: missing from bball_roster in v1
    });
  }
  return byTeam;
}

async function loadActualWins(season: string): Promise<Record<number, number>> {
  const rows = (await sql`
    SELECT team_id, wins FROM nba_standings WHERE season = ${season}
  `) as Array<{ team_id: number; wins: number }>;

  const out: Record<number, number> = {};
  for (const r of rows) {
    if (r.wins != null) out[r.team_id] = r.wins;
  }
  return out;
}

async function loadSchedule(season: string): Promise<Array<{ home_team_id: number; away_team_id: number }>> {
  const rows = (await sql`
    SELECT home_team_id, away_team_id FROM nba_games
    WHERE season = ${season} AND home_score IS NOT NULL
    ORDER BY game_date
  `) as Array<{ home_team_id: number; away_team_id: number }>;

  return rows.filter((r) => r.home_team_id != null && r.away_team_id != null);
}

// ---------------------------------------------------------------------------
// V1 weight: fit W-L only (box + spatial deferred — no player-id join)
// ---------------------------------------------------------------------------

const V1_WEIGHTS = { wl: 1, box: 0, spa: 0 };

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const seasonIdx = args.indexOf("--season");
  const genIdx = args.indexOf("--generations");
  const season = seasonIdx > -1 ? args[seasonIdx + 1] : "2025-26";
  const generations = genIdx > -1 ? Number(args[genIdx + 1]) : 100;

  console.log(`[tft:backtest] season=${season} generations=${generations}`);

  const [rosters, actualWins, schedule] = await Promise.all([
    loadRosters(),
    loadActualWins(season),
    loadSchedule(season),
  ]);

  const rosterCount = Object.keys(rosters).length;
  const standingsCount = Object.keys(actualWins).length;
  console.log(
    `[tft:backtest] rosters=${rosterCount} standings=${standingsCount} games=${schedule.length}`
  );

  if (schedule.length === 0) {
    console.error(`[tft:backtest] No completed games for season=${season}. Run tft/setup first.`);
    process.exit(1);
  }
  if (standingsCount === 0) {
    console.error(`[tft:backtest] No standings for season=${season}. Ingest standings first.`);
    process.exit(1);
  }
  if (rosterCount === 0) {
    console.error(`[tft:backtest] No active roster rows in bball_roster. Run bball/admin/refresh-roster first.`);
    process.exit(1);
  }

  const initial = coefficientsToVector(DEFAULT_COEFFICIENTS);
  const es = new CMAES({ initialSolution: initial, initialStepSize: 0.05, populationSize: 12 });

  let bestLoss = Infinity;
  let bestVector = initial;
  let bestSim: ReturnType<typeof simulateSeason> | null = null;

  for (let g = 0; g < generations; g++) {
    const pop = es.ask();
    const fitness: number[] = [];

    for (const cand of pop) {
      const input: SeasonInput = {
        rosters,
        schedule,
        replicates: 3,
        ticksPerGame: 500,
        baseSeed: 1 + g * 1_000_003 + Math.floor(Math.abs(cand[0]) * 1000),
      };
      const sim = simulateSeason(input);
      const parts = { wl: lossWL(sim.teamWins, actualWins), box: 0, spa: 0 };
      const total = combinedLoss(parts, V1_WEIGHTS);
      fitness.push(total);

      if (total < bestLoss) {
        bestLoss = total;
        bestVector = [...cand];
        bestSim = sim;
      }
    }

    es.tell(pop, fitness);
    if (g % 10 === 0 || g === generations - 1) {
      console.log(`[tft:backtest] gen ${g.toString().padStart(3)} best_loss=${bestLoss.toFixed(4)}`);
    }
  }

  const version = `2026-backtest-${randomUUID().slice(0, 8)}`;
  const coefficients = vectorToCoefficients(bestVector);
  const metrics = { best_loss: bestLoss, generations, weights: V1_WEIGHTS, season, rosterCount, standingsCount };

  await sql`
    INSERT INTO tft_coefficients (version, fit_season, active, coefficients, metrics)
    VALUES (
      ${version}, ${season}, false,
      ${JSON.stringify(coefficients)},
      ${JSON.stringify(metrics)}
    )
  `;

  if (bestSim) {
    for (const [tid, wins] of Object.entries(bestSim.teamWins)) {
      const tidNum = Number(tid);
      await sql`
        INSERT INTO tft_predictions (version, season, team_id, player_id, sim_wins, actual_wins, sim_replicates)
        VALUES (
          ${version}, ${season}, ${tidNum}, NULL,
          ${wins}, ${actualWins[tidNum] ?? null}, 3
        )
        ON CONFLICT (version, season, team_id, player_id) DO NOTHING
      `;
    }
  }

  console.log(
    `[tft:backtest] done. version=${version} best_loss=${bestLoss.toFixed(4)}`
  );
  console.log(`[tft:backtest] promote: yarn tft:activate ${version}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[tft:backtest] fatal:", e);
    process.exit(1);
  });
