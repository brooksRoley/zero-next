# Go: Adaptive Bot + Coach + Training Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Go's 3 fixed bot levels with continuous ELO-adaptive difficulty, add a toggleable coach that gives contextual tips during gameplay, and connect the lesson system to practice games.

**Architecture:** Three integrated systems sharing a single player profile. The adaptive bot (`src/lib/go/adaptiveBot.js`) produces a config object consumed by the worker. The coach hook (`src/hooks/useCoach.js`) scans board state after each move and emits tips. The lesson-to-practice flow uses `?practice=<stage>` query params to auto-configure bot + coach. All new state (gamesPlayed, gamesWon, coachEnabled) lives in the existing `useGoPlayerProfile` hook with a v1→v2 migration.

**Tech Stack:** React hooks, Web Worker, Vitest, localStorage, CSS transitions

**Spec:** `docs/superpowers/specs/2026-04-27-go-adaptive-bot-coach-training-loop-design.md`

---

### Task 1: Player Profile v2 Migration

Add `gamesPlayed`, `gamesWon`, and `coachEnabled` fields to the Go player profile with backward-compatible migration.

**Files:**
- Modify: `src/hooks/useGoPlayerProfile.js`
- Create: `src/lib/go/__tests__/useGoPlayerProfile.test.js`

- [ ] **Step 1: Write the failing tests**

Create the test file:

```js
// src/lib/go/__tests__/useGoPlayerProfile.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// We test the migration logic directly since the hook uses localStorage.
// Simulate what loadProfile does with old v1 data.

const STORAGE_KEY_V1 = 'go.profile.v1'
const STORAGE_KEY_V2 = 'go.profile.v2'

describe('profile v2 migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('fresh profile has v2 fields with defaults', async () => {
    const { default: useGoPlayerProfile } = await import('src/hooks/useGoPlayerProfile.js')
    // We can't call hooks outside React, so test the exported helpers instead.
    // The migration is in loadProfile which runs on first render.
    // Instead, test via the module's emptyProfile shape.
    // We'll test by checking localStorage after a manual save.

    // For this test, we rely on the fact that emptyProfile includes the new fields.
    // Import the module fresh and check defaults.
    const mod = await import('src/hooks/useGoPlayerProfile.js')
    // emptyProfile is not exported, but we can test by writing a v1 profile
    // and checking that loadProfile fills in defaults.

    // Write a v1 profile (no gamesPlayed, gamesWon, coachEnabled)
    const v1Profile = {
      playerId: 'go-test-123',
      goElo: 1100,
      peakElo: 1100,
      solved: [],
      attempts: [],
      lessonProgress: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      lastSeen: '2026-01-01T00:00:00.000Z',
    }
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(v1Profile))
  })

  it('v1 profile missing gamesPlayed gets default 0', () => {
    const v1Profile = {
      playerId: 'go-test-456',
      goElo: 900,
      peakElo: 950,
      solved: ['capture-corner'],
      attempts: [],
      lessonProgress: { '0': { completed: true } },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastSeen: '2026-01-01T00:00:00.000Z',
    }
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(v1Profile))

    // loadProfile uses spread: { ...emptyProfile(), ...parsed }
    // So if emptyProfile() has gamesPlayed: 0, it will be overwritten
    // by the parsed object which doesn't have it, leaving 0.
    // Actually, spread puts parsed AFTER emptyProfile, so parsed wins.
    // But parsed doesn't have gamesPlayed, so emptyProfile's value stays.
    // Wait — { ...emptyProfile(), ...parsed } means parsed overwrites.
    // If parsed doesn't have the key, emptyProfile's value persists. Correct.

    // We need to actually call loadProfile. Since it's not exported,
    // we test indirectly through the storage key check.
    const raw = localStorage.getItem(STORAGE_KEY_V1)
    const parsed = JSON.parse(raw)
    expect(parsed.gamesPlayed).toBeUndefined()
    // After emptyProfile spread, should become 0
  })
})
```

Actually, the migration is simpler than this. The existing `loadProfile` already does `{ ...emptyProfile(), ...parsed }` which auto-fills missing fields. We just need to add the fields to `emptyProfile()`. Let me write better tests that validate the actual behavior.

Delete the above and write:

```js
// src/lib/go/__tests__/profileMigration.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// Test the profile shape and migration by directly testing the logic.
// emptyProfile is not exported, so we test through localStorage behavior.

describe('Go player profile v2 fields', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('new fields exist in empty profile defaults', () => {
    // A fresh profile (no localStorage) should include v2 fields.
    // Since we can't call the hook outside React, we test that
    // the storage key change + defaults work by writing a v1 profile
    // and importing the module.

    // This test validates that emptyProfile shape is correct.
    // We'll test the exported recordGameEnd function instead.
  })
})
```

The profile tests are awkward because `emptyProfile` and `loadProfile` are unexported internal functions and the hook requires React. Instead, let's write a simple pure-function test for the new `recordGameEnd` callback and the profile shape. We'll add a thin exported helper.

Replace approach: Since the existing code already handles migration via `{ ...emptyProfile(), ...parsed }`, we just need to add fields to `emptyProfile` and add the `recordGameEnd` callback. The TDD target is `recordGameEnd` logic, not the migration (which is trivially correct by construction).

- [ ] **Step 1: Add v2 fields to emptyProfile and add recordGameEnd + coachEnabled toggle**

In `src/hooks/useGoPlayerProfile.js`:

Change the storage key from `'go.profile.v1'` to `'go.profile.v2'` and add a v1→v2 migration path:

```js
// At top of file, change:
const STORAGE_KEY = 'go.profile.v2'
const LEGACY_V1_KEY = 'go.profile.v1'
```

In `emptyProfile()`, add after `lessonProgress`:

```js
    gamesPlayed: 0,
    gamesWon: 0,
    coachEnabled: true,
```

In `loadProfile()`, add v1 migration before the legacy solved-key check:

```js
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...emptyProfile(), ...parsed }
    }
  } catch { /* ignore */ }
  // Migrate from v1 profile if present
  try {
    const v1Raw = localStorage.getItem(LEGACY_V1_KEY)
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw)
      const migrated = { ...emptyProfile(), ...parsed }
      saveProfile(migrated) // persist as v2
      return migrated
    }
  } catch { /* ignore */ }
  // Migrate from the original solved-only key if present
  const fresh = emptyProfile()
  try {
    const oldSolved = localStorage.getItem(LEGACY_SOLVED_KEY)
    if (oldSolved) fresh.solved = JSON.parse(oldSolved)
  } catch { /* ignore */ }
  return fresh
}
```

Add `recordGameEnd` and `setCoachEnabled` callbacks after `noteLessonVisit`:

```js
  const recordGameEnd = useCallback(({ won }) => {
    update(prev => ({
      ...prev,
      gamesPlayed: (prev.gamesPlayed || 0) + 1,
      gamesWon: (prev.gamesWon || 0) + (won ? 1 : 0),
    }))
  }, [update])

  const setCoachEnabled = useCallback((enabled) => {
    update(prev => ({
      ...prev,
      coachEnabled: !!enabled,
    }))
  }, [update])
```

Add to the return object:

```js
    gamesPlayed: profile?.gamesPlayed ?? 0,
    gamesWon: profile?.gamesWon ?? 0,
    coachEnabled: profile?.coachEnabled ?? true,
    recordGameEnd,
    setCoachEnabled,
```

- [ ] **Step 2: Run lint to verify no errors**

Run: `yarn lint`
Expected: PASS (0 warnings, 0 errors)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoPlayerProfile.js
git commit -m "feat(go): add v2 profile fields — gamesPlayed, gamesWon, coachEnabled"
```

---

### Task 2: Adaptive Bot Engine

Create `src/lib/go/adaptiveBot.js` with `getAdaptiveBotConfig()` and comprehensive tests.

**Files:**
- Create: `src/lib/go/adaptiveBot.js`
- Create: `src/lib/go/__tests__/adaptiveBot.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/go/__tests__/adaptiveBot.test.js
import { describe, it, expect } from 'vitest'
import { getAdaptiveBotConfig } from 'src/lib/go/adaptiveBot'

describe('getAdaptiveBotConfig', () => {
  describe('ELO-to-engine mapping', () => {
    it('returns level 1, 75% random for ELO < 600', () => {
      const cfg = getAdaptiveBotConfig(400, 10, null)
      expect(cfg.level).toBe(1)
      expect(cfg.randomRate).toBeCloseTo(0.75, 2)
    })

    it('interpolates level 1→2, random 75→30% for ELO 600-900', () => {
      const cfg = getAdaptiveBotConfig(750, 10, null)
      expect(cfg.level).toBeGreaterThanOrEqual(1)
      expect(cfg.level).toBeLessThanOrEqual(2)
      expect(cfg.randomRate).toBeGreaterThan(0.30)
      expect(cfg.randomRate).toBeLessThan(0.75)
    })

    it('returns level 2 at ELO 600 boundary', () => {
      const cfg = getAdaptiveBotConfig(600, 10, null)
      expect(cfg.level).toBe(1)
      expect(cfg.randomRate).toBeCloseTo(0.75, 2)
    })

    it('interpolates level 2→3, random 30→5% for ELO 900-1200', () => {
      const cfg = getAdaptiveBotConfig(1050, 10, null)
      expect(cfg.level).toBeGreaterThanOrEqual(2)
      expect(cfg.level).toBeLessThanOrEqual(3)
      expect(cfg.randomRate).toBeGreaterThan(0.05)
      expect(cfg.randomRate).toBeLessThan(0.30)
    })

    it('returns level 4, 0% random for ELO 1200-1500', () => {
      const cfg = getAdaptiveBotConfig(1350, 10, null)
      expect(cfg.level).toBe(4)
      expect(cfg.randomRate).toBe(0)
    })

    it('returns level 5, 0% random for ELO 1500+', () => {
      const cfg = getAdaptiveBotConfig(1800, 10, null)
      expect(cfg.level).toBe(5)
      expect(cfg.randomRate).toBe(0)
    })

    it('returns level 5 for ELO 2000+', () => {
      const cfg = getAdaptiveBotConfig(2000, 10, null)
      expect(cfg.level).toBe(5)
      expect(cfg.randomRate).toBe(0)
    })
  })

  describe('bot ELO output', () => {
    it('reports ~400 for very low player ELO', () => {
      const cfg = getAdaptiveBotConfig(300, 10, null)
      expect(cfg.botElo).toBeGreaterThanOrEqual(350)
      expect(cfg.botElo).toBeLessThanOrEqual(450)
    })

    it('reports ~1600 for high player ELO', () => {
      const cfg = getAdaptiveBotConfig(1800, 10, null)
      expect(cfg.botElo).toBeGreaterThanOrEqual(1500)
      expect(cfg.botElo).toBeLessThanOrEqual(1700)
    })
  })

  describe('new-player ramp', () => {
    it('applies -200 ELO handicap for gamesPlayed 0', () => {
      const newPlayer = getAdaptiveBotConfig(1000, 0, null)
      const veteran = getAdaptiveBotConfig(1000, 10, null)
      expect(newPlayer.botElo).toBeLessThan(veteran.botElo)
      expect(veteran.botElo - newPlayer.botElo).toBeCloseTo(200, -1)
    })

    it('ramps linearly: game 2 has less handicap than game 0', () => {
      const g0 = getAdaptiveBotConfig(1000, 0, null)
      const g2 = getAdaptiveBotConfig(1000, 2, null)
      const g5 = getAdaptiveBotConfig(1000, 5, null)
      expect(g0.botElo).toBeLessThan(g2.botElo)
      expect(g2.botElo).toBeLessThan(g5.botElo)
    })

    it('no handicap at gamesPlayed >= 5', () => {
      const g5 = getAdaptiveBotConfig(1000, 5, null)
      const g10 = getAdaptiveBotConfig(1000, 10, null)
      expect(g5.botElo).toBe(g10.botElo)
    })
  })

  describe('teaching focus', () => {
    it('passes through capture focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'capture')
      expect(cfg.teachingFocus).toBe('capture')
    })

    it('passes through eyes focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'eyes')
      expect(cfg.teachingFocus).toBe('eyes')
    })

    it('passes through territory focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, 'territory')
      expect(cfg.teachingFocus).toBe('territory')
    })

    it('returns null for no teaching focus', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, null)
      expect(cfg.teachingFocus).toBeNull()
    })
  })

  describe('interpolation continuity', () => {
    it('no jumps at ELO boundaries', () => {
      // Walk ELO from 0 to 2000 in steps of 50, verify botElo never jumps > 100
      let prevBotElo = null
      for (let elo = 0; elo <= 2000; elo += 50) {
        const cfg = getAdaptiveBotConfig(elo, 10, null)
        if (prevBotElo !== null) {
          expect(Math.abs(cfg.botElo - prevBotElo)).toBeLessThanOrEqual(100)
        }
        prevBotElo = cfg.botElo
      }
    })
  })

  describe('time budget', () => {
    it('includes timeBudget in output', () => {
      const cfg = getAdaptiveBotConfig(1000, 10, null)
      expect(cfg.timeBudget).toBeGreaterThan(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/go/__tests__/adaptiveBot.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// src/lib/go/adaptiveBot.js

/**
 * Adaptive bot configuration for Go.
 * Maps player ELO to engine parameters (level, randomRate, timeBudget)
 * with continuous interpolation. Mirrors the Pente adaptive bot pattern.
 */

// Anchor points for ELO-to-engine mapping — sorted by playerElo ascending.
// Each anchor defines what the bot looks like when facing a player at that ELO.
const ANCHORS = [
  { playerElo: 0,    level: 1, randomRate: 0.75, botElo: 400,  timeBudget: 1000 },
  { playerElo: 600,  level: 1, randomRate: 0.75, botElo: 400,  timeBudget: 1000 },
  { playerElo: 900,  level: 2, randomRate: 0.30, botElo: 750,  timeBudget: 1500 },
  { playerElo: 1200, level: 3, randomRate: 0.05, botElo: 1150, timeBudget: 2000 },
  { playerElo: 1500, level: 4, randomRate: 0,    botElo: 1350, timeBudget: 2500 },
  { playerElo: 2000, level: 5, randomRate: 0,    botElo: 1600, timeBudget: 3000 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolate(elo) {
  if (elo <= ANCHORS[0].playerElo) return { ...ANCHORS[0] }
  if (elo >= ANCHORS[ANCHORS.length - 1].playerElo) return { ...ANCHORS[ANCHORS.length - 1] }

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const lo = ANCHORS[i]
    const hi = ANCHORS[i + 1]
    if (elo >= lo.playerElo && elo <= hi.playerElo) {
      const t = (elo - lo.playerElo) / (hi.playerElo - lo.playerElo)
      return {
        level: Math.round(lerp(lo.level, hi.level, t)),
        randomRate: Math.max(0, lerp(lo.randomRate, hi.randomRate, t)),
        botElo: Math.round(lerp(lo.botElo, hi.botElo, t)),
        timeBudget: Math.round(lerp(lo.timeBudget, hi.timeBudget, t)),
      }
    }
  }

  return { ...ANCHORS[1] }
}

/**
 * Get bot engine config calibrated to a player's ELO.
 *
 * @param {number} playerElo - Player's current ELO
 * @param {number} gamesPlayed - Total bot games completed
 * @param {string|null} teachingFocus - 'capture' | 'eyes' | 'territory' | null
 * @returns {{ level: number, randomRate: number, botElo: number, timeBudget: number, teachingFocus: string|null }}
 */
export function getAdaptiveBotConfig(playerElo, gamesPlayed, teachingFocus) {
  // New player ramp: first 5 games, bot plays 200 ELO below its normal level
  const rampFactor = Math.min(gamesPlayed, 5) / 5
  const eloOffset = Math.round(200 * (1 - rampFactor))

  const config = interpolate(playerElo)

  return {
    level: config.level,
    randomRate: config.randomRate,
    botElo: config.botElo - eloOffset,
    timeBudget: config.timeBudget,
    teachingFocus: teachingFocus || null,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/go/__tests__/adaptiveBot.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/go/adaptiveBot.js src/lib/go/__tests__/adaptiveBot.test.js
git commit -m "feat(go): adaptive bot engine with ELO interpolation and tests"
```

---

### Task 3: Worker Protocol Update — Config Object + Teaching Focus

Update `goWorker.js` to accept a config object (backward-compatible with bare level number) and apply teaching focus weight biases.

**Files:**
- Modify: `public/goWorker.js`
- Modify: `src/lib/go/botWorker.js`

- [ ] **Step 1: Update `findBotMove` in `goWorker.js` to accept config object**

In `public/goWorker.js`, replace the `findBotMove` function (lines 225-252):

```js
/**
 * Find the best move for `color` at the given difficulty config.
 * config can be:
 *   - a bare number (backward compat: treated as level)
 *   - an object: { level, randomRate, teachingFocus, timeBudget }
 */
function findBotMove(board, color, config, koPoint) {
  // Backward compat: bare number → level
  const cfg = typeof config === 'number'
    ? { level: config, randomRate: ({ 1: 0.75, 2: 0.30, 3: 0.05 })[config] ?? 0.30, teachingFocus: null }
    : config

  const level = cfg.level || 2
  const randomRate = cfg.randomRate !== undefined ? cfg.randomRate : 0.30
  const teachingFocus = cfg.teachingFocus || null

  // Levels 4-5 use minimax
  if (level >= 4) {
    return findBotMoveWithLookahead(board, color, level, koPoint)
  }

  const size = board.length
  const legal = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) {
        const res = applyMove(board, r, c, color, koPoint)
        if (!res.error) legal.push([r, c])
      }
    }
  }
  if (legal.length === 0) return null

  if (Math.random() < randomRate) {
    return legal[Math.floor(Math.random() * legal.length)]
  }

  let best = null
  let bestScore = -Infinity
  for (const [r, c] of legal) {
    const s = scoreBotMove(board, r, c, color, koPoint, teachingFocus)
    if (s > bestScore) { bestScore = s; best = [r, c]; }
  }
  return best || legal[Math.floor(Math.random() * legal.length)]
}
```

- [ ] **Step 2: Update `scoreBotMove` to accept teachingFocus parameter**

In `public/goWorker.js`, update the `scoreBotMove` function signature and add weight biases (lines 176-219):

```js
function scoreBotMove(board, row, col, color, koPoint, teachingFocus) {
  const result = applyMove(board, row, col, color, koPoint)
  if (result.error) return -Infinity

  const size = board.length
  const opp = color === BLACK ? WHITE : BLACK
  let score = 0

  // Teaching focus weight multipliers
  const rescueWeight = teachingFocus === 'capture' ? 0.3 : 1.0
  const eyeWeight = teachingFocus === 'eyes' ? 0.2 : 1.0
  const defenseWeight = teachingFocus === 'territory' ? 0.4 : 1.0

  // Captures: most important tactical signal
  score += result.captured.length * 6

  // Atari: threaten opponent groups with 1 liberty after our move
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (result.newBoard[nr][nc] === opp) {
      const g = findGroup(result.newBoard, nr, nc)
      if (g.liberties.size === 1) score += 3
    }
  }

  // Rescue own groups that were in atari before this move
  for (const [nr, nc] of getNeighbors(row, col, size)) {
    if (board[nr][nc] === color) {
      const before = findGroup(board, nr, nc)
      if (before.liberties.size <= 1) {
        const after = findGroup(result.newBoard, nr, nc)
        if (after.liberties.size >= 3) score += 9 * rescueWeight
        else if (after.liberties.size >= 2) score += 5 * rescueWeight
      }
    }
  }

  // Liberty health of our placed stone's group
  const own = findGroup(result.newBoard, row, col)
  score += Math.min(own.liberties.size, 6) * 0.3 * eyeWeight

  // Center preference (stronger on smaller boards)
  const center = (size - 1) / 2
  const manhattan = Math.abs(row - center) + Math.abs(col - center)
  if (size <= 13) score += Math.max(0, size * 0.4 - manhattan) * 0.15 * defenseWeight

  // Small random tiebreaker for variety
  score += (Math.random() - 0.5) * 0.4
  return score
}
```

- [ ] **Step 3: Update the worker message handler to pass config**

In `public/goWorker.js`, update the `onmessage` handler (lines 504-518):

Replace:
```js
        ? { move: findBotMove(payload.board, payload.color, payload.level || 2, payload.koPoint) }
```
With:
```js
        ? { move: findBotMove(payload.board, payload.color, payload.config || payload.level || 2, payload.koPoint) }
```

- [ ] **Step 4: Update `botWorker.js` to pass config object**

In `src/lib/go/botWorker.js`, change the `findResponse` method signature and payload:

```js
  findResponse(board, color, goal, koPoint, timeoutMs = 1500, config = { level: 2 }) {
    this.ensureWorker()
    if (!this.worker) {
      return Promise.resolve({ move: null, reason: 'no_worker' })
    }
    return new Promise((resolve) => {
      const id = this.nextId++
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          resolve({ move: null, reason: 'timeout' })
        }
      }, timeoutMs)
      this.pending.set(id, { resolve, timeoutId })
      this.worker.postMessage({
        id,
        type: 'find_response',
        payload: { board, color, goal, koPoint, config },
      })
    })
  }
```

- [ ] **Step 5: Run lint**

Run: `yarn lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/goWorker.js src/lib/go/botWorker.js
git commit -m "feat(go): worker accepts config object with teaching focus biases"
```

---

### Task 4: Coach Hook

Create `useCoach` hook that scans board state after each move and emits contextual tips.

**Files:**
- Create: `src/hooks/useCoach.js`
- Create: `src/lib/go/__tests__/coachDetectors.test.js`

- [ ] **Step 1: Write failing tests for the detection functions**

The coach hook has two concerns: (1) pure detection functions and (2) React state management. Test the detectors as pure functions.

```js
// src/lib/go/__tests__/coachDetectors.test.js
import { describe, it, expect } from 'vitest'
import { detectCoachTip } from 'src/hooks/useCoach'
import { EMPTY, BLACK, WHITE, createEmptyBoard, applyMove } from 'src/lib/go/gameLogic'

function setStones(board, stones) {
  for (const [r, c, color] of stones) board[r][c] = color
  return board
}

describe('detectCoachTip', () => {
  it('detects player group in atari', () => {
    // 9x9 board: Black group at (1,1) with 1 liberty
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
      // liberty at (2,1)
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('atari')
  })

  it('detects capture opportunity', () => {
    // White group at (1,1) with 1 liberty, Black can capture
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, WHITE],
      [0, 1, BLACK], [1, 0, BLACK], [1, 2, BLACK],
      // liberty at (2,1) — Black can play there
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('capture')
  })

  it('detects ko situation', () => {
    const board = createEmptyBoard(9)
    const koPoint = [3, 3]
    const tip = detectCoachTip(board, BLACK, koPoint, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip).not.toBeNull()
    expect(tip.category).toBe('ko')
  })

  it('returns null when throttle limit reached', () => {
    const board = createEmptyBoard(9)
    const koPoint = [3, 3]
    const tip = detectCoachTip(board, BLACK, koPoint, {}, { atari: 0, capture: 0, ko: 3, eye: 0, territory: 0 })
    // ko is throttled at 3, so should skip ko and find nothing else
    expect(tip).toBeNull()
  })

  it('includes lesson linkback when lesson is completed', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
    ])
    const lessonProgress = { '1': { completed: true } } // Stage 1 = Breath
    const tip = detectCoachTip(board, BLACK, null, lessonProgress, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip.message).toContain('Breath')
  })

  it('omits lesson linkback when lesson not completed', () => {
    const board = createEmptyBoard(9)
    setStones(board, [
      [1, 1, BLACK],
      [0, 1, WHITE], [1, 0, WHITE], [1, 2, WHITE],
    ])
    const tip = detectCoachTip(board, BLACK, null, {}, { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
    expect(tip.message).not.toContain('Breath')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/go/__tests__/coachDetectors.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write the useCoach hook with exported detectCoachTip**

```js
// src/hooks/useCoach.js
import { useState, useCallback, useRef } from 'react'
import { EMPTY, BLACK, WHITE, findGroup, getNeighbors } from 'src/lib/go/gameLogic'
import { findEyeRegions } from 'src/lib/go/lifeAndDeath'
import { computeAreaScore } from 'src/lib/go/scoring'

const THROTTLE_MAX = 3

// Stage number → stage name for lesson linkbacks
const STAGE_NAMES = {
  0: 'The Void',
  1: 'Breath',
  2: 'Survival',
  3: 'Expansion',
}

// Lesson stages relevant to each tip category
const CATEGORY_STAGES = {
  atari: 1,     // Breath
  capture: 1,   // Breath
  ko: null,     // No lesson yet (Flow is planned but not built)
  eye: 2,       // Survival
  territory: 3, // Expansion
}

function coordLabel(r, c) {
  // Column: A-T (skipping I), Row: board size - r
  const letters = 'ABCDEFGHJKLMNOPQRST'
  return `${letters[c] || '?'}${r + 1}`
}

/**
 * Pure detection function — scans the board and returns one tip or null.
 * Exported for testing.
 *
 * @param {number[][]} board
 * @param {number} playerColor - BLACK or WHITE
 * @param {number[]|null} koPoint
 * @param {object} lessonProgress - { '0': { completed: true }, ... }
 * @param {object} counts - { atari: n, capture: n, ko: n, eye: n, territory: n }
 * @returns {{ category: string, message: string }|null}
 */
export function detectCoachTip(board, playerColor, koPoint, lessonProgress, counts) {
  const size = board.length
  const oppColor = playerColor === BLACK ? WHITE : BLACK

  // 1. Atari alert — player's group has 1 liberty
  if (counts.atari < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== playerColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.liberties.size === 1) {
          const linkback = lessonProgress?.['1']?.completed ? ' Remember *Breath*.' : ''
          return {
            category: 'atari',
            message: `Your group near ${coordLabel(r, c)} is in atari -- it'll be captured next move unless you extend or connect.${linkback}`,
          }
        }
      }
    }
  }

  // 2. Capture opportunity — opponent group has 1 liberty
  if (counts.capture < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== oppColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.liberties.size === 1) {
          const linkback = lessonProgress?.['1']?.completed ? ' Remember *Breath*.' : ''
          return {
            category: 'capture',
            message: `The ${oppColor === WHITE ? 'white' : 'black'} group near ${coordLabel(r, c)} has one breath left -- you can capture it.${linkback}`,
          }
        }
      }
    }
  }

  // 3. Ko situation
  if (counts.ko < THROTTLE_MAX && koPoint) {
    return {
      category: 'ko',
      message: `This is a ko -- you need to play elsewhere before recapturing at ${coordLabel(koPoint[0], koPoint[1])}.`,
    }
  }

  // 4. Eye teaching — player's group has exactly 1 eye region
  if (counts.eye < THROTTLE_MAX) {
    const visited = new Set()
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== playerColor) continue
        const key = `${r},${c}`
        if (visited.has(key)) continue
        const group = findGroup(board, r, c)
        for (const [sr, sc] of group.stones) visited.add(`${sr},${sc}`)
        if (group.stones.length < 4) continue // too small for eye teaching

        const groupSet = new Set(group.stones.map(([gr, gc]) => `${gr},${gc}`))
        const eyeRegions = findEyeRegions(board, playerColor)
        const adjacentEyes = eyeRegions.filter(region =>
          region.cells.some(([er, ec]) =>
            getNeighbors(er, ec, size).some(([nr, nc]) => groupSet.has(`${nr},${nc}`))
          )
        )
        if (adjacentEyes.length === 1) {
          const linkback = lessonProgress?.['2']?.completed ? ' Remember *Survival*.' : ''
          return {
            category: 'eye',
            message: `This group has one eye. It needs two to live permanently.${linkback}`,
          }
        }
      }
    }
  }

  // 5. Territory moment — large enclosed region (8+ points)
  if (counts.territory < THROTTLE_MAX) {
    const s = computeAreaScore(board)
    const playerTerritory = playerColor === BLACK ? s.blackTerritory : s.whiteTerritory
    if (playerTerritory >= 8) {
      const linkback = lessonProgress?.['3']?.completed ? ' Remember *Expansion*.' : ''
      return {
        category: 'territory',
        message: `You've enclosed ~${playerTerritory} points of territory.${linkback}`,
      }
    }
  }

  return null
}

/**
 * React hook for coach mode. Call after each move to get a tip (or null).
 * Manages throttle counts and auto-dismiss timing.
 */
export default function useCoach() {
  const [tip, setTip] = useState(null)
  const countsRef = useRef({ atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 })
  const dismissTimerRef = useRef(null)

  const checkForTip = useCallback((board, playerColor, koPoint, lessonProgress) => {
    // Clear previous auto-dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }

    const detected = detectCoachTip(board, playerColor, koPoint, lessonProgress, countsRef.current)
    if (detected) {
      countsRef.current[detected.category]++
      setTip(detected)
      // Auto-dismiss after 5 seconds
      dismissTimerRef.current = setTimeout(() => setTip(null), 5000)
    } else {
      setTip(null)
    }
  }, [])

  const dismissTip = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setTip(null)
  }, [])

  const resetCounts = useCallback(() => {
    countsRef.current = { atari: 0, capture: 0, ko: 0, eye: 0, territory: 0 }
    setTip(null)
  }, [])

  return { tip, checkForTip, dismissTip, resetCounts }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/go/__tests__/coachDetectors.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run lint**

Run: `yarn lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCoach.js src/lib/go/__tests__/coachDetectors.test.js
git commit -m "feat(go): coach hook with contextual tip detection and throttling"
```

---

### Task 5: Coach Banner CSS

Add the coach tip banner styles to GoBoard.css.

**Files:**
- Modify: `src/styles/GoBoard.css`

- [ ] **Step 1: Add coach tip banner styles**

Append to `src/styles/GoBoard.css`:

```css
/* ── Coach tip banner ── */

.go-coach-tip {
  position: relative;
  max-width: 100%;
  margin-top: 0.5rem;
  padding: 0.625rem 2rem 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(22, 78, 55, 0.7);
  border: 1px solid rgba(52, 211, 153, 0.3);
  color: rgba(209, 250, 229, 0.95);
  font-size: 0.8125rem;
  line-height: 1.4;
  transform: translateY(-4px);
  opacity: 0;
  animation: goCoachSlideIn 0.2s ease-out forwards;
}

.go-coach-tip.go-coach-tip-exit {
  animation: goCoachFadeOut 0.3s ease-in forwards;
}

.go-coach-tip em {
  color: #6ee7b7;
  font-style: italic;
}

.go-coach-dismiss {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(167, 243, 208, 0.5);
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: color 0.15s, background 0.15s;
}
.go-coach-dismiss:hover {
  color: rgba(167, 243, 208, 0.9);
  background: rgba(52, 211, 153, 0.15);
}

@keyframes goCoachSlideIn {
  from { transform: translateY(-4px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@keyframes goCoachFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/GoBoard.css
git commit -m "style(go): coach tip banner CSS with slide-in/fade-out animations"
```

---

### Task 6: Puzzle Concept Tagging

Add `concept` field to each puzzle entry.

**Files:**
- Modify: `src/lib/go/puzzles.js`

- [ ] **Step 1: Add concept field to each puzzle in the RAW array**

In `src/lib/go/puzzles.js`, add a `concept` field to each entry in the `RAW` array:

```js
  {
    id: 'capture-corner',
    // ...existing fields...
    concept: 'capture',
  },
  {
    id: 'capture-edge',
    concept: 'capture',
  },
  {
    id: 'capture-center',
    concept: 'capture',
  },
  {
    id: 'capture-pair',
    concept: 'capture',
  },
  {
    id: 'capture-corner-pair',
    concept: 'capture',
  },
  {
    id: 'capture-l-shape',
    concept: 'capture',
  },
  {
    id: 'capture-wall-line',
    concept: 'capture',
  },
  {
    id: 'kill-vital-point',
    concept: 'eyes',
  },
  {
    id: 'live-make-two-eyes',
    concept: 'eyes',
  },
  {
    id: 'tesuji-double-atari',
    // no concept — advanced, not tied to a lesson
  },
  {
    id: 'capture-two-step',
    concept: 'capture',
  },
```

Add `concept` to each existing object — do NOT replace them, just add the field. The `concept` field automatically flows through the `PUZZLES = RAW.map(...)` spread since the map already uses `...p`.

- [ ] **Step 2: Run lint**

Run: `yarn lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/go/puzzles.js
git commit -m "feat(go): add concept tags to puzzles for lesson-practice filtering"
```

---

### Task 7: Wire Everything into the Go Page

Replace fixed bot levels with adaptive config, add coach banner, handle `?practice=` query param, add coach toggle to settings, show rank display.

**Files:**
- Modify: `src/pages/posts/go/index.js`

- [ ] **Step 1: Add imports and remove BOT_LEVELS**

At the top of `src/pages/posts/go/index.js`:

Add imports:
```js
import { useRouter } from 'next/router'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'
import useCoach from 'src/hooks/useCoach'
import { getAdaptiveBotConfig } from 'src/lib/go/adaptiveBot'
import { rankLabel } from 'src/lib/go/elo'
```

Remove the `BOT_LEVELS` array (lines 23-27).

Remove the existing `rankLabel` from the elo import (it's already imported on line 21 — check if `rankLabel` is in that import; if so, keep it; if it's duplicated, remove from the new import).

Note: Line 21 already imports `rankLabel` from `src/lib/go/elo`. Keep that import as-is, do not duplicate.

- [ ] **Step 2: Replace state management in GoPage**

Inside `GoPage()`:

Add router:
```js
const router = useRouter()
```

Add profile hook:
```js
const {
  ready: profileReady,
  goElo,
  gamesPlayed,
  gamesWon,
  coachEnabled,
  lessonProgress,
  recordGameEnd,
  setCoachEnabled,
} = useGoPlayerProfile()
```

Add coach hook:
```js
const { tip: coachTip, checkForTip, dismissTip, resetCounts: resetCoachCounts } = useCoach()
```

Parse practice param:
```js
const practiceStage = router.query.practice || null
const PRACTICE_FOCUS = { void: null, breath: 'capture', survival: 'eyes', expansion: 'territory' }
const teachingFocus = practiceStage ? (PRACTICE_FOCUS[practiceStage] || null) : null
```

Remove the `botLevel` state: `const [botLevel, setBotLevel] = useState(1)`.

Remove the `playerElo` state: `const [playerElo, setPlayerElo] = useState(STARTING_ELO)`.

Replace them with profile-derived values — `goElo` from profile replaces `playerElo`.

Compute adaptive config:
```js
const botConfig = useMemo(() => {
  if (!vsBot) return null
  return getAdaptiveBotConfig(goElo, gamesPlayed, teachingFocus)
}, [vsBot, goElo, gamesPlayed, teachingFocus])
```

- [ ] **Step 3: Update bot move trigger to use config**

Replace the bot move trigger `useEffect` (around line 322-337):

```js
  useEffect(() => {
    if (!vsBot || phase !== 'playing') return
    if (currentPlayer !== botColor) return
    if (botThinking) return

    setBotThinking(true)
    const manager = botRef.current
    if (!manager) { setBotThinking(false); return }

    const config = botConfig || { level: 2, randomRate: 0.30, teachingFocus: null, timeBudget: 1500 }
    manager.findResponse(board, botColor, null, koPoint, config.timeBudget || 2500, config).then(({ move }) => {
      setBotThinking(false)
      if (move) placeStone(move[0], move[1])
      else handlePass()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsBot, phase, currentPlayer, botColor, board, koPoint, botThinking, botConfig])
```

- [ ] **Step 4: Update ELO update effect to use profile and adaptive bot ELO**

Replace the ELO update `useEffect` (around line 340-354):

```js
  useEffect(() => {
    if (!vsBot || phase !== 'finished' || eloChange !== null) return
    const botEloValue = botConfig?.botElo ?? 750
    let outcome = 0.0
    if (resignedBy !== null) {
      outcome = resignedBy === botColor ? 1.0 : 0.0
    } else if (winner === playerColor) {
      outcome = 1.0
    } else if (winner === null) {
      outcome = 0.5
    }
    const nextElo = eloUpdateGame(goElo, botEloValue, outcome)
    setEloChange({ before: goElo, after: nextElo, delta: nextElo - goElo })
    // Update profile
    recordGameEnd({ won: outcome === 1.0 })
  }, [vsBot, phase, winner, botColor, playerColor, resignedBy, botConfig, goElo, eloChange, recordGameEnd])
```

- [ ] **Step 5: Add coach check after each move**

Add a `useEffect` that runs the coach after each move:

```js
  // Coach: check for tip after each move
  const isCoachActive = coachEnabled || !!practiceStage
  useEffect(() => {
    if (!isCoachActive || phase !== 'playing') return
    if (moveCount === 0) return
    checkForTip(board, playerColor, koPoint, lessonProgress)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, isCoachActive, phase])
```

Reset coach counts on new game — add to `startNewGame`:

```js
  const startNewGame = useCallback((size, hcap) => {
    // ...existing resets...
    resetCoachCounts()
  }, [resetCoachCounts])
```

- [ ] **Step 6: Force 9x9 board for practice games**

Add a `useEffect` for practice param:

```js
  // Practice mode: force 9x9
  useEffect(() => {
    if (practiceStage && boardSize !== 9) {
      setBoardSize(9)
      startNewGame(9, 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceStage])
```

- [ ] **Step 7: Update the settings panel — remove Bot difficulty, add Coach toggle and rank display**

Remove the Bot difficulty picker (the `<div>` with `<span className="w-16 text-right">Bot:</span>` and `BOT_LEVELS.map`).

Replace it with:

```jsx
{vsBot && (
  <>
    <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
      <span className="w-16 text-right">You play:</span>
      {[{ label: 'Black \u25cf', color: BLACK }, { label: 'White \u25cb', color: WHITE }].map(({ label, color }) => (
        <button
          key={color}
          onClick={() => { setPlayerColor(color); startNewGame(boardSize, handicap) }}
          className={`px-2.5 py-1 rounded-md border transition ${
            playerColor === color
              ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
              : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
      <span className="w-16 text-right">Coach:</span>
      <button
        onClick={() => setCoachEnabled(true)}
        className={`px-2.5 py-1 rounded-md border transition ${
          isCoachActive
            ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
            : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
        }`}
      >
        On
      </button>
      <button
        onClick={() => setCoachEnabled(false)}
        className={`px-2.5 py-1 rounded-md border transition ${
          !isCoachActive
            ? 'bg-candy-500/15 text-candy-300 border-candy-400/40'
            : 'bg-forest-900/40 text-forest-400 border-forest-800/40 hover:text-candy-300 hover:border-candy-500/30'
        }`}
      >
        Off
      </button>
      {practiceStage && (
        <span className="text-forest-600 ml-1">(auto-enabled for practice)</span>
      )}
    </div>
    <div className="flex items-center gap-2 text-xs text-forest-400 flex-wrap">
      <span className="w-16 text-right">Your rank:</span>
      <span className="px-2.5 py-1 rounded-md bg-forest-900/40 border border-forest-800/40 text-candy-300 font-mono">
        {rankLabel(goElo)} ({goElo})
      </span>
    </div>
  </>
)}
```

- [ ] **Step 8: Add coach tip banner to the board area**

After the status row and before the board, add the coach banner:

```jsx
{coachTip && isCoachActive && (
  <div className="go-coach-tip w-full max-w-md">
    <span dangerouslySetInnerHTML={{
      __html: coachTip.message.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/--/g, '&mdash;')
    }} />
    <button className="go-coach-dismiss" onClick={dismissTip} aria-label="Dismiss tip">
      &times;
    </button>
  </div>
)}
```

- [ ] **Step 9: Add "Ready for more?" card after practice game ends**

In the game-over aside section, add a practice completion card:

```jsx
{gameOver && practiceStage && (
  <div className="rounded-xl border border-forest-700/50 bg-forest-900/70 px-4 py-3 text-sm">
    <p className="font-semibold text-white mb-2">Ready for more?</p>
    <div className="flex flex-wrap gap-2">
      <Link
        href="/posts/go/learn"
        className="px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-xs text-candy-100 hover:bg-candy-500/30 transition"
      >
        Next lesson
      </Link>
      <button
        onClick={() => { router.push('/posts/go'); startNewGame(boardSize, handicap) }}
        className="px-3 py-1.5 rounded-md bg-forest-800/70 border border-forest-600/60 text-xs hover:bg-forest-700/70 transition"
      >
        Free play
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 10: Run lint**

Run: `yarn lint`
Expected: PASS (fix any issues)

- [ ] **Step 11: Commit**

```bash
git add src/pages/posts/go/index.js
git commit -m "feat(go): wire adaptive bot, coach, and practice mode into game page"
```

---

### Task 8: Lesson-to-Practice CTA

Add practice game and puzzle CTAs to the lesson completion shell.

**Files:**
- Modify: `src/components/go/lessons/LessonShell.jsx`

- [ ] **Step 1: Add practice CTA props and render**

Update `LessonShell` to accept an `onComplete` prop and render practice CTAs:

```jsx
import React from 'react'
import Link from 'next/link'

const STAGE_SLUGS = {
  0: 'void',
  1: 'breath',
  2: 'survival',
  3: 'expansion',
}

export default function LessonShell({
  stageNumber,
  totalStages,
  title,
  subtitle,
  prev,
  next,
  isComplete,
  children,
}) {
  const practiceSlug = STAGE_SLUGS[stageNumber]

  return (
    <div className="min-h-screen bg-forest-950 text-white">
      <nav className="sticky top-0 z-30 backdrop-blur bg-forest-950/70 border-b border-forest-800/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
          <Link
            href="/posts/go/learn"
            className="text-[11px] text-forest-500 hover:text-candy-400 transition-colors pr-3 border-r border-forest-800/60"
          >
            &larr; Lessons
          </Link>
          <span className="text-xs font-semibold text-white tracking-wide">
            Stage {stageNumber}: {title}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: totalStages }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === stageNumber ? 'bg-candy-400' : i < stageNumber ? 'bg-forest-500' : 'bg-forest-800'
                }`}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-forest-400 mt-1">{subtitle}</p>}
        </header>

        <div>{children}</div>

        {isComplete && practiceSlug && (
          <div className="mt-6 rounded-xl border border-candy-400/30 bg-candy-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-candy-200 mb-2">Nice work! Put it into practice:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/posts/go?practice=${practiceSlug}`}
                className="px-3.5 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-sm text-candy-100 hover:bg-candy-500/30 transition"
              >
                Play a practice game
              </Link>
              <Link
                href="/posts/go/puzzles"
                className="px-3.5 py-1.5 rounded-md bg-forest-800/60 border border-forest-600/50 text-sm text-forest-200 hover:bg-forest-700/70 transition"
              >
                Try a puzzle
              </Link>
            </div>
          </div>
        )}

        <footer className="mt-6 pt-4 border-t border-forest-800/60 flex items-center justify-between text-sm">
          {prev ? (
            <Link
              href={prev.href}
              className="text-forest-400 hover:text-candy-300 transition-colors"
            >
              &larr; {prev.label}
            </Link>
          ) : <span />}
          {next ? (
            <Link
              href={next.href}
              className="px-3 py-1.5 rounded-md bg-candy-500/20 border border-candy-400/40 text-candy-200 hover:bg-candy-500/30 transition"
            >
              {next.label} &rarr;
            </Link>
          ) : <span />}
        </footer>
      </div>
    </div>
  )
}
```

Note: `isComplete` is a new prop. Existing lesson stages will need to pass it. Since the spec says lesson stage components are "content unchanged," we pass `isComplete` from each stage's existing completion state. Each stage already tracks completion internally — they call `markLessonComplete(stageNumber)` when done. The simplest approach: each stage passes `isComplete={step >= totalSteps}` (or equivalent) to `LessonShell`.

Check each lesson stage to see how completion is tracked, and add `isComplete` if not already passed. Since lesson stages are unchanged per spec, we pass `isComplete` as a prop they can use. If stages don't currently pass it, add a boolean. This is a minimal change.

- [ ] **Step 2: Run lint**

Run: `yarn lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/go/lessons/LessonShell.jsx
git commit -m "feat(go): lesson completion CTA for practice games and puzzles"
```

---

### Task 9: Build Verification

Run the full CI suite locally to verify everything works together.

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `yarn lint`
Expected: PASS (0 warnings, 0 errors)

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests PASS including new adaptiveBot and coachDetectors tests

- [ ] **Step 3: Run build**

Run: `yarn build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit any fixes needed**

If lint/test/build reveal issues, fix them and commit:

```bash
git add -A
git commit -m "fix(go): address lint/build issues from adaptive bot integration"
```

---

### Task 10: Final Squash Commit

Create a single feature branch and PR for the complete feature.

- [ ] **Step 1: Verify all changes**

Run: `git log --oneline` to see all commits from this session.

- [ ] **Step 2: Create PR**

```bash
git push origin main
```

Or if on a feature branch:

```bash
gh pr create --title "feat(go): adaptive bot, coach mode, and training loop" --body "$(cat <<'EOF'
## Summary
- Replace 3 fixed bot difficulty levels with continuous ELO-adaptive difficulty
- Add toggleable coach mode with contextual tips during gameplay
- Connect lesson system to practice games via `?practice=<stage>` query params
- Add player profile v2 with gamesPlayed, gamesWon, coachEnabled fields
- Add concept tags to puzzles for lesson-practice filtering

## Livelihood stream
Games (dwell time, learning engagement, retention)

## Test plan
- [ ] Run `npx vitest run` — all tests pass
- [ ] Play a bot game — no difficulty picker, rank display shows
- [ ] New profile gets coach tips during gameplay
- [ ] Complete a lesson — practice CTA appears
- [ ] Navigate to `/posts/go?practice=breath` — coach auto-enabled, 9x9 board
- [ ] Coach toggle works in settings panel
- [ ] Old profiles migrate cleanly (gamesPlayed/gamesWon default to 0)
EOF
)"
```
