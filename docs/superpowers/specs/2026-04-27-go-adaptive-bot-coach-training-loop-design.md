# Go: Adaptive Bot + Coach + Training Loop

**Date:** 2026-04-27
**Status:** Approved
**Livelihood stream:** Games (dwell time, learning engagement, retention)

---

## Overview

Replace the Go game's 3 fixed bot difficulty levels with a continuous ELO-adaptive bot (mirroring the Pente adaptive bot pattern), add a toggleable coach mode that provides contextual tips during gameplay, and connect the lesson system to practice games so learning flows naturally into play.

Three integrated systems, one unified player profile.

---

## 1. Adaptive Bot Engine

### File: `src/lib/go/adaptiveBot.js`

`getAdaptiveBotConfig(playerElo, gamesPlayed, teachingFocus)` returns a config object consumed by the worker.

### ELO-to-Engine Mapping

| Player ELO | Engine | Random % | Bot ELO (approx) |
|---|---|---|---|
| < 600 | Greedy level 1 | 75% | ~400 |
| 600-900 | Greedy interpolate 1→2 | 75→30% | 400-750 |
| 900-1200 | Greedy interpolate 2→3 | 30→5% | 750-1150 |
| 1200-1500 | Minimax level 4, depth 1 | 0% | ~1350 |
| 1500+ | Minimax level 5, depth by board size (3/2/1 for 9/13/19) | 0% | ~1600 |

### New-Player Ramp

For `gamesPlayed < 5`, bot ELO receives a -200 handicap so early games feel winnable. Identical to the Pente adaptive bot pattern.

### Teaching Focus

When `teachingFocus` is set, the worker biases `scoreBotMove` weight multipliers:

- `'capture'` — bot plays into capturable positions more often (reduces group-rescue priority weight)
- `'eyes'` — bot builds weak single-eye groups instead of always securing two eyes (reduces eye-building weight)
- `'territory'` — bot plays expansively, leaving invasion opportunities (reduces defensive weight)

These are multiplier adjustments on existing scoring terms, not new evaluation logic.

### UI Change

The difficulty picker (Beginner / Casual / Sharp buttons) is removed entirely. Replaced with a read-only rank display (e.g. "18 kyu (1000)"). Bot auto-matches to the player's ELO.

### Tests: `src/lib/go/__tests__/adaptiveBot.test.js`

- Config output at ELO boundaries (0, 600, 900, 1200, 1500, 2000)
- New-player ramp applies for gamesPlayed 0-4, not for 5+
- Teaching focus passes through to config
- No teaching focus returns null/undefined for that field
- Interpolation is continuous (no jumps at boundaries)

---

## 2. Coach Mode

### File: `src/hooks/useCoach.js`

A hook that watches board state after each move and emits at most one contextual tip per turn.

### Activation

- Toggle in settings panel: "Coach" On / Off
- Default ON for players with `gamesPlayed < 5`
- Default OFF after that, always manually toggleable
- Persisted in player profile (`coachEnabled: bool`)

### Detection Priority

After each move (player or bot), scan in priority order — first match wins:

1. **Atari alert** — player's group dropped to 1 liberty
   - "Your group at E5 is in atari -- it'll be captured next move unless you extend or connect."
2. **Capture opportunity** — opponent group has 1 liberty, player can take it
   - "The white group near G3 has one breath left -- you can capture it."
3. **Ko situation** — ko point just appeared
   - "This is a ko -- you need to play elsewhere before recapturing here."
4. **Eye teaching** — player's group has exactly 1 eye
   - "This group has one eye. It needs two to live permanently."
5. **Territory moment** — large enclosed region (8+ points) formed
   - "You've enclosed ~8 points of territory in the corner."

### Tip Format

- Small dismissible banner below the status row
- Slide-in animation, auto-dismisses after 5 seconds or on next move
- Never modal, never blocks play

### Lesson Linkback

Tips reference completed lesson stage names:
- "Remember *Breath* -- this group has 1 liberty."
- If the relevant lesson hasn't been completed, the tip states the fact without the reference.

### Throttle

Each tip category fires at most 3 times per game. After 3 atari alerts in one game, no more atari alerts that game. Resets on new game.

### Board State Scanning

Uses existing functions from the game engine:
- `findGroup()` from `gameLogic.js` for liberty counts
- `isAtari()` from `highlights.js` for atari detection
- `findEyeRegions()` from `lifeAndDeath.js` for eye counting
- `computeAreaScore()` from `scoring.js` for territory estimation
- Ko point from game state (already tracked)

No new game logic needed.

---

## 3. Lesson-to-Practice Flow

### Lesson Completion CTA

**Modified file:** `src/components/go/lessons/LessonShell.jsx`

After completing a lesson stage, a CTA card appears at the bottom:

- **"Play a practice game"** — navigates to `/posts/go?practice=breath` (or `survival`, `expansion`)
- **"Try a puzzle"** — navigates to `/posts/go/puzzles` filtered to puzzles with matching `concept`

### Practice Game Behavior

When `/posts/go` loads with `?practice=<stage>` query param:

- Coach mode auto-enabled (regardless of player setting)
- `teachingFocus` set per stage:
  - `void` → no focus
  - `breath` → `'capture'`
  - `survival` → `'eyes'`
  - `expansion` → `'territory'`
- Board size forced to 9x9 (faster feedback loop)
- After game ends, a card: "Ready for more?" with links to next lesson or free play

The practice game is a real game — full rules, ELO updates. Only differences are bot tuning and coach being on. Player never feels stuck in tutorial mode.

### Puzzle Concept Tagging

**Modified file:** `src/lib/go/puzzles.js`

Each puzzle gets a `concept` field:
- `capture-*` puzzles → `'capture'`
- `life` / `death` puzzles → `'eyes'`
- `tesuji` → no concept tag (advanced, not tied to a lesson)

### Intermittent Reinforcement

During free play (no `?practice=` param), the coach (when enabled) still links tips back to completed lessons. The "intermittent" reinforcement emerges naturally from the coach's lesson-linkback behavior. No special game mode needed.

---

## 4. Player Profile Changes

### Modified file: `src/hooks/useGoPlayerProfile.js`

New fields added to profile shape:

```js
{
  // ...existing fields (goElo, peakElo, solved, attempts, lessonProgress)...
  gamesPlayed: 0,      // incremented on each game end
  gamesWon: 0,         // win tracking
  coachEnabled: true,   // default true, switches to false after gamesPlayed >= 5
}
```

Profile version migrates from v1 to v2. Migration adds default values for new fields.

---

## 5. Worker Protocol Update

### Modified file: `public/goWorker.js`

Current: `findBotMove(board, color, level, koPoint)`

New: `findBotMove(board, color, config, koPoint)` where config is:

```js
{
  level: 3,              // 1-5, computed by adaptiveBot
  randomRate: 0.05,      // 0-1, computed by adaptiveBot
  teachingFocus: 'capture', // null | 'capture' | 'eyes' | 'territory'
  timeBudget: 2500       // ms
}
```

Backward compatible: if `config` is a bare number, treat as old `level` param.

Teaching focus applies as weight multipliers in `scoreBotMove`:
- `'capture'`: group-rescue weight * 0.3 (bot "forgets" to save its groups)
- `'eyes'`: eye-building weight * 0.2 (bot builds weak shapes)
- `'territory'`: defensive weight * 0.4 (bot overextends)

### Modified file: `src/lib/go/botWorker.js`

`GoBotWorkerManager.findResponse()` passes the full config object instead of a bare level number.

---

## 6. Settings Panel Changes

### Modified file: `src/pages/posts/go/index.js`

**Removed rows (bot mode):**
- Bot difficulty (Beginner / Casual / Sharp)

**New/changed rows (bot mode):**
- **Mode:** `2 Player` | `vs Bot` (unchanged)
- **You play:** `Black` | `White` (unchanged)
- **Coach:** `On` | `Off` (new)
- **Your rank:** `18 kyu (1000)` (read-only, replaces difficulty picker)

Net: one fewer row, cleaner layout.

---

## 7. CSS Additions

### Modified file: `src/styles/GoBoard.css`

Coach tip banner:
- Positioned below status row
- Slide-in from top (transform + opacity transition, 200ms)
- Background: semi-transparent forest with border
- Auto-dismiss: opacity fade after 5s
- Dismiss button (small x)
- Max-width constrained to board width

---

## 8. File Change Summary

### New files
- `src/lib/go/adaptiveBot.js`
- `src/lib/go/__tests__/adaptiveBot.test.js`
- `src/hooks/useCoach.js`

### Modified files
- `public/goWorker.js` — config object, teaching focus weight biases
- `src/pages/posts/go/index.js` — remove difficulty picker, wire adaptive config, coach banner, `?practice=` handling
- `src/hooks/useGoPlayerProfile.js` — v2 migration, new fields
- `src/lib/go/botWorker.js` — pass config object
- `src/lib/go/puzzles.js` — add `concept` field per puzzle
- `src/components/go/lessons/LessonShell.jsx` — practice CTA on completion
- `src/styles/GoBoard.css` — coach tip banner styles

### Not touched
- Game logic, scoring, SGF parser, highlights, life-and-death (no rule changes)
- Lesson stage components (StageBreath, StageSurvival, etc.) — content unchanged
- PuzzleBoard, PuzzleCatalog — unchanged except puzzle data gets concept tags
