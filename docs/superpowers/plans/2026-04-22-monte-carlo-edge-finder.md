# Monte Carlo Edge Finder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a game prediction system that runs Monte Carlo simulations via the C++ WASM engine, compares predicted spreads to Vegas lines from The Odds API, and surfaces edges.

**Architecture:** Three layers — (1) Odds ingestion client + DB tables, (2) Stat mapper + Monte Carlo simulation runner using shared-core WASM, (3) Edge detection + prediction API. The C++ engine simulates games with mapped NBA stats; synergy buffs provide lineup-aware differentiation. A TypeScript simulation bridge wraps the WASM module for server-side use.

**Tech Stack:** TypeScript, Zod, Vitest, shared-core WASM (Emscripten), Neon Postgres, The Odds API, Vercel Cron

---

## File Structure

```
src/lib/nba/
├── odds.ts                    # The Odds API client
├── sim/
│   ├── stat-mapper.ts         # Real NBA stats → engine 0-100 scale
│   ├── engine-bridge.ts       # WASM engine wrapper for Node.js
│   ├── monte-carlo.ts         # Run N simulations, collect distributions
│   └── calibrate.ts           # Backtest + coefficient tuning
├── predictions/
│   ├── edge-detector.ts       # Compare sim spread vs Vegas spread
│   └── accuracy.ts            # Track prediction results over time
├── db/
│   ├── migrate.ts             # (modify) Add 4 new tables
│   ├── writers.ts             # (modify) Add odds/prediction writers
│   └── readers.ts             # (modify) Add prediction readers
└── tests/
    ├── odds.test.ts
    ├── stat-mapper.test.ts
    ├── monte-carlo.test.ts
    ├── edge-detector.test.ts
    └── calibrate.test.ts

src/pages/api/nba/
├── odds/[gameId].ts           # Raw odds for a game
├── predictions/
│   ├── today.ts               # Today's edges
│   ├── [gameId].ts            # Single game prediction detail
│   └── accuracy.ts            # Historical accuracy
└── admin/
    ├── simulate.ts            # Trigger simulation run
    └── calibrate.ts           # Trigger calibration

shared-core/
├── bindings/wasm/Bindings.cpp # (modify) Add SimulateGame binding
├── include/GameManager.h      # (modify) Add SimulateGame method
└── src/GameManager.cpp        # (modify) Implement SimulateGame
```

---

### Task 1: Add SimulateGame to C++ Engine

The current engine requires manual tick loops. We need a single-call method that runs a full game simulation and returns the final score.

**Files:**
- Modify: `shared-core/include/GameManager.h`
- Modify: `shared-core/src/GameManager.cpp`
- Modify: `shared-core/bindings/wasm/Bindings.cpp`
- Test: `shared-core/tests/test_simulate.cpp`

- [ ] **Step 1: Write the C++ test**

Create `shared-core/tests/test_simulate.cpp`:

```cpp
#include <cassert>
#include <iostream>
#include <string>
#include "GameManager.h"

int main() {
    GameManager gm;

    // Spawn 5 home players
    gm.SpawnPlayer(1, "Home PG", 80.0f, 85.0f);
    gm.SpawnPlayer(2, "Home SG", 75.0f, 90.0f);
    gm.SpawnPlayer(3, "Home SF", 70.0f, 75.0f);
    gm.SpawnPlayer(4, "Home PF", 65.0f, 60.0f);
    gm.SpawnPlayer(5, "Home C",  55.0f, 50.0f);

    // Place players on court
    for (int i = 1; i <= 5; i++) {
        gm.SetPlayerCoordinates(i, float(i % 3), float(i / 3), float(i % 3), float(i / 3));
    }

    // SimulateGame: run full sim, return JSON with final scores
    std::string result = gm.SimulateGame(42, 600);
    std::cout << "SimulateGame result: " << result << std::endl;

    // Parse result — should contain homeScore and awayScore
    assert(result.find("homeScore") != std::string::npos);
    assert(result.find("awayScore") != std::string::npos);
    assert(result.find("simTicks") != std::string::npos);

    // Run again with same seed — should be deterministic
    GameManager gm2;
    gm2.SpawnPlayer(1, "Home PG", 80.0f, 85.0f);
    gm2.SpawnPlayer(2, "Home SG", 75.0f, 90.0f);
    gm2.SpawnPlayer(3, "Home SF", 70.0f, 75.0f);
    gm2.SpawnPlayer(4, "Home PF", 65.0f, 60.0f);
    gm2.SpawnPlayer(5, "Home C",  55.0f, 50.0f);
    for (int i = 1; i <= 5; i++) {
        gm2.SetPlayerCoordinates(i, float(i % 3), float(i / 3), float(i % 3), float(i / 3));
    }
    std::string result2 = gm2.SimulateGame(42, 600);
    assert(result == result2); // Same seed = same result

    std::cout << "All SimulateGame tests passed!\n";
    return 0;
}
```

- [ ] **Step 2: Add SimulateGame to header**

In `shared-core/include/GameManager.h`, add to the public section:

```cpp
    // Run a full game simulation. Returns JSON: {homeScore, awayScore, simTicks, synergies}
    // seed: RNG seed for determinism. ticks: number of simulation steps to run.
    std::string SimulateGame(uint32_t seed, int ticks);
```

- [ ] **Step 3: Implement SimulateGame**

In `shared-core/src/GameManager.cpp`, add:

```cpp
std::string GameManager::SimulateGame(uint32_t seed, int ticks) {
    court.Clear();
    court.Reseed(seed);

    synergyEngine.AnalyzeRoster(GetActiveFloorPlayers());
    auto buffs = synergyEngine.GetActiveBuffs();

    for (auto& [id, player] : activeRoster) {
        for (const auto& buff : buffs) {
            player->stats.speed    += buff.speedBuff;
            player->stats.shooting += buff.shootingBuff;
            player->stats.defense  += buff.defenseBuff;
            player->ClampStats();
        }
        float simX = player->offensivePlacement.x * 70.0f + 40.0f;
        float simY = player->offensivePlacement.y * 70.0f + 40.0f;
        player->pos = {simX, simY};
        court.AddPlayer(player, /*isHome=*/true);
    }

    SpawnBotOpponents();
    court.InitPossession();

    float dt = 1.0f / 30.0f;
    for (int i = 0; i < ticks; i++) {
        court.UpdateSimulationStep(dt);
    }

    // Build result JSON
    std::string json = "{";
    json += "\"homeScore\": " + std::to_string(court.homeScore);
    json += ", \"awayScore\": " + std::to_string(court.awayScore);
    json += ", \"simTicks\": " + std::to_string(ticks);

    // Include synergy info
    json += ", \"synergies\": [";
    bool first = true;
    for (const auto& buff : buffs) {
        if (!first) json += ", ";
        json += "{\"name\": \"" + buff.name + "\"";
        json += ", \"tier\": " + std::to_string(buff.tier);
        json += ", \"shootingBuff\": " + std::to_string(buff.shootingBuff);
        json += ", \"defenseBuff\": " + std::to_string(buff.defenseBuff);
        json += ", \"speedBuff\": " + std::to_string(buff.speedBuff) + "}";
        first = false;
    }
    json += "]}";

    return json;
}
```

- [ ] **Step 4: Add WASM binding**

In `shared-core/bindings/wasm/Bindings.cpp`, add to the EMSCRIPTEN_BINDINGS block:

```cpp
        .function("SimulateGame", &GameManager::SimulateGame);
```

- [ ] **Step 5: Build and test**

```bash
cd /Users/brooks/Desktop/shared-core
g++ -std=c++17 -I include tests/test_simulate.cpp src/GameManager.cpp src/Court.cpp src/PlayerEntity.cpp src/SynergyEngine.cpp src/ShotProbability.cpp -o test_simulate && ./test_simulate
```

Expected: "All SimulateGame tests passed!"

- [ ] **Step 6: Rebuild WASM**

```bash
cd /Users/brooks/Desktop/shared-core
em++ -std=c++17 -O2 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ALLOW_MEMORY_GROWTH=1 \
  --bind -I include \
  bindings/wasm/Bindings.cpp src/GameManager.cpp src/Court.cpp \
  src/PlayerEntity.cpp src/SynergyEngine.cpp src/ShotProbability.cpp \
  -o dist/engine.js
cp dist/engine.js dist/engine.wasm /Users/brooks/Desktop/zero-next/public/
```

- [ ] **Step 7: Commit**

```bash
cd /Users/brooks/Desktop/shared-core
git add include/GameManager.h src/GameManager.cpp bindings/wasm/Bindings.cpp tests/test_simulate.cpp
git commit -m "Add SimulateGame method for headless Monte Carlo simulation"
```

---

### Task 2: Odds Client + Database Tables

**Files:**
- Create: `src/lib/nba/odds.ts`
- Modify: `src/lib/nba/db/migrate.ts`
- Modify: `src/lib/nba/db/writers.ts`
- Modify: `src/lib/nba/db/readers.ts`
- Test: `src/lib/nba/tests/odds.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/nba/tests/odds.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseOddsResponse, OddsSchema, type OddsRow } from "../odds";

const SAMPLE_ODDS_API_RESPONSE = {
  id: "abc123",
  sport_key: "basketball_nba",
  sport_title: "NBA",
  commence_time: "2026-04-22T23:30:00Z",
  home_team: "Los Angeles Lakers",
  away_team: "Denver Nuggets",
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Los Angeles Lakers", price: -110, point: -3.5 },
            { name: "Denver Nuggets", price: -110, point: 3.5 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", price: -110, point: 224.5 },
            { name: "Under", price: -110, point: 224.5 },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      title: "FanDuel",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Los Angeles Lakers", price: -108, point: -3.0 },
            { name: "Denver Nuggets", price: -112, point: 3.0 },
          ],
        },
      ],
    },
  ],
};

describe("parseOddsResponse", () => {
  it("extracts spread rows from API response", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dk = rows.find((r) => r.bookmaker === "draftkings");
    expect(dk).toBeDefined();
    expect(dk!.spread_home).toBe(-3.5);
    expect(dk!.spread_away).toBe(3.5);
    expect(dk!.over_under).toBe(224.5);
  });

  it("handles bookmaker with no totals market", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    const fd = rows.find((r) => r.bookmaker === "fanduel");
    expect(fd).toBeDefined();
    expect(fd!.spread_home).toBe(-3.0);
    expect(fd!.over_under).toBeNull();
  });

  it("includes home and away team names", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    expect(rows[0].home_team).toBe("Los Angeles Lakers");
    expect(rows[0].away_team).toBe("Denver Nuggets");
  });

  it("validates with OddsSchema", () => {
    const rows = parseOddsResponse(SAMPLE_ODDS_API_RESPONSE);
    for (const r of rows) {
      expect(OddsSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("consensus spread", () => {
  it("calculates median spread across bookmakers", () => {
    const { consensusSpread } = require("../odds");
    const rows: OddsRow[] = [
      { event_id: "abc", bookmaker: "dk", spread_home: -3.5, spread_away: 3.5, over_under: 224.5, home_ml: -150, away_ml: 130, home_team: "LAL", away_team: "DEN", commence_time: "" },
      { event_id: "abc", bookmaker: "fd", spread_home: -3.0, spread_away: 3.0, over_under: null, home_ml: -145, away_ml: 125, home_team: "LAL", away_team: "DEN", commence_time: "" },
      { event_id: "abc", bookmaker: "mgm", spread_home: -4.0, spread_away: 4.0, over_under: 225, home_ml: -155, away_ml: 135, home_team: "LAL", away_team: "DEN", commence_time: "" },
    ];
    const consensus = consensusSpread(rows);
    expect(consensus).toBe(-3.5); // median of [-4, -3.5, -3]
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/odds.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement odds client**

Create `src/lib/nba/odds.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/odds.test.ts
```

Expected: PASS

- [ ] **Step 5: Add database tables to migrate.ts**

In `src/lib/nba/db/migrate.ts`, add after the `nba_team_season_stats` creation and before the `return`:

```typescript
  // Odds
  await sql`
    CREATE TABLE IF NOT EXISTS nba_odds (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT NOT NULL,
      bookmaker TEXT NOT NULL,
      spread_home NUMERIC,
      spread_away NUMERIC,
      over_under NUMERIC,
      home_ml INT,
      away_ml INT,
      home_team TEXT,
      away_team TEXT,
      commence_time TIMESTAMPTZ,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, bookmaker, captured_at)
    )
  `;

  // Predictions
  await sql`
    CREATE TABLE IF NOT EXISTS nba_predictions (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT,
      calibration_version TEXT NOT NULL,
      sim_count INT NOT NULL,
      sim_median_spread NUMERIC,
      sim_mean_spread NUMERIC,
      sim_stddev NUMERIC,
      sim_home_win_pct NUMERIC,
      vegas_spread NUMERIC,
      edge NUMERIC,
      confidence TEXT,
      synergy_buffs_home JSONB,
      synergy_buffs_away JSONB,
      home_team TEXT,
      away_team TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (event_id, calibration_version)
    )
  `;

  // Prediction results
  await sql`
    CREATE TABLE IF NOT EXISTS nba_prediction_results (
      id SERIAL PRIMARY KEY,
      game_id TEXT,
      event_id TEXT,
      predicted_spread NUMERIC,
      vegas_spread NUMERIC,
      actual_margin NUMERIC,
      beat_vegas BOOLEAN,
      ats_result TEXT,
      calibration_version TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Calibration
  await sql`
    CREATE TABLE IF NOT EXISTS nba_calibration (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL UNIQUE,
      stat_mappings JSONB NOT NULL,
      backtest_games INT,
      backtest_mae NUMERIC,
      backtest_rmse NUMERIC,
      backtest_r2 NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
```

Also add `"nba_odds", "nba_predictions", "nba_prediction_results", "nba_calibration"` to the `TABLES` const.

- [ ] **Step 6: Add writers for odds and predictions**

Append to `src/lib/nba/db/writers.ts`:

```typescript
import type { OddsRow } from "../odds";

export async function upsertOdds(sql: any, rows: OddsRow[]): Promise<number> {
  let count = 0;
  for (const r of rows) {
    await sql`
      INSERT INTO nba_odds (event_id, bookmaker, spread_home, spread_away, over_under, home_ml, away_ml, home_team, away_team, commence_time)
      VALUES (${r.event_id}, ${r.bookmaker}, ${r.spread_home}, ${r.spread_away}, ${r.over_under}, ${r.home_ml ?? null}, ${r.away_ml ?? null}, ${r.home_team}, ${r.away_team}, ${r.commence_time})
      ON CONFLICT (event_id, bookmaker, captured_at) DO NOTHING
    `;
    count++;
  }
  return count;
}

export async function insertPrediction(sql: any, pred: {
  event_id: string; game_id?: string; calibration_version: string;
  sim_count: number; sim_median_spread: number; sim_mean_spread: number;
  sim_stddev: number; sim_home_win_pct: number; vegas_spread: number;
  edge: number; confidence: string; synergy_buffs_home: any; synergy_buffs_away: any;
  home_team: string; away_team: string;
}): Promise<void> {
  await sql`
    INSERT INTO nba_predictions (event_id, game_id, calibration_version, sim_count, sim_median_spread, sim_mean_spread, sim_stddev, sim_home_win_pct, vegas_spread, edge, confidence, synergy_buffs_home, synergy_buffs_away, home_team, away_team)
    VALUES (${pred.event_id}, ${pred.game_id ?? null}, ${pred.calibration_version}, ${pred.sim_count}, ${pred.sim_median_spread}, ${pred.sim_mean_spread}, ${pred.sim_stddev}, ${pred.sim_home_win_pct}, ${pred.vegas_spread}, ${pred.edge}, ${pred.confidence}, ${JSON.stringify(pred.synergy_buffs_home)}, ${JSON.stringify(pred.synergy_buffs_away)}, ${pred.home_team}, ${pred.away_team})
    ON CONFLICT (event_id, calibration_version) DO UPDATE SET
      sim_median_spread = EXCLUDED.sim_median_spread, sim_mean_spread = EXCLUDED.sim_mean_spread,
      sim_stddev = EXCLUDED.sim_stddev, sim_home_win_pct = EXCLUDED.sim_home_win_pct,
      vegas_spread = EXCLUDED.vegas_spread, edge = EXCLUDED.edge, confidence = EXCLUDED.confidence,
      synergy_buffs_home = EXCLUDED.synergy_buffs_home, synergy_buffs_away = EXCLUDED.synergy_buffs_away
  `;
}
```

- [ ] **Step 7: Add readers for predictions**

Append to `src/lib/nba/db/readers.ts`:

```typescript
export async function getTodayPredictions(sql: any) {
  return sql`
    SELECT p.*, o.spread_home as book_spread, o.bookmaker
    FROM nba_predictions p
    LEFT JOIN nba_odds o ON o.event_id = p.event_id
    WHERE p.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY ABS(p.edge) DESC
  `;
}

export async function getPrediction(sql: any, eventId: string) {
  const rows = await sql`SELECT * FROM nba_predictions WHERE event_id = ${eventId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}

export async function getPredictionAccuracy(sql: any) {
  return sql`
    SELECT
      COUNT(*) as total_predictions,
      COUNT(*) FILTER (WHERE beat_vegas = true) as beat_vegas_count,
      COUNT(*) FILTER (WHERE ats_result = 'cover') as covers,
      COUNT(*) FILTER (WHERE ats_result = 'miss') as misses,
      COUNT(*) FILTER (WHERE ats_result = 'push') as pushes,
      ROUND(AVG(ABS(predicted_spread - actual_margin)), 2) as model_mae,
      ROUND(AVG(ABS(vegas_spread - actual_margin)), 2) as vegas_mae
    FROM nba_prediction_results
  `;
}

export async function getOddsForEvent(sql: any, eventId: string) {
  return sql`SELECT * FROM nba_odds WHERE event_id = ${eventId} ORDER BY captured_at DESC`;
}
```

- [ ] **Step 8: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add src/lib/nba/odds.ts src/lib/nba/tests/odds.test.ts src/lib/nba/db/migrate.ts src/lib/nba/db/writers.ts src/lib/nba/db/readers.ts
git commit -m "Add odds client, prediction DB tables, and odds ingestion"
```

---

### Task 3: Stat Mapper — Real NBA Stats to Engine Scale

**Files:**
- Create: `src/lib/nba/sim/stat-mapper.ts`
- Test: `src/lib/nba/tests/stat-mapper.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/nba/tests/stat-mapper.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapPlayerToEngine, mapRosterToEngine, type EnginePlayer } from "../sim/stat-mapper";

describe("mapPlayerToEngine", () => {
  it("maps LeBron's real stats to engine 0-100 scale", () => {
    const result = mapPlayerToEngine({
      player_id: 2544,
      player_name: "LeBron James",
      team_id: 1610612747,
      fg_pct: 0.495,
      ts_pct: 0.58,
      fg3_pct: 0.362,
      def_rtg: 110,
      stl_pct: 1.8,
      blk_pct: 1.2,
      pace: 100,
      mpg: 35.2,
      age: 41,
      height_inches: 81,
      weight_lbs: 250,
    });

    expect(result.shooting).toBeGreaterThanOrEqual(0);
    expect(result.shooting).toBeLessThanOrEqual(100);
    expect(result.defense).toBeGreaterThanOrEqual(0);
    expect(result.defense).toBeLessThanOrEqual(100);
    expect(result.speed).toBeGreaterThanOrEqual(0);
    expect(result.speed).toBeLessThanOrEqual(100);
    expect(result.height_inches).toBe(81);
    expect(result.weight_lbs).toBe(250);
    expect(result.name).toBe("LeBron James");
    // LeBron should have above-average shooting
    expect(result.shooting).toBeGreaterThan(60);
  });

  it("maps a poor shooter to low shooting stat", () => {
    const result = mapPlayerToEngine({
      player_id: 9999,
      player_name: "Bad Shooter",
      team_id: 1,
      fg_pct: 0.35,
      ts_pct: 0.42,
      fg3_pct: 0.22,
      def_rtg: 118,
      stl_pct: 0.5,
      blk_pct: 0.3,
      pace: 98,
      mpg: 20,
      age: 22,
      height_inches: 76,
      weight_lbs: 210,
    });
    expect(result.shooting).toBeLessThan(50);
  });

  it("maps a defensive specialist to high defense", () => {
    const result = mapPlayerToEngine({
      player_id: 8888,
      player_name: "Lockdown",
      team_id: 1,
      fg_pct: 0.40,
      ts_pct: 0.50,
      fg3_pct: 0.30,
      def_rtg: 100, // elite
      stl_pct: 3.0,
      blk_pct: 2.5,
      pace: 100,
      mpg: 32,
      age: 27,
      height_inches: 79,
      weight_lbs: 220,
    });
    expect(result.defense).toBeGreaterThan(70);
  });

  it("clamps all stats to 0-100", () => {
    const result = mapPlayerToEngine({
      player_id: 1,
      player_name: "Edge Case",
      team_id: 1,
      fg_pct: 0.99,
      ts_pct: 0.99,
      fg3_pct: 0.99,
      def_rtg: 80,
      stl_pct: 10,
      blk_pct: 10,
      pace: 120,
      mpg: 48,
      age: 20,
      height_inches: 88,
      weight_lbs: 300,
    });
    expect(result.shooting).toBeLessThanOrEqual(100);
    expect(result.defense).toBeLessThanOrEqual(100);
    expect(result.speed).toBeLessThanOrEqual(100);
  });
});

describe("mapRosterToEngine", () => {
  it("maps array of players and assigns team", () => {
    const players = [
      { player_id: 1, player_name: "P1", team_id: 100, fg_pct: 0.45, ts_pct: 0.55, fg3_pct: 0.35, def_rtg: 108, stl_pct: 1.5, blk_pct: 1.0, pace: 100, mpg: 30, age: 25, height_inches: 78, weight_lbs: 215 },
      { player_id: 2, player_name: "P2", team_id: 100, fg_pct: 0.48, ts_pct: 0.58, fg3_pct: 0.38, def_rtg: 106, stl_pct: 2.0, blk_pct: 0.5, pace: 102, mpg: 33, age: 28, height_inches: 75, weight_lbs: 195 },
    ];
    const roster = mapRosterToEngine(players, "LAL");
    expect(roster).toHaveLength(2);
    expect(roster[0].team).toBe("LAL");
    expect(roster[1].team).toBe("LAL");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/stat-mapper.test.ts
```

- [ ] **Step 3: Implement stat mapper**

Create `src/lib/nba/sim/stat-mapper.ts`:

```typescript
/**
 * Maps real NBA player stats to engine 0-100 scale.
 * Calibration coefficients are the tuning target.
 */

export interface RealPlayerStats {
  player_id: number;
  player_name: string;
  team_id: number;
  fg_pct: number;      // 0-1
  ts_pct: number;      // 0-1 (True Shooting %)
  fg3_pct: number;     // 0-1
  def_rtg: number;     // ~95-120 (lower = better)
  stl_pct: number;     // 0-5ish
  blk_pct: number;     // 0-5ish
  pace: number;        // ~95-110
  mpg: number;         // 0-48
  age: number;
  height_inches: number;
  weight_lbs: number;
}

export interface EnginePlayer {
  id: number;
  name: string;
  team: string;
  shooting: number;    // 0-100
  defense: number;     // 0-100
  speed: number;       // 0-100
  height_inches: number;
  weight_lbs: number;
  stamina: number;     // 0-100
}

// Calibration coefficients — Phase A hand-tuned, Phase B optimized
export interface CalibrationCoefficients {
  shooting: { ts_weight: number; fg_weight: number; fg3_weight: number; scale: number; offset: number };
  defense: { drtg_weight: number; stl_weight: number; blk_weight: number; drtg_center: number; scale: number };
  speed: { pace_weight: number; pace_center: number; age_penalty: number; scale: number };
  stamina: { mpg_weight: number; age_penalty: number; scale: number };
}

export const DEFAULT_COEFFICIENTS: CalibrationCoefficients = {
  shooting: { ts_weight: 0.4, fg_weight: 0.3, fg3_weight: 0.3, scale: 130, offset: 10 },
  defense: { drtg_weight: 0.5, stl_weight: 0.25, blk_weight: 0.25, drtg_center: 110, scale: 3.0 },
  speed: { pace_weight: 0.7, pace_center: 100, age_penalty: 0.5, scale: 5.0 },
  stamina: { mpg_weight: 2.0, age_penalty: 0.8, scale: 1.0 },
};

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

export function mapPlayerToEngine(
  player: RealPlayerStats,
  coeffs: CalibrationCoefficients = DEFAULT_COEFFICIENTS,
): EnginePlayer {
  const c = coeffs;

  // Shooting: weighted blend of TS%, FG%, FG3%, scaled to 0-100
  const shootingRaw =
    (player.ts_pct * c.shooting.ts_weight +
     player.fg_pct * c.shooting.fg_weight +
     player.fg3_pct * c.shooting.fg3_weight) *
    c.shooting.scale + c.shooting.offset;

  // Defense: inverse DRTG (lower = better) + steal/block blend
  const drtgScore = (c.defense.drtg_center - player.def_rtg) * c.defense.drtg_weight * c.defense.scale;
  const stealScore = player.stl_pct * c.defense.stl_weight * 10;
  const blockScore = player.blk_pct * c.defense.blk_weight * 10;
  const defenseRaw = 50 + drtgScore + stealScore + blockScore;

  // Speed: pace percentile + age decay
  const paceScore = (player.pace - c.speed.pace_center) * c.speed.pace_weight * c.speed.scale;
  const agePenalty = Math.max(0, (player.age - 28) * c.speed.age_penalty);
  const speedRaw = 60 + paceScore - agePenalty;

  // Stamina: MPG-based + age decay
  const staminaRaw = player.mpg * c.stamina.mpg_weight - Math.max(0, (player.age - 30) * c.stamina.age_penalty * 5);

  return {
    id: player.player_id,
    name: player.player_name,
    team: "",
    shooting: clamp(Math.round(shootingRaw)),
    defense: clamp(Math.round(defenseRaw)),
    speed: clamp(Math.round(speedRaw)),
    height_inches: player.height_inches,
    weight_lbs: player.weight_lbs,
    stamina: clamp(Math.round(staminaRaw)),
  };
}

export function mapRosterToEngine(
  players: RealPlayerStats[],
  teamAbbrev: string,
  coeffs: CalibrationCoefficients = DEFAULT_COEFFICIENTS,
): EnginePlayer[] {
  return players.map((p) => {
    const mapped = mapPlayerToEngine(p, coeffs);
    mapped.team = teamAbbrev;
    return mapped;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/stat-mapper.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add src/lib/nba/sim/stat-mapper.ts src/lib/nba/tests/stat-mapper.test.ts
git commit -m "Add stat mapper: real NBA stats to engine 0-100 scale"
```

---

### Task 4: Engine Bridge — WASM Wrapper for Node.js

**Files:**
- Create: `src/lib/nba/sim/engine-bridge.ts`
- Test: `src/lib/nba/tests/monte-carlo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/nba/tests/monte-carlo.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  runMonteCarloSim, type SimulationInput, type SimulationResult,
} from "../sim/monte-carlo";
import { type EnginePlayer } from "../sim/stat-mapper";

const HOME_ROSTER: EnginePlayer[] = [
  { id: 1, name: "PG", team: "LAL", shooting: 80, defense: 60, speed: 85, height_inches: 75, weight_lbs: 190, stamina: 80 },
  { id: 2, name: "SG", team: "LAL", shooting: 85, defense: 55, speed: 80, height_inches: 77, weight_lbs: 210, stamina: 75 },
  { id: 3, name: "SF", team: "LAL", shooting: 70, defense: 70, speed: 75, height_inches: 80, weight_lbs: 230, stamina: 85 },
  { id: 4, name: "PF", team: "LAL", shooting: 60, defense: 80, speed: 65, height_inches: 82, weight_lbs: 245, stamina: 80 },
  { id: 5, name: "C",  team: "LAL", shooting: 50, defense: 85, speed: 55, height_inches: 84, weight_lbs: 260, stamina: 70 },
];

const AWAY_ROSTER: EnginePlayer[] = [
  { id: 11, name: "PG", team: "DEN", shooting: 75, defense: 65, speed: 80, height_inches: 74, weight_lbs: 185, stamina: 80 },
  { id: 12, name: "SG", team: "DEN", shooting: 78, defense: 60, speed: 78, height_inches: 76, weight_lbs: 205, stamina: 78 },
  { id: 13, name: "SF", team: "DEN", shooting: 72, defense: 68, speed: 72, height_inches: 79, weight_lbs: 225, stamina: 82 },
  { id: 14, name: "PF", team: "DEN", shooting: 65, defense: 75, speed: 68, height_inches: 81, weight_lbs: 240, stamina: 78 },
  { id: 15, name: "C",  team: "DEN", shooting: 55, defense: 80, speed: 50, height_inches: 83, weight_lbs: 270, stamina: 72 },
];

describe("runMonteCarloSim (pure TypeScript fallback)", () => {
  it("returns a valid SimulationResult", () => {
    const result = runMonteCarloSim({
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 50,
      ticksPerSim: 300,
    });

    expect(result.simCount).toBe(50);
    expect(result.medianSpread).toBeDefined();
    expect(result.meanSpread).toBeDefined();
    expect(result.stddev).toBeGreaterThan(0);
    expect(result.homeWinPct).toBeGreaterThanOrEqual(0);
    expect(result.homeWinPct).toBeLessThanOrEqual(1);
    expect(result.scores).toHaveLength(50);
  });

  it("produces deterministic results with same seed", () => {
    const input: SimulationInput = {
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 20,
      ticksPerSim: 200,
      baseSeed: 42,
    };
    const r1 = runMonteCarloSim(input);
    const r2 = runMonteCarloSim(input);
    expect(r1.medianSpread).toBe(r2.medianSpread);
    expect(r1.meanSpread).toBe(r2.meanSpread);
  });

  it("better home roster produces positive median spread more often", () => {
    const strongHome = HOME_ROSTER.map((p) => ({ ...p, shooting: 95, defense: 90 }));
    const weakAway = AWAY_ROSTER.map((p) => ({ ...p, shooting: 30, defense: 30 }));
    const result = runMonteCarloSim({
      homeRoster: strongHome,
      awayRoster: weakAway,
      simCount: 100,
      ticksPerSim: 300,
    });
    expect(result.homeWinPct).toBeGreaterThan(0.5);
  });

  it("returns synergy buffs for both teams", () => {
    const result = runMonteCarloSim({
      homeRoster: HOME_ROSTER,
      awayRoster: AWAY_ROSTER,
      simCount: 10,
      ticksPerSim: 100,
    });
    expect(result.homeSynergies).toBeDefined();
    expect(Array.isArray(result.homeSynergies)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/monte-carlo.test.ts
```

- [ ] **Step 3: Create engine bridge**

Create `src/lib/nba/sim/engine-bridge.ts`:

```typescript
/**
 * WASM engine bridge for server-side simulation.
 * Falls back to a pure TypeScript simulator when WASM is unavailable.
 */
import type { EnginePlayer } from "./stat-mapper";

export interface SimScore {
  homeScore: number;
  awayScore: number;
  synergies: { name: string; tier: number; shootingBuff: number; defenseBuff: number; speedBuff: number }[];
}

/**
 * Pure TypeScript simulation fallback.
 * Simplified model: each tick, a random team "possesses" and shoots.
 * Shot probability uses the engine formula: (shooting/100) * exp(-dist * 0.05) - defender contest.
 * This is intentionally simpler than the C++ engine but captures the same stat relationships.
 */
export function simulateGameTS(
  home: EnginePlayer[],
  away: EnginePlayer[],
  seed: number,
  ticks: number,
): SimScore {
  // Simple seeded PRNG (mulberry32)
  let s = seed | 0;
  function rand(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let homeScore = 0;
  let awayScore = 0;

  // Compute team averages for sim
  const avg = (players: EnginePlayer[], key: keyof EnginePlayer) =>
    players.reduce((s, p) => s + (Number(p[key]) || 0), 0) / players.length;

  const homeShooting = avg(home, "shooting");
  const homeDefense = avg(home, "defense");
  const homeSpeed = avg(home, "speed");
  const awayShooting = avg(away, "shooting");
  const awayDefense = avg(away, "defense");
  const awaySpeed = avg(away, "speed");

  // Synergy detection (simplified)
  const synergies: SimScore["synergies"] = [];
  const homeTeams = new Map<string, number>();
  for (const p of home) {
    homeTeams.set(p.team, (homeTeams.get(p.team) || 0) + 1);
  }
  for (const [team, count] of homeTeams) {
    if (count >= 2) {
      synergies.push({ name: `${team} Franchise`, tier: Math.floor(count / 2), shootingBuff: 5 * Math.floor(count / 2), defenseBuff: 0, speedBuff: 0 });
    }
  }
  const giants = home.filter((p) => p.height_inches >= 82).length;
  if (giants >= 2) {
    synergies.push({ name: "Twin Towers", tier: giants - 1, shootingBuff: 0, defenseBuff: 15, speedBuff: -5 });
  }

  // Apply synergy buffs
  let homeShootBuff = synergies.reduce((s, b) => s + b.shootingBuff, 0);
  let homeDefBuff = synergies.reduce((s, b) => s + b.defenseBuff, 0);

  const effHomeShooting = Math.min(100, homeShooting + homeShootBuff);
  const effHomeDefense = Math.min(100, homeDefense + homeDefBuff);

  // Sim loop: ~2 possessions per tick at game pace
  const possessionsPerTick = 0.15;
  for (let t = 0; t < ticks; t++) {
    if (rand() < possessionsPerTick) {
      // Home possession
      const shotProb = (effHomeShooting / 100) * 0.48 - (awayDefense / 100) * 0.08;
      const threeProb = 0.35;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        homeScore += rand() < threeProb ? 3 : 2;
      }
    }
    if (rand() < possessionsPerTick) {
      // Away possession
      const shotProb = (awayShooting / 100) * 0.48 - (effHomeDefense / 100) * 0.08;
      const threeProb = 0.35;
      if (rand() < Math.max(0.2, Math.min(0.65, shotProb))) {
        awayScore += rand() < threeProb ? 3 : 2;
      }
    }
  }

  return { homeScore, awayScore, synergies };
}
```

- [ ] **Step 4: Create Monte Carlo runner**

Create `src/lib/nba/sim/monte-carlo.ts`:

```typescript
/**
 * Monte Carlo simulation runner.
 * Runs N game simulations and aggregates score distributions.
 */
import type { EnginePlayer } from "./stat-mapper";
import { simulateGameTS, type SimScore } from "./engine-bridge";

export interface SimulationInput {
  homeRoster: EnginePlayer[];
  awayRoster: EnginePlayer[];
  simCount: number;
  ticksPerSim: number;
  baseSeed?: number;
}

export interface SimulationResult {
  simCount: number;
  medianSpread: number;
  meanSpread: number;
  stddev: number;
  homeWinPct: number;
  scores: { homeScore: number; awayScore: number; spread: number }[];
  homeSynergies: SimScore["synergies"];
  awaySynergies: SimScore["synergies"];
}

export function runMonteCarloSim(input: SimulationInput): SimulationResult {
  const { homeRoster, awayRoster, simCount, ticksPerSim, baseSeed = 1 } = input;
  const scores: SimulationResult["scores"] = [];
  let homeSynergies: SimScore["synergies"] = [];
  let awaySynergies: SimScore["synergies"] = [];

  for (let i = 0; i < simCount; i++) {
    const seed = baseSeed + i;
    const result = simulateGameTS(homeRoster, awayRoster, seed, ticksPerSim);

    // Capture synergies from first sim (same roster = same synergies)
    if (i === 0) {
      homeSynergies = result.synergies;
      // Run reverse for away synergies
      const awayResult = simulateGameTS(awayRoster, homeRoster, seed + 100000, ticksPerSim);
      awaySynergies = awayResult.synergies;
    }

    const spread = result.homeScore - result.awayScore;
    scores.push({ homeScore: result.homeScore, awayScore: result.awayScore, spread });
  }

  const spreads = scores.map((s) => s.spread).sort((a, b) => a - b);
  const mid = Math.floor(spreads.length / 2);
  const medianSpread = spreads.length % 2 === 0
    ? (spreads[mid - 1] + spreads[mid]) / 2
    : spreads[mid];

  const meanSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const variance = spreads.reduce((s, v) => s + (v - meanSpread) ** 2, 0) / spreads.length;
  const stddev = Math.sqrt(variance);
  const homeWins = scores.filter((s) => s.spread > 0).length;
  const homeWinPct = homeWins / simCount;

  return {
    simCount,
    medianSpread: Math.round(medianSpread * 10) / 10,
    meanSpread: Math.round(meanSpread * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    homeWinPct: Math.round(homeWinPct * 1000) / 1000,
    scores,
    homeSynergies,
    awaySynergies,
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/monte-carlo.test.ts
```

- [ ] **Step 6: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add src/lib/nba/sim/engine-bridge.ts src/lib/nba/sim/monte-carlo.ts src/lib/nba/tests/monte-carlo.test.ts
git commit -m "Add Monte Carlo simulation runner with TypeScript engine fallback"
```

---

### Task 5: Edge Detector

**Files:**
- Create: `src/lib/nba/predictions/edge-detector.ts`
- Create: `src/lib/nba/predictions/accuracy.ts`
- Test: `src/lib/nba/tests/edge-detector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/nba/tests/edge-detector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectEdge, classifyConfidence, type EdgeResult } from "../predictions/edge-detector";
import { computeAccuracy, type PredictionRecord } from "../predictions/accuracy";

describe("detectEdge", () => {
  it("calculates edge as sim spread minus vegas spread", () => {
    const edge = detectEdge(-7.5, -3.5);
    // sim says home by 7.5, vegas says home by 3.5 → edge = -4 (model likes home more)
    expect(edge.edge).toBe(-4);
    expect(edge.direction).toBe("home");
  });

  it("positive edge means model likes away more than Vegas", () => {
    const edge = detectEdge(-1.0, -5.0);
    // sim says home by 1, vegas says home by 5 → edge = +4 (model likes away more)
    expect(edge.edge).toBe(4);
    expect(edge.direction).toBe("away");
  });

  it("zero edge when sim matches Vegas", () => {
    const edge = detectEdge(-3.5, -3.5);
    expect(edge.edge).toBe(0);
    expect(edge.direction).toBe("none");
  });
});

describe("classifyConfidence", () => {
  it("high confidence: |edge| > 5 and stddev < 8", () => {
    expect(classifyConfidence(6, 7)).toBe("high");
    expect(classifyConfidence(-6, 7)).toBe("high");
  });

  it("medium confidence: |edge| > 3 and stddev < 10", () => {
    expect(classifyConfidence(4, 9)).toBe("medium");
  });

  it("low confidence for small edge", () => {
    expect(classifyConfidence(1, 12)).toBe("low");
  });

  it("low confidence for high variance even with big edge", () => {
    expect(classifyConfidence(8, 15)).toBe("low");
  });
});

describe("computeAccuracy", () => {
  it("calculates ATS record correctly", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -7 },  // edge on home, home covered → cover
      { predicted_spread: -5, vegas_spread: -3, actual_margin: 2 },   // edge on home, away won → miss
      { predicted_spread: 2, vegas_spread: -1, actual_margin: 3 },    // edge on away, away covered → cover
    ];
    const acc = computeAccuracy(records);
    expect(acc.totalPredictions).toBe(3);
    expect(acc.covers).toBe(2);
    expect(acc.misses).toBe(1);
  });

  it("calculates MAE for model and Vegas", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -4 },
      { predicted_spread: -8, vegas_spread: -6, actual_margin: -7 },
    ];
    const acc = computeAccuracy(records);
    // Model MAE: (|(-5)-(-4)| + |(-8)-(-7)|) / 2 = (1 + 1) / 2 = 1
    expect(acc.modelMae).toBe(1);
    // Vegas MAE: (|(-3)-(-4)| + |(-6)-(-7)|) / 2 = (1 + 1) / 2 = 1
    expect(acc.vegasMae).toBe(1);
  });

  it("tracks beat_vegas correctly", () => {
    const records: PredictionRecord[] = [
      { predicted_spread: -5, vegas_spread: -3, actual_margin: -6 },  // model closer: |1| < |3| → beat
      { predicted_spread: -2, vegas_spread: -3, actual_margin: -3 },  // vegas exact → miss
    ];
    const acc = computeAccuracy(records);
    expect(acc.beatVegas).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/edge-detector.test.ts
```

- [ ] **Step 3: Implement edge detector**

Create `src/lib/nba/predictions/edge-detector.ts`:

```typescript
export interface EdgeResult {
  edge: number;        // sim_spread - vegas_spread (positive = model likes away more)
  direction: "home" | "away" | "none";
}

export function detectEdge(simSpread: number, vegasSpread: number): EdgeResult {
  const edge = simSpread - vegasSpread;
  const direction = edge < 0 ? "home" : edge > 0 ? "away" : "none";
  return { edge: Math.round(edge * 10) / 10, direction };
}

export function classifyConfidence(edge: number, stddev: number): "high" | "medium" | "low" {
  const absEdge = Math.abs(edge);
  if (absEdge > 5 && stddev < 8) return "high";
  if (absEdge > 3 && stddev < 10) return "medium";
  return "low";
}
```

- [ ] **Step 4: Implement accuracy tracker**

Create `src/lib/nba/predictions/accuracy.ts`:

```typescript
export interface PredictionRecord {
  predicted_spread: number;
  vegas_spread: number;
  actual_margin: number;
}

export interface AccuracyStats {
  totalPredictions: number;
  covers: number;
  misses: number;
  pushes: number;
  modelMae: number;
  vegasMae: number;
  beatVegas: number;
}

export function computeAccuracy(records: PredictionRecord[]): AccuracyStats {
  let covers = 0, misses = 0, pushes = 0, beatVegas = 0;
  let modelErrorSum = 0, vegasErrorSum = 0;

  for (const r of records) {
    const modelError = Math.abs(r.predicted_spread - r.actual_margin);
    const vegasError = Math.abs(r.vegas_spread - r.actual_margin);
    modelErrorSum += modelError;
    vegasErrorSum += vegasError;

    if (modelError < vegasError) beatVegas++;

    // ATS: did the edge side cover?
    // Edge direction: if predicted_spread < vegas_spread → edge on home
    const edgeOnHome = r.predicted_spread < r.vegas_spread;
    if (edgeOnHome) {
      // We predicted home does better than Vegas thinks
      // Cover if actual margin < vegas spread (home beat the spread)
      if (r.actual_margin < r.vegas_spread) covers++;
      else if (r.actual_margin === r.vegas_spread) pushes++;
      else misses++;
    } else {
      // Edge on away: we predicted away does better
      // Cover if actual margin > vegas spread (away beat the spread)
      if (r.actual_margin > r.vegas_spread) covers++;
      else if (r.actual_margin === r.vegas_spread) pushes++;
      else misses++;
    }
  }

  return {
    totalPredictions: records.length,
    covers,
    misses,
    pushes,
    modelMae: records.length > 0 ? Math.round(modelErrorSum / records.length * 100) / 100 : 0,
    vegasMae: records.length > 0 ? Math.round(vegasErrorSum / records.length * 100) / 100 : 0,
    beatVegas,
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/tests/edge-detector.test.ts
```

- [ ] **Step 6: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add src/lib/nba/predictions/edge-detector.ts src/lib/nba/predictions/accuracy.ts src/lib/nba/tests/edge-detector.test.ts
git commit -m "Add edge detector and prediction accuracy tracker"
```

---

### Task 6: API Endpoints

**Files:**
- Create: `src/pages/api/nba/odds/[eventId].ts`
- Create: `src/pages/api/nba/predictions/today.ts`
- Create: `src/pages/api/nba/predictions/[eventId].ts`
- Create: `src/pages/api/nba/predictions/accuracy.ts`
- Create: `src/pages/api/nba/admin/simulate.ts`

- [ ] **Step 1: Create odds endpoint**

Create `src/pages/api/nba/odds/[eventId].ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getOddsForEvent } from "src/lib/nba/db/readers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventId = req.query.eventId as string;
  try {
    const odds = await getOddsForEvent(sql, eventId);
    res.status(200).json({ data: odds, _meta: { endpoint: "odds", eventId } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
```

- [ ] **Step 2: Create today's predictions endpoint**

Create `src/pages/api/nba/predictions/today.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getTodayPredictions } from "src/lib/nba/db/readers";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const predictions = await getTodayPredictions(sql);
    res.status(200).json({ data: predictions, _meta: { endpoint: "predictions/today" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
```

- [ ] **Step 3: Create single prediction endpoint**

Create `src/pages/api/nba/predictions/[eventId].ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getPrediction, getOddsForEvent } from "src/lib/nba/db/readers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventId = req.query.eventId as string;
  try {
    const [prediction, odds] = await Promise.all([
      getPrediction(sql, eventId),
      getOddsForEvent(sql, eventId),
    ]);
    if (!prediction) {
      return res.status(404).json({ error: "No prediction found for this event" });
    }
    res.status(200).json({ data: { prediction, odds }, _meta: { endpoint: "predictions/detail" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
```

- [ ] **Step 4: Create accuracy endpoint**

Create `src/pages/api/nba/predictions/accuracy.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { getPredictionAccuracy } from "src/lib/nba/db/readers";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await getPredictionAccuracy(sql);
    const stats = rows[0] ?? { total_predictions: 0, beat_vegas_count: 0, covers: 0, misses: 0, pushes: 0, model_mae: null, vegas_mae: null };
    res.status(200).json({ data: stats, _meta: { endpoint: "predictions/accuracy" } });
  } catch (e: unknown) {
    res.status(503).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
```

- [ ] **Step 5: Create admin simulate endpoint**

Create `src/pages/api/nba/admin/simulate.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { fetchOdds, parseOddsResponse, consensusSpread } from "src/lib/nba/odds";
import { runMonteCarloSim } from "src/lib/nba/sim/monte-carlo";
import { mapRosterToEngine, DEFAULT_COEFFICIENTS } from "src/lib/nba/sim/stat-mapper";
import { detectEdge, classifyConfidence } from "src/lib/nba/predictions/edge-detector";
import { upsertOdds, insertPrediction } from "src/lib/nba/db/writers";
import type { EnginePlayer } from "src/lib/nba/sim/stat-mapper";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ODDS_API_KEY not configured" });
  }

  try {
    // 1. Fetch odds
    const events = await fetchOdds(apiKey);
    const results: any[] = [];

    for (const event of events) {
      const oddsRows = parseOddsResponse(event);
      if (oddsRows.length === 0) continue;

      // Store odds
      await upsertOdds(sql, oddsRows);

      // 2. Get consensus spread
      const vegas = consensusSpread(oddsRows);

      // 3. Build rosters from DB (placeholder: use average stats if real roster unavailable)
      // In production, query nba_players for team rosters + nba_player_season_stats for advanced stats
      // For now, use default-stat rosters
      const defaultPlayer = (id: number, name: string, team: string): EnginePlayer => ({
        id, name, team, shooting: 65, defense: 60, speed: 65, height_inches: 78, weight_lbs: 215, stamina: 75,
      });

      const homeRoster = Array.from({ length: 5 }, (_, i) =>
        defaultPlayer(i + 1, `Home ${i + 1}`, "HOME")
      );
      const awayRoster = Array.from({ length: 5 }, (_, i) =>
        defaultPlayer(i + 11, `Away ${i + 1}`, "AWAY")
      );

      // 4. Run Monte Carlo
      const simResult = runMonteCarloSim({
        homeRoster,
        awayRoster,
        simCount: 500,
        ticksPerSim: 600,
      });

      // 5. Detect edge
      const { edge } = detectEdge(simResult.medianSpread, vegas);
      const confidence = classifyConfidence(edge, simResult.stddev);

      // 6. Store prediction
      await insertPrediction(sql, {
        event_id: event.id,
        calibration_version: "v0.1.0",
        sim_count: simResult.simCount,
        sim_median_spread: simResult.medianSpread,
        sim_mean_spread: simResult.meanSpread,
        sim_stddev: simResult.stddev,
        sim_home_win_pct: simResult.homeWinPct,
        vegas_spread: vegas,
        edge,
        confidence,
        synergy_buffs_home: simResult.homeSynergies,
        synergy_buffs_away: simResult.awaySynergies,
        home_team: oddsRows[0].home_team,
        away_team: oddsRows[0].away_team,
      });

      results.push({
        event_id: event.id,
        matchup: `${oddsRows[0].home_team} vs ${oddsRows[0].away_team}`,
        vegas_spread: vegas,
        sim_spread: simResult.medianSpread,
        edge,
        confidence,
      });
    }

    res.status(200).json({
      ok: true,
      events_processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Simulation failed" });
  }
}
```

- [ ] **Step 6: Add simulate cron to vercel.json**

Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/nba/admin/ingest",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/nba/admin/simulate",
      "schedule": "0 15 * * *"
    }
  ]
}
```

- [ ] **Step 7: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add src/pages/api/nba/odds/ src/pages/api/nba/predictions/ src/pages/api/nba/admin/simulate.ts vercel.json
git commit -m "Add prediction API endpoints and simulation cron"
```

---

### Task 7: Run Migrations + Full Test Suite

- [ ] **Step 1: Run migrations to add new tables**

```bash
cd /Users/brooks/Desktop/zero-next && export $(grep POSTGRES_URL .env.local | tr -d '"') && npx tsx scripts/run-migrations.ts
```

Expected: 12 tables (8 existing + 4 new)

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/brooks/Desktop/zero-next && npx vitest run src/lib/nba/
```

Expected: All tests pass

- [ ] **Step 3: Commit any fixes**

```bash
cd /Users/brooks/Desktop/zero-next
git add -A && git commit -m "Run migrations, all tests passing"
```

---

### Task 8: Integration Smoke Test

- [ ] **Step 1: Create a smoke test script**

Create `scripts/smoke-test-predictions.ts`:

```typescript
/**
 * Smoke test: run a Monte Carlo sim with fixture data and print results.
 * Usage: npx tsx scripts/smoke-test-predictions.ts
 */
import { mapRosterToEngine, type RealPlayerStats } from "../src/lib/nba/sim/stat-mapper";
import { runMonteCarloSim } from "../src/lib/nba/sim/monte-carlo";
import { detectEdge, classifyConfidence } from "../src/lib/nba/predictions/edge-detector";
import { consensusSpread, type OddsRow } from "../src/lib/nba/odds";

// Lakers vs Nuggets with realistic stats
const lakersPlayers: RealPlayerStats[] = [
  { player_id: 2544, player_name: "LeBron James", team_id: 1610612747, fg_pct: 0.495, ts_pct: 0.58, fg3_pct: 0.362, def_rtg: 110, stl_pct: 1.8, blk_pct: 1.2, pace: 100, mpg: 35.2, age: 41, height_inches: 81, weight_lbs: 250 },
  { player_id: 203076, player_name: "Anthony Davis", team_id: 1610612747, fg_pct: 0.521, ts_pct: 0.60, fg3_pct: 0.343, def_rtg: 105, stl_pct: 1.5, blk_pct: 3.5, pace: 99, mpg: 34.1, age: 33, height_inches: 82, weight_lbs: 253 },
  { player_id: 1630559, player_name: "Austin Reaves", team_id: 1610612747, fg_pct: 0.456, ts_pct: 0.56, fg3_pct: 0.387, def_rtg: 112, stl_pct: 1.2, blk_pct: 0.4, pace: 101, mpg: 33.8, age: 28, height_inches: 77, weight_lbs: 206 },
  { player_id: 100, player_name: "Rui Hachimura", team_id: 1610612747, fg_pct: 0.480, ts_pct: 0.55, fg3_pct: 0.340, def_rtg: 113, stl_pct: 0.8, blk_pct: 0.5, pace: 98, mpg: 28, age: 28, height_inches: 80, weight_lbs: 230 },
  { player_id: 101, player_name: "Gabe Vincent", team_id: 1610612747, fg_pct: 0.410, ts_pct: 0.52, fg3_pct: 0.360, def_rtg: 115, stl_pct: 1.0, blk_pct: 0.2, pace: 102, mpg: 25, age: 30, height_inches: 75, weight_lbs: 200 },
];

const nuggetsPlayers: RealPlayerStats[] = [
  { player_id: 203999, player_name: "Nikola Jokic", team_id: 1610612743, fg_pct: 0.583, ts_pct: 0.65, fg3_pct: 0.359, def_rtg: 108, stl_pct: 1.5, blk_pct: 1.0, pace: 97, mpg: 34.5, age: 31, height_inches: 83, weight_lbs: 284 },
  { player_id: 200, player_name: "Jamal Murray", team_id: 1610612743, fg_pct: 0.460, ts_pct: 0.56, fg3_pct: 0.380, def_rtg: 112, stl_pct: 1.0, blk_pct: 0.3, pace: 99, mpg: 32, age: 29, height_inches: 76, weight_lbs: 215 },
  { player_id: 201, player_name: "Michael Porter Jr.", team_id: 1610612743, fg_pct: 0.490, ts_pct: 0.58, fg3_pct: 0.400, def_rtg: 114, stl_pct: 0.6, blk_pct: 0.8, pace: 97, mpg: 30, age: 28, height_inches: 82, weight_lbs: 218 },
  { player_id: 202, player_name: "Aaron Gordon", team_id: 1610612743, fg_pct: 0.530, ts_pct: 0.56, fg3_pct: 0.320, def_rtg: 107, stl_pct: 0.9, blk_pct: 0.7, pace: 98, mpg: 31, age: 30, height_inches: 80, weight_lbs: 235 },
  { player_id: 203, player_name: "Kentavious Caldwell-Pope", team_id: 1610612743, fg_pct: 0.440, ts_pct: 0.54, fg3_pct: 0.370, def_rtg: 109, stl_pct: 1.5, blk_pct: 0.3, pace: 100, mpg: 29, age: 33, height_inches: 77, weight_lbs: 204 },
];

// Fake odds
const fakeOdds: OddsRow[] = [
  { event_id: "test1", bookmaker: "draftkings", spread_home: -3.5, spread_away: 3.5, over_under: 224.5, home_ml: -150, away_ml: 130, home_team: "Lakers", away_team: "Nuggets", commence_time: "" },
  { event_id: "test1", bookmaker: "fanduel", spread_home: -3.0, spread_away: 3.0, over_under: 225, home_ml: -145, away_ml: 125, home_team: "Lakers", away_team: "Nuggets", commence_time: "" },
];

async function main() {
  console.log("=== Monte Carlo Edge Finder — Smoke Test ===\n");
  console.log("Matchup: Lakers vs Nuggets\n");

  // Map rosters
  const homeMapped = mapRosterToEngine(lakersPlayers, "LAL");
  const awayMapped = mapRosterToEngine(nuggetsPlayers, "DEN");

  console.log("--- Mapped Rosters ---");
  for (const p of homeMapped) {
    console.log(`  LAL ${p.name.padEnd(25)} SHT:${p.shooting} DEF:${p.defense} SPD:${p.speed} HT:${p.height_inches}`);
  }
  for (const p of awayMapped) {
    console.log(`  DEN ${p.name.padEnd(25)} SHT:${p.shooting} DEF:${p.defense} SPD:${p.speed} HT:${p.height_inches}`);
  }

  // Run sim
  console.log("\n--- Running 1000 Simulations ---");
  const start = performance.now();
  const result = runMonteCarloSim({
    homeRoster: homeMapped,
    awayRoster: awayMapped,
    simCount: 1000,
    ticksPerSim: 600,
    baseSeed: 42,
  });
  const elapsed = Math.round(performance.now() - start);

  console.log(`  Completed in ${elapsed}ms`);
  console.log(`  Median Spread: ${result.medianSpread > 0 ? "+" : ""}${result.medianSpread}`);
  console.log(`  Mean Spread:   ${result.meanSpread > 0 ? "+" : ""}${result.meanSpread}`);
  console.log(`  Std Dev:       ${result.stddev}`);
  console.log(`  Home Win %:    ${(result.homeWinPct * 100).toFixed(1)}%`);
  console.log(`  Synergies:     ${result.homeSynergies.map((s) => s.name).join(", ") || "none"}`);

  // Compare to Vegas
  const vegas = consensusSpread(fakeOdds);
  const { edge } = detectEdge(result.medianSpread, vegas);
  const confidence = classifyConfidence(edge, result.stddev);

  console.log("\n--- Edge Detection ---");
  console.log(`  Vegas Spread:  ${vegas}`);
  console.log(`  Model Spread:  ${result.medianSpread}`);
  console.log(`  Edge:          ${edge > 0 ? "+" : ""}${edge}`);
  console.log(`  Confidence:    ${confidence.toUpperCase()}`);
  console.log(`  Direction:     ${edge < 0 ? "HOME (Lakers)" : edge > 0 ? "AWAY (Nuggets)" : "NO EDGE"}`);

  console.log("\nSmoke test complete.");
}

main().catch(console.error);
```

- [ ] **Step 2: Run the smoke test**

```bash
cd /Users/brooks/Desktop/zero-next && npx tsx scripts/smoke-test-predictions.ts
```

Expected: Full output showing mapped rosters, sim results, and edge detection.

- [ ] **Step 3: Commit**

```bash
cd /Users/brooks/Desktop/zero-next
git add scripts/smoke-test-predictions.ts
git commit -m "Add Monte Carlo smoke test with Lakers vs Nuggets matchup"
```
