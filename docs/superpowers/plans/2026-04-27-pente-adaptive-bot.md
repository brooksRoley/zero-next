# Pente Adaptive Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed 4-tier bot difficulty system with a single adaptive bot that continuously matches the player's ELO, including a gentle ramp-up for new players.

**Architecture:** A pure function `getAdaptiveBotConfig(playerElo, gamesPlayed)` interpolates engine parameters (searchDepth, timeBudgetMs, blunderRate) across the existing BOT_LEVELS anchor points. The game page drops the difficulty picker in bot modes and uses the adaptive config directly. ELO recording uses the bot's effective ELO.

**Tech Stack:** JavaScript (no new dependencies)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/pente/adaptiveBot.js` | Create | Pure function: ELO → engine config interpolation |
| `src/pages/posts/pente.js` | Modify | Replace difficulty picker with adaptive config, update bot move effect and ELO recording |
| `src/components/PentePlayerbot.js` | No change | `BOT_LEVELS` stays as anchor data; `PenteBot` class untouched |

---

### Task 1: Create `adaptiveBot.js` — the interpolation function

**Files:**
- Create: `src/lib/pente/adaptiveBot.js`

- [ ] **Step 1: Create the adaptive bot config module**

```javascript
// src/lib/pente/adaptiveBot.js

/**
 * Adaptive bot configuration.
 * Interpolates engine params across BOT_LEVELS anchor points
 * so the bot plays at any ELO, not just 4 fixed tiers.
 */

// Anchor points — sorted by ELO ascending
const ANCHORS = [
  { elo: 600,  searchDepth: 1, timeBudgetMs: 200,  blunderRate: 0.15 },
  { elo: 1000, searchDepth: 2, timeBudgetMs: 800,  blunderRate: 0.05 },
  { elo: 1400, searchDepth: 3, timeBudgetMs: 2000, blunderRate: 0.01 },
  { elo: 1800, searchDepth: 4, timeBudgetMs: 4000, blunderRate: 0.00 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolateConfig(elo) {
  // Clamp to anchor range
  if (elo <= ANCHORS[0].elo) return { ...ANCHORS[0] }
  if (elo >= ANCHORS[ANCHORS.length - 1].elo) return { ...ANCHORS[ANCHORS.length - 1] }

  // Find the two anchors to interpolate between
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const lo = ANCHORS[i]
    const hi = ANCHORS[i + 1]
    if (elo >= lo.elo && elo <= hi.elo) {
      const t = (elo - lo.elo) / (hi.elo - lo.elo)
      return {
        elo,
        searchDepth: Math.round(lerp(lo.searchDepth, hi.searchDepth, t)),
        timeBudgetMs: Math.round(lerp(lo.timeBudgetMs, hi.timeBudgetMs, t)),
        blunderRate: Math.max(0, lerp(lo.blunderRate, hi.blunderRate, t)),
      }
    }
  }

  // Fallback (shouldn't reach here)
  return { ...ANCHORS[1] }
}

/**
 * Get bot engine config calibrated to a player's ELO.
 *
 * @param {number} playerElo - Player's current ELO rating
 * @param {number} gamesPlayed - Total bot games the player has completed
 * @returns {{ searchDepth: number, timeBudgetMs: number, blunderRate: number, effectiveElo: number }}
 */
export function getAdaptiveBotConfig(playerElo, gamesPlayed) {
  // New player ramp-up: first 5 games, bot plays below stated ELO
  // Game 0 → -200 ELO, game 5+ → 0 offset
  const rampFactor = Math.min(gamesPlayed, 5) / 5
  const eloOffset = 200 * (1 - rampFactor)
  const effectiveElo = Math.max(400, playerElo - eloOffset)

  const config = interpolateConfig(effectiveElo)

  return {
    searchDepth: config.searchDepth,
    timeBudgetMs: config.timeBudgetMs,
    blunderRate: config.blunderRate,
    effectiveElo: Math.round(effectiveElo),
  }
}
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "const m = require('./src/lib/pente/adaptiveBot.js'); console.log(m.getAdaptiveBotConfig(800, 0)); console.log(m.getAdaptiveBotConfig(800, 5)); console.log(m.getAdaptiveBotConfig(1200, 10)); console.log(m.getAdaptiveBotConfig(1800, 20));"`

This will fail because of ES module syntax. Instead, verify by starting the dev server later. For now, visually confirm the logic:
- `(800, 0)` → effectiveElo 600, depth 1, blunder 0.15 (easy start)
- `(800, 5)` → effectiveElo 800, depth ~2, blunder ~0.10 (full strength at 800)
- `(1200, 10)` → effectiveElo 1200, depth ~3, blunder ~0.03
- `(1800, 20)` → effectiveElo 1800, depth 4, blunder 0.00

- [ ] **Step 3: Commit**

```bash
git add src/lib/pente/adaptiveBot.js
git commit -m "feat(pente): add adaptive bot config interpolation"
```

---

### Task 2: Wire adaptive bot into the game page — bot move effect

**Files:**
- Modify: `src/pages/posts/pente.js` (lines 268-295 — bot move useEffect)

- [ ] **Step 1: Add adaptive bot import**

At the top of `pente.js` (line 14, after the `BotWorkerManager` import), add:

```javascript
import { getAdaptiveBotConfig } from 'src/lib/pente/adaptiveBot';
```

- [ ] **Step 2: Add state for the bot's effective ELO display**

After line 109 (`const [lastBotStats, setLastBotStats] = useState(null);`), add:

```javascript
const [botEffectiveElo, setBotEffectiveElo] = useState(null);
```

- [ ] **Step 3: Replace the bot move effect to use adaptive config**

Replace lines 268-282 (the engine config and findMove call inside the bot move useEffect) from:

```javascript
      const levelConfig = BOT_LEVELS[botDifficulty] || BOT_LEVELS.intermediate;
      const engineConfig = {
        searchDepth: levelConfig.searchDepth,
        timeBudgetMs: levelConfig.timeBudgetMs,
        blunderRate: levelConfig.blunderRate,
      };

      const move = await workerRef.current.findMove(
        localBoard.map(r => [...r]),
        localCurrentPlayer,
        { ...captures },
        engineConfig,
        gameMode,
        levelConfig.timeBudgetMs + 2000, // hard timeout = budget + 2s grace
      );
```

To:

```javascript
      const adaptiveConfig = getAdaptiveBotConfig(playerElo, gamesPlayed);
      setBotEffectiveElo(adaptiveConfig.effectiveElo);
      const engineConfig = {
        searchDepth: adaptiveConfig.searchDepth,
        timeBudgetMs: adaptiveConfig.timeBudgetMs,
        blunderRate: adaptiveConfig.blunderRate,
      };

      const move = await workerRef.current.findMove(
        localBoard.map(r => [...r]),
        localCurrentPlayer,
        { ...captures },
        engineConfig,
        gameMode,
        adaptiveConfig.timeBudgetMs + 2000, // hard timeout = budget + 2s grace
      );
```

- [ ] **Step 4: Update the useEffect dependency array**

On line 295, replace `botDifficulty` in the dependency array with `playerElo, gamesPlayed`:

From:
```javascript
  }, [localCurrentPlayer, botEnabled, isOnline, gameOver, botInstances, localBoard, captures, botDifficulty, gameMode]);
```

To:
```javascript
  }, [localCurrentPlayer, botEnabled, isOnline, gameOver, botInstances, localBoard, captures, playerElo, gamesPlayed, gameMode]);
```

Note: `gamesPlayed` needs to be destructured from `usePlayerProfile()`. Update line 81 from:

```javascript
  const { playerId, playerName, setPlayerName, elo: playerElo, peakElo, eloHistory, markSolved, recordAttempt, recordGameResult } = usePlayerProfile();
```

To:

```javascript
  const { playerId, playerName, setPlayerName, elo: playerElo, peakElo, eloHistory, gamesPlayed, markSolved, recordAttempt, recordGameResult } = usePlayerProfile();
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): wire adaptive bot config into bot move effect"
```

---

### Task 3: Update ELO recording to use effective bot ELO

**Files:**
- Modify: `src/pages/posts/pente.js` (lines 426-429 — win handler ELO recording)

- [ ] **Step 1: Replace fixed bot ELO with adaptive effective ELO**

In the `handleWin` function, replace lines 426-429:

```javascript
      const botElo = BOT_LEVELS[botDifficulty]?.elo || 1000;
      recordGameResult(botElo, humanWon);
```

With:

```javascript
      const botElo = botEffectiveElo || playerElo;
      recordGameResult(botElo, humanWon);
```

This uses the `botEffectiveElo` state set during the last bot move. If somehow null (shouldn't happen in practice), falls back to playerElo (which gives 0 ELO change — safe default).

- [ ] **Step 2: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): record ELO using adaptive bot's effective rating"
```

---

### Task 4: Replace difficulty picker UI with adaptive bot display

**Files:**
- Modify: `src/pages/posts/pente.js` (lines 644-663 — difficulty picker section)

- [ ] **Step 1: Replace the difficulty picker block**

Replace lines 644-664 (the entire difficulty picker section):

```javascript
        {/* Difficulty picker (bot modes only) */}
        {botEnabled && !gameOver && (
          <div className="flex items-center gap-2 px-3 pb-1.5">
            <span className="text-[10px] text-forest-500 uppercase tracking-wider">Difficulty</span>
            <div className="flex gap-1">
              {Object.entries(BOT_LEVELS).map(([key, config]) => (
                <button
                  key={key}
                  className={diffBtn(botDifficulty === key)}
                  onClick={() => changeDifficulty(key)}
                  title={`Bot ELO ~${config.elo}`}
                >
                  {config.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-forest-600 ml-1">
              (~{BOT_LEVELS[botDifficulty]?.elo} ELO)
            </span>
          </div>
        )}
```

With:

```javascript
        {/* Adaptive bot ELO display (bot modes only) */}
        {botEnabled && !gameOver && (
          <div className="flex items-center gap-2 px-3 pb-1.5">
            <span className="text-[10px] text-forest-500 uppercase tracking-wider">Adaptive Bot</span>
            <span className="text-[10px] text-forest-400 font-mono">
              ~{botEffectiveElo ?? getAdaptiveBotConfig(playerElo, gamesPlayed).effectiveElo} ELO
            </span>
            {gamesPlayed < 5 && (
              <span className="text-[10px] text-candy-pink/60 italic">
                calibrating ({5 - gamesPlayed} games left)
              </span>
            )}
          </div>
        )}
```

- [ ] **Step 2: Simplify the switchPreset function**

In `switchPreset` (lines 500-505), the bot instances are created with `botDifficulty`. Since we no longer use difficulty tiers, simplify:

Replace:

```javascript
    const diff = botDifficulty;
    const turnOrder = newMode ? newMode.turnOrder : [BLACK, WHITE];
    const bots = turnOrder
      .filter(c => c !== humanColor)
      .map(c => new PenteBot(c, diff, newMode));
    setBotInstances(bots);
```

With:

```javascript
    const turnOrder = newMode ? newMode.turnOrder : [BLACK, WHITE];
    const bots = turnOrder
      .filter(c => c !== humanColor)
      .map(c => new PenteBot(c, 'expert', newMode));
    setBotInstances(bots);
```

Note: `PenteBot` instances are only used as fallback heuristic bots (not the main engine). Setting them to 'expert' is fine — the actual engine difficulty comes from `getAdaptiveBotConfig` via the worker.

- [ ] **Step 3: Remove the `changeDifficulty` function**

Delete lines 512-521 (the `changeDifficulty` function):

```javascript
  // Update bot difficulty
  const changeDifficulty = (diff) => {
    setBotDifficulty(diff);
    // Recreate bots with new difficulty
    const turnOrder = gameMode ? gameMode.turnOrder : [BLACK, WHITE];
    const bots = turnOrder
      .filter(c => c !== humanColor)
      .map(c => new PenteBot(c, diff, gameMode));
    setBotInstances(bots);
    resetLocalBoard();
  };
```

- [ ] **Step 4: Clean up unused state and imports**

Remove the `botDifficulty` state (line 106):
```javascript
  const [botDifficulty, setBotDifficulty] = useState('intermediate');
```

Remove the `BOT_LEVELS` import from line 13. Change:
```javascript
import { PenteBot, BOT_LEVELS } from 'src/components/PentePlayerbot';
```
To:
```javascript
import { PenteBot } from 'src/components/PentePlayerbot';
```

Also remove `diffBtn` if it was only used by the difficulty picker. Search for `diffBtn` — if it's only used in the deleted picker, remove its definition too.

- [ ] **Step 5: Verify the dev server builds**

Run: `yarn dev`

Check that the Pente page loads, bot mode starts without the difficulty picker, and the "Adaptive Bot ~XXX ELO" label appears.

- [ ] **Step 6: Commit**

```bash
git add src/pages/posts/pente.js
git commit -m "feat(pente): replace difficulty picker with adaptive bot display"
```

---

### Task 5: Verify end-to-end adaptive bot flow

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `yarn dev`

- [ ] **Step 2: Test new player experience**

1. Clear localStorage (`localStorage.removeItem('pente_puzzle_progress')` in browser console)
2. Go to `/posts/pente`
3. Select "vs Bot" mode
4. Confirm "Adaptive Bot" label shows `~600 ELO` (new player ramp: 800 - 200 = 600)
5. Confirm "calibrating (5 games left)" message appears
6. Play a game — bot should be easy (depth 1, high blunder rate)

- [ ] **Step 3: Test experienced player**

1. In browser console: set `localStorage.setItem('pente_puzzle_progress', JSON.stringify({elo: 1400, gamesPlayed: 20, solved: [], attempted: {}}))`
2. Refresh page, select "vs Bot"
3. Confirm bot shows `~1400 ELO`
4. Confirm no "calibrating" message
5. Bot should be noticeably stronger (depth 3, low blunder rate)

- [ ] **Step 4: Test game result records ELO correctly**

1. Complete a game against the bot
2. Check that ELO history in localStorage shows a `game_win` or `game_loss` event
3. Confirm the delta is reasonable (based on the effective bot ELO, not a fixed tier)

- [ ] **Step 5: Run lint**

Run: `yarn lint`

Fix any issues.

- [ ] **Step 6: Final commit (if lint fixes needed)**

```bash
git add -A
git commit -m "fix(pente): lint cleanup for adaptive bot"
```
