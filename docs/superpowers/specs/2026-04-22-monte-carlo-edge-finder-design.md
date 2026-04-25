# Monte Carlo Edge Finder — Design Spec

**Date:** 2026-04-22
**Author:** Brooks Roley
**Status:** Approved

## Purpose

Build a game prediction system that uses the shared-core C++ basketball simulation engine to generate predicted point spreads via Monte Carlo simulation, then compares those predictions against Vegas lines from The Odds API to identify edges — games where the model disagrees with the market by a meaningful margin.

## Goals

1. Predict NBA game point differentials using physics-informed simulation
2. Ingest and store Vegas spreads from multiple bookmakers
3. Detect edges: games where simulated spread diverges from market spread
4. Track prediction accuracy over time as a feedback loop
5. Graduate from hand-tuned calibration (Phase A) to ML-weighted features (Phase B)

## Non-Goals

- Automated betting or bankroll management
- Real-time in-game predictions (pre-game only)
- Player prop or DFS predictions (game-level only)
- Mobile app — API + web dashboard only

---

## Architecture

### Layer 1: Data — Odds + Roster Ingestion

**Odds Client** (`src/lib/nba/odds.ts`)
- REST client for The Odds API (the-odds-api.com)
- Fetches NBA H2H and spreads markets
- Free tier: 500 requests/month — cache aggressively, fetch once per game
- API key stored in `ODDS_API_KEY` env var

**Odds Schema** (`nba_odds` table)
```sql
nba_odds (
  id SERIAL PRIMARY KEY,
  game_id TEXT NOT NULL,           -- maps to nba_games.game_id
  bookmaker TEXT NOT NULL,         -- e.g. 'draftkings', 'fanduel'
  spread_home NUMERIC,            -- negative = home favored
  spread_away NUMERIC,
  over_under NUMERIC,
  home_ml INT,                    -- moneyline odds
  away_ml INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, bookmaker, captured_at)
)
```

**Injury/Availability Data**
- Source: stats.nba.com injury report or a lightweight scraper
- Stored as a flag on `nba_players` or a separate `nba_availability` table
- Used to determine which players to include in simulation rosters
- MVP: manual toggle or static list; automate in Phase B

**Ingestion Schedule**
- Odds: daily at 11am ET (after lines are posted, before games tip)
- Runs via Vercel Cron alongside existing stats ingestion
- Bronze log captures raw odds response for audit trail

### Layer 2: Simulation — Calibrated C++ Engine

**Stat Translation Module** (`src/lib/nba/sim/stat-mapper.ts`)

Maps real NBA stats to engine stats (0-100 scale):

| Engine Stat | Real NBA Source | Mapping Strategy |
|-------------|----------------|-----------------|
| shooting | FG%, TS%, FG3% | Weighted blend: `0.4*TS% + 0.3*FG% + 0.3*FG3%`, scaled to 0-100 |
| defense | Defensive Rating, STL%, BLK% | Inverse DRTG percentile + steal/block blend |
| speed | Pace contribution, fast break pts | Team pace percentile, adjusted per player |
| height | Height (inches) | Direct passthrough |
| weight | Weight (lbs) | Direct passthrough |
| stamina | Minutes per game, age | MPG percentile, age decay factor |

These coefficients are the calibration target. Initial values are hand-set, then tuned via backtesting.

**Calibration Module** (`src/lib/nba/sim/calibrate.ts`)

- Takes historical games with known outcomes
- For each game: maps both rosters → engine stats, runs N simulations, records predicted margin
- Compares predicted margins to actual margins
- Adjusts mapping coefficients to minimize MAE
- Phase A: grid search over coefficient space
- Phase B: gradient-based optimization

**Calibration Table** (`nba_calibration`)
```sql
nba_calibration (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL,             -- e.g. 'v0.1.0'
  stat_mappings JSONB NOT NULL,      -- coefficient values
  backtest_games INT,                -- number of games tested
  backtest_mae NUMERIC,              -- mean absolute error vs actual
  backtest_rmse NUMERIC,
  backtest_r2 NUMERIC,               -- R² correlation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**Monte Carlo Runner** (`src/lib/nba/sim/monte-carlo.ts`)

- Input: two rosters (mapped to engine stats), N simulations (default 1000)
- Calls shared-core C++ engine (via WASM) for each simulation
- Collects score differentials across N runs
- Output: median spread, mean spread, standard deviation, win probability, score distribution histogram

**WASM Integration**
- shared-core already compiles to WASM (verified working in BballTactics)
- Monte Carlo runner calls the WASM module directly from Node.js/Vercel
- Each simulation is independent — can parallelize across runs
- Target: 1000 simulations per game in <10 seconds

### Layer 3: Prediction — Edge Detection

**Predictions Table** (`nba_predictions`)
```sql
nba_predictions (
  id SERIAL PRIMARY KEY,
  game_id TEXT NOT NULL,
  calibration_version TEXT NOT NULL,
  sim_count INT NOT NULL,            -- number of simulations run
  sim_median_spread NUMERIC,         -- median predicted spread (home perspective)
  sim_mean_spread NUMERIC,
  sim_stddev NUMERIC,
  sim_home_win_pct NUMERIC,          -- % of sims home team won
  vegas_spread NUMERIC,              -- consensus or best available
  edge NUMERIC,                      -- sim_median - vegas_spread
  confidence TEXT,                   -- 'low' | 'medium' | 'high' based on |edge| and stddev
  synergy_buffs_home JSONB,          -- which synergies activated
  synergy_buffs_away JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, calibration_version)
)
```

**Confidence Tiers**
- `high`: |edge| > 5 points AND stddev < 8
- `medium`: |edge| > 3 points AND stddev < 10
- `low`: everything else

**Results Tracking** (`nba_prediction_results`)
```sql
nba_prediction_results (
  id SERIAL PRIMARY KEY,
  game_id TEXT NOT NULL,
  predicted_spread NUMERIC,
  vegas_spread NUMERIC,
  actual_margin NUMERIC,             -- actual home margin
  beat_vegas BOOLEAN,                -- was our prediction closer to actual than Vegas?
  ats_result TEXT,                    -- 'cover' | 'push' | 'miss' from our edge perspective
  calibration_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id)
)
```

**Accuracy Metrics** (computed on read)
- Overall ATS record (wins/losses/pushes)
- ATS record by confidence tier
- MAE vs Vegas MAE (are we more accurate?)
- ROI if flat-betting edges (hypothetical)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/nba/predictions/today` | Today's games with edges, sorted by confidence |
| GET | `/api/nba/predictions/[game_id]` | Detail: sim distribution, synergies, Vegas line, edge |
| GET | `/api/nba/predictions/accuracy` | Historical record: ATS, MAE, by confidence tier |
| POST | `/api/nba/admin/simulate` | Trigger simulation for upcoming games (admin-key protected) |
| POST | `/api/nba/admin/calibrate` | Run calibration against historical games (admin-key protected) |
| GET | `/api/nba/odds/[game_id]` | Raw odds from all bookmakers for a game |

---

## Phased Delivery

### Phase A: Hand-Tuned Calibration
1. Odds client + `nba_odds` table + ingestion cron
2. Stat translation module with hand-set coefficients
3. Monte Carlo runner via WASM
4. Edge detection + predictions table
5. Backtest against 100+ historical games
6. Tune coefficients to minimize MAE
7. API endpoints for today's predictions + accuracy
8. Target: MAE within 2 points of Vegas (Vegas MAE is typically ~9 points)

### Phase B: ML-Weighted Features
1. Engine outputs become features: sim_spread, synergy_buffs, shot_distribution, pace_diff
2. Combine with raw stats: team net rating, recent form, home/away splits, rest days
3. Train gradient boosted model (XGBoost via TypeScript port or Python microservice)
4. Cross-validate on historical seasons
5. The model learns which engine signals matter and how to weight them
6. Retrain weekly with new game results
7. Target: beat Phase A MAE by 1+ points

---

## Testing Strategy

### Unit Tests (can run now)
- Stat mapper: real stats → engine stats mapping correctness
- Edge calculation: given sim spread and Vegas spread, compute edge and confidence
- Aggregation: season stats correctly compute from game logs
- Synergy detection: correct buffs applied for known roster combos

### Integration Tests (need odds API key)
- Odds client fetches and parses real API response
- Full pipeline: ingest → map → simulate → predict → store
- Idempotent re-simulation produces same results

### Backtest Suite
- Run model against 100+ historical games with known outcomes
- Compare MAE to Vegas MAE
- Track accuracy by confidence tier
- Regression test: new calibration versions don't degrade accuracy

### Validation Tests
- Predicted spreads are within reasonable range (-30 to +30)
- Win probability between 0 and 1
- Confidence tiers correctly assigned
- Edge signs are consistent (positive edge = model likes home more than Vegas)

---

## Key Differentiators for Lakers Application

1. **Physics-informed prediction** — not just regression on box scores
2. **Lineup-aware via SynergyEngine** — captures roster composition effects most models miss
3. **Full data platform story** — ingestion, validation, transformation, prediction, evaluation
4. **Greenfield architecture** — exactly what the JD describes
5. **Calibration pipeline** — demonstrates MLOps thinking (versioning, backtesting, monitoring)
6. **Edge detection framing** — shows understanding of how basketball analytics intersects with quantitative analysis

---

## Dependencies

- **The Odds API** — free tier, 500 req/month, API key required
- **shared-core WASM** — already compiled and working
- **Neon Postgres** — existing, add 4 new tables
- **Vercel Cron** — existing, add odds ingestion job
- **XGBoost** (Phase B only) — TypeScript port or Python microservice
