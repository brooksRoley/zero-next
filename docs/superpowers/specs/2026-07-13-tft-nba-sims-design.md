# TFT NBA Sims — 2026 Backtest + 2027 Live Loop

Design date: 2026-07-13
Status: Approved for implementation planning
Livelihood streams: Portfolio signal (Rung 1), Digital Products (Rung 3)

## Goal

Turn the existing `/api/bball/*` TFT-style auto-battler and `src/lib/nba/sim/*` NBA simulator into a **validated, calibrated engine** whose coefficients are provably fit against real NBA data. Two sims support this:

- **2026 backtest** — retrospective fit against the completed 2025-26 season. Freeze tuned coefficients.
- **2027 live loop** — weekly cron absorbs new games as the 2026-27 season plays, refits tactics, re-projects the remaining season.

Spatial probability data (per-player shot-origin heatmaps) is a byproduct of the calibration, not the primary goal.

## Confirmed decisions

| Decision | Value |
|---|---|
| North star | A tuned/validated TFT engine |
| Regression targets | Team season W-L, per-player box score, per-player shot-origin distribution |
| Tactics representation | TFT-board formations + scheme labels (drop/switch/blitz/ICE/zone) |
| Atomic sim unit | One full-league season (1230 games, N Monte Carlo replicates) |
| 2027 update cadence | Weekly |
| Shot-chart data source | Add stats.nba.com `shotchartdetail` ingest |
| Public surface | Case-study section under `/basketball-platform` |
| Optimizer | CMA-ES, ~4000 sim evaluations, local overnight script |
| Auto-promotion of coefficients | No — manual `yarn tft:activate <version>` gate |

## Architecture

Three layers, from top:

```
Public surface
    /basketball-platform → Backtest section
       (scorecard, team residuals, hero player heatmap,
        coefficient snapshot, methodology note)
          │ reads
          ▼
Analysis layer  (new: src/lib/nba/tft/)
    regression harness (loss + coeff search)
    tactics fitter     (per team-week: formation + scheme)
    season simulator   (drives 1230 games via existing
                       monte-carlo.ts + tactics-aware engine-bridge)
          │ reads
          ▼
Data layer
    Existing NBA tables (players, teams, games, box, standings, series)
    NEW: nba_shots           (LOC_X/LOC_Y + made)
    NEW: tft_coefficients    (versioned; one active row)
    NEW: tft_predictions     (season sim outputs; predicted + actual)
```

Guiding principles:

- **Reuse, don't rebuild.** `src/lib/nba/sim/*` remains the sim substrate; new code lives in `src/lib/nba/tft/` and calls into `sim/`.
- **Coefficients versioned in Postgres**, not hardcoded. Rollback is `UPDATE tft_coefficients SET active = ...`.
- **Season simulator is the only layer touching game-level detail.** Everything above operates on aggregates.
- **`nba_shots` is the only net-new ingest.** Everything else piggy-backs on the existing NBA cron.

## Data model

### `nba_shots`

One row per shot attempt in a real NBA game. Populated by the new `shotchartdetail` ingest step.

```sql
CREATE TABLE IF NOT EXISTS nba_shots (
  id            BIGSERIAL PRIMARY KEY,
  game_id       TEXT NOT NULL,
  season        TEXT NOT NULL,           -- e.g. '2025-26'
  player_id     INT  NOT NULL,
  team_id       INT  NOT NULL,
  period        INT  NOT NULL,
  seconds_left  INT  NOT NULL,           -- MINUTES_REMAINING*60 + SECONDS_REMAINING
  loc_x         INT  NOT NULL,           -- stats.nba.com coords (feet * 10)
  loc_y         INT  NOT NULL,
  shot_type     TEXT NOT NULL,           -- '2PT Field Goal' | '3PT Field Goal'
  shot_zone     TEXT NOT NULL,           -- provider's SHOT_ZONE_BASIC
  made          BOOLEAN NOT NULL,
  UNIQUE (game_id, player_id, period, seconds_left, loc_x, loc_y)
);
CREATE INDEX ON nba_shots (season, player_id);
CREATE INDEX ON nba_shots (game_id);
```

Rationale: keep the raw shot list unbinned so we can re-derive spatial buckets later. UNIQUE tuple makes re-ingest idempotent.

### `tft_coefficients`

Versioned engine calibration. Partial unique index enforces at most one active row at the DB level.

```sql
CREATE TABLE IF NOT EXISTS tft_coefficients (
  id             SERIAL PRIMARY KEY,
  version        TEXT NOT NULL UNIQUE,   -- '2026-backtest-v3'
  fit_season     TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT false,
  coefficients   JSONB NOT NULL,         -- CalibrationCoefficients + scheme/formation knobs
  metrics        JSONB NOT NULL,         -- {wl_mae, box_rmse, spatial_js, weights, elapsed_ms}
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX tft_coefficients_active ON tft_coefficients (active) WHERE active;
```

### `tft_predictions`

Season-level sim outputs, one row per (version × season × team × player). `player_id = NULL` denotes team-level rows.

```sql
CREATE TABLE IF NOT EXISTS tft_predictions (
  id                 SERIAL PRIMARY KEY,
  version            TEXT NOT NULL,       -- FK to tft_coefficients.version
  season             TEXT NOT NULL,
  team_id            INT  NOT NULL,
  player_id          INT,                 -- NULL = team-level row (W-L)

  -- Reconciled pass: sim run with tactics_actual
  sim_wins           REAL,
  sim_box            JSONB,               -- {pts, reb, ast, ...} means across MC replicates
  sim_shot_bins      JSONB,               -- 8-zone origin distribution

  -- Forecast pass: sim run with tactics_predicted
  sim_pred_wins      REAL,
  sim_pred_box       JSONB,
  sim_pred_shot_bins JSONB,

  -- Ground truth
  actual_wins        REAL,
  actual_box         JSONB,
  actual_shot_bins   JSONB,

  sim_replicates     INT NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (version, season, team_id, player_id)
);
```

Notes:

- 8-zone taxonomy reuses the polygons already defined in `basketball-platform.jsx` (paint, left/right mid, left/right corner 3, left/right wing 3, top of key). Extracted to `src/lib/nba/tft/zones.ts` so both sim and analytics share one definition.
- Team-level and player-level rows share the table; case-study page filters by `player_id IS NULL` vs `IS NOT NULL`.
- If per-replicate variance is needed later, add `tft_predictions_replicates` — do not widen this table.

## Engine upgrades

Changes to `src/lib/nba/sim/engine-bridge.ts` and new files under `src/lib/nba/tft/`.

### Per-player event stream

Return type of `simulateGameTS` grows to include per-player counters:

```ts
export interface SimGameResult {
  homeScore: number;
  awayScore: number;
  synergies: SimScore["synergies"];
  playerLines: {
    playerId: number;
    pts: number;
    reb: number;
    ast: number;
    fga: number;
    fga3: number;
    shots: { zoneId: string; made: boolean; loc_x: number; loc_y: number }[];
  }[];
}
```

Each possession selects a shooter (weighted by shooting × formation-derived usage), picks a shot zone from that shooter's formation-conditioned mix, then rolls the make. Assists and rebounds are sampled from non-shooting lineup by role tags. Expected +~40 lines in `engine-bridge.ts`.

### Tactics inputs

New argument the sim consumes:

```ts
export interface TacticsPlan {
  lineup: number[];                       // 5 player_ids on the floor
  minutes: Record<number, number>;        // playerId -> season minutes share
  formation: {                            // TFT board layout, 5 units
    playerId: number;
    x: number;                            // 0..6 board x → mapped to court zone
    y: number;                            // 0..7 board y
  }[];
  scheme: 'drop' | 'switch' | 'blitz' | 'ICE' | 'zone';
}
```

- `src/lib/nba/tft/court-mapping.ts` — pure `(boardX, boardY) → zoneId`. Board bottom-half defensive, top-half offensive.
- `src/lib/nba/tft/scheme-effects.ts` — pure lookup table; each scheme mutates a small set of numbers on the opposing sim step (e.g., `drop` → +10% opponent mid-range attempt rate, −6% at-rim; `blitz` → +8% opponent TO rate, −4% opponent 3P%).

Every coefficient a coach could plausibly complain about lives in one of these two files. That surface area is what the regression harness tunes.

### Shot-origin generator

Per shot attempt:

1. Sample zone from shooter's formation-conditioned prior (board x/y biases zone weights).
2. Sample (loc_x, loc_y) uniformly within that zone's polygon (polygons from `src/lib/nba/tft/zones.ts`).
3. Roll the make using `player.shooting`, zone base `makePct`, and scheme-adjusted defensive contest.

Same 8-zone taxonomy on both sides makes the spatial loss cheap: two 8-bin histograms per player.

Deterministic seeding (`mulberry32(seed)`) is preserved so the coefficient search has reproducible evaluations.

## Regression harness

Lives at `src/lib/nba/tft/regression.ts`. Runs as `yarn tft:backtest` (local, overnight).

### Loss function

Weighted sum of three normalized terms:

```
L(θ) = w_wl  · L_wl(θ)
     + w_box · L_box(θ)
     + w_spa · L_spa(θ)
```

- `L_wl` — mean absolute error of sim wins vs actual wins, divided by 82; averaged across 30 teams.
- `L_box` — normalized RMSE across PTS/G, REB/G, AST/G for each player with ≥500 minutes. Each stat divided by its league stddev before combining.
- `L_spa` — mean Jensen-Shannon divergence between sim and real 8-bin shot-origin distributions, per player, weighted by shot volume.

Default weights `w_wl=0.4, w_box=0.4, w_spa=0.2`. Weights stored in `tft_coefficients.metrics.weights` so every backtest is self-documenting. Spatial weight deliberately down-weighted in v1 while shot-chart ingest matures.

### Parameter space

Roughly 37 scalars total:

- `DEFAULT_COEFFICIENTS` in `stat-mapper.ts` — 14 scalars across shooting/defense/speed/stamina.
- `scheme-effects.ts` — ~15 scalars (3 per scheme × 5 schemes).
- `court-mapping.ts` biases — 8 zone-preference weights per formation slot.

### Optimizer

CMA-ES via a small pure-JS dependency. Reasoning: handles non-differentiable MC simulator natively, well-behaved in ~40-dim spaces, no hyperparameter tuning of its own required at this scale.

Budget: 200 generations × 20 population = 4000 sim evaluations. Each evaluation runs a 30-replicate MC of the 1230-game season. Roughly 7 hours on a laptop — a fine overnight run, and definitively not Vercel-safe (blows the 300s function timeout). This is why the harness runs as a local script.

### Train/val split

The 2025-26 season is one datapoint at the season level, so we split within it:

- **Train** — 30 teams × Oct–Feb slate (~55 games per team).
- **Val** — 30 teams × Mar–Apr regular-season slate (~27 games per team). Playoffs excluded because opponent-strength distortion would bias the fit.

CMA-ES minimizes train loss; val loss is reported each generation and used for early stopping.

### Convergence + guardrails

Stop when either:

- No train-loss improvement > 0.1% over 15 generations, OR
- Val loss increases for 5 generations in a row.

Hard parameter bounds passed to CMA-ES (e.g., `scheme-effects.blitz.turnover_bonus ∈ [-0.3, 0.3]`) so the optimizer cannot discover degenerate solutions.

### Output

On completion:

1. Insert a `tft_coefficients` row with `active=false` and full metrics.
2. Insert 30 team-level + ~450 player-level `tft_predictions` rows for the fitted version.
3. Print a diff report vs the currently-active version.
4. **Manual flip**: `yarn tft:activate <version>` is a separate step.

Deliberately no auto-promotion — this is a calibration you'd defend in an interview. It shouldn't happen while you're asleep.

## Predicted vs Actual mode

Each team-week runs the sim twice, and the diff decomposes error:

```
                         ┌── SIM(θ, tactics_predicted) ── S_pred
observed reality R ───┬──┤
                      │   └── SIM(θ, tactics_actual)    ── S_actual
                      │
                      └── ε_engine  = R − S_actual   (engine mis-specification)
                          ε_tactics = S_actual − S_pred (tactical assumption error)
                          ε_total   = R − S_pred
```

Both ε components share the same output vector shape (W-L, box, shot bins) and are stored on the `tft_predictions` row.

Without this decomposition, a bad backtest could mean "engine is wrong" or "we guessed the wrong tactics" and we cannot tell them apart.

### `tactics_actual` extractor

New helper `src/lib/nba/tft/tactics-extractor.ts`. One entry per team × game.

- **Lineup + minutes** — from existing box-score ingest. Free.
- **Formation (TFT board)** — for each player in the lineup, compute the centroid of their shot-origin distribution in that game and snap to the nearest board cell. Honest ("this is where you actually took shots from"). One aggregation query per game.
- **Scheme label** — v1 heuristic pattern-match against 5 signatures on opponent shot mix:
  - `drop` — opponent mid-range rate > 40%.
  - `switch` — opponent 3P rate near team-season average.
  - `blitz` — opponent TO% > 15%.
  - `ICE` — opponent corner-3 rate depressed vs season baseline.
  - `zone` — opponent 3P attempts > 45%.
  Confidence score attached; if confidence < 0.5, fall back to team-season default scheme.

Scheme extraction is intentionally the weakest link in v1. It is honest — the tactical error term ε_tactics absorbs the uncertainty rather than corrupting the engine fit.

### `tactics_predicted` generator

- **2026 backtest, train split** — pre-season prior: last-season's `tactics_actual` from 2024-25 with a roster-shock adjustment for major trades.
- **2026 backtest, val split** — train-split-fitted priors.
- **2027 live loop** — running average of the team's last 4 weeks of `tactics_actual`, with decay toward last-season prior when < 4 weeks of new data exist.

## Public case-study surface

Extension to `/basketball-platform` — new section below existing content, same route.

Layout (top to bottom):

1. **Section header** — "TFT Engine: Backtest 2025-26" with one-paragraph explainer.
2. **Scorecard row** — three big numbers from active `tft_coefficients.metrics`: wins MAE, box RMSE, spatial JS.
3. **Team residuals table** — 30 rows sortable by residual magnitude: predicted wins, actual wins, ε_engine, ε_tactics.
4. **Hero player heatmap** — player picker (default: LeBron). Two SVG half-courts side-by-side (sim vs actual shot origins) using the existing 460×476 court geometry.
5. **Coefficients snapshot** — active `tft_coefficients.coefficients` table, versioned, dated. Optional "diff vs previous version" expandable row.
6. **Methodology note** — 300-word writeup covering loss function, optimizer, and honest limitations (esp. scheme extraction).

### Endpoints

Public, no auth, active version only:

- `GET /api/nba/tft/summary` — scorecard + team residuals.
- `GET /api/nba/tft/player/[id]` — sim vs actual shot bins for the heatmap.

Both return `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`. Coefficients change only on manual `active` promotions, so long CDN caches are safe.

## Testing strategy

Colocated `__tests__` per repo convention.

- **`src/lib/nba/tft/court-mapping.test.ts`** — property test: every (boardX, boardY) maps to exactly one zone, every zone reachable.
- **`src/lib/nba/tft/scheme-effects.test.ts`** — asserts each scheme's numbers are within declared bounds.
- **`src/lib/nba/tft/regression.test.ts`** — smoke test: with a synthetic 2-team 10-game season and known θ, harness recovers θ within tolerance in a small run (20 gens). Seeded PRNG. Catches optimizer breakage without an overnight CI run.
- **`src/lib/nba/tft/tactics-extractor.test.ts`** — golden test: fixture with 5 hand-labeled games; extractor recovers expected scheme labels with expected confidence.
- **`src/lib/nba/sim/engine-bridge.test.ts`** *(extend existing)* — new tests for per-player emission: `sum(playerLines.pts) === teamScore`; shot origins fall inside declared zone polygons.
- **`src/pages/api/nba/tft/summary.test.ts`** — read endpoint returns shape expected by the case-study page; no active version → 503 with a diagnostic.

**Not tested in CI:** the full-season backtest itself. It is an overnight local script whose output is inspected by hand and committed to Postgres, not to git.

## PR boundaries

### PR 1 — `feat/tft-backtest-2026`

Adds:

- `nba_shots` table + `shotchartdetail` ingest step in `api/nba/admin/ingest.ts`.
- `tft_coefficients` and `tft_predictions` tables.
- `src/lib/nba/tft/{zones,court-mapping,scheme-effects,tactics-extractor,regression}.ts`.
- Engine upgrades in `src/lib/nba/sim/engine-bridge.ts` — per-player events + shot origins + `TacticsPlan` input.
- `yarn tft:backtest` and `yarn tft:activate` scripts.
- Case-study section in `src/pages/basketball-platform.jsx`.
- `src/pages/api/nba/tft/{summary,player/[id]}.ts` read endpoints.
- All tests listed above.

Ships: a real backtest result plus a portfolio-grade case study.

Livelihood streams: **Portfolio signal (Rung 1)** and **Digital Products (Rung 3)** — the methodology writeup is playbook-chapter material.

### PR 2 — `feat/tft-live-2027`

Adds:

- Weekly cron `api/nba/tft/refit` (Vercel Cron; short-running because the heavy CMA-ES doesn't re-run — only tactics priors and MC projection do).
- Running-average tactics-predicted generator.
- "Live 2026-27 tracking" widget on the same case-study page.

Ships: a self-updating public artifact.

## Non-goals

- Not building a full WASM engine in this design. TS fallback continues to be the substrate; a future PR can port hot paths to WASM once the coefficient fit is stable.
- Not adding an interactive TFT board editor to the public page. The case study is read-only; the interactive `/api/bball/*` auto-battler is unchanged.
- Not ingesting play-by-play or player-tracking data. Shot-chart is the only new ingest.
- Not implementing a fitted scheme classifier in v1. Heuristic pattern-match stays until the ε_tactics residuals justify replacing it.

## Open questions deferred to implementation

- Exact stats.nba.com endpoint parameters and rate-limit handling for `shotchartdetail` — write during PR 1.
- CMA-ES library choice (pure-JS candidates: `cma-es`, `cma-lite`) — pick during PR 1 based on API and size.
- Whether the heatmap uses SVG polygons colored by density or kernel-density-estimated raster over the court image — visual choice, will prototype both during PR 1.
