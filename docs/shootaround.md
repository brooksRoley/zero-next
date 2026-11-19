# Shootaround — design note

A daily quest at `/games/shootaround`: five stations, about ten minutes, the same
boards for everyone on a given day. Four stations borrow a real rule from a game on
this site and teach the computer-science or math idea underneath it. The fifth is a
real round of Hardwood, the site's core game, where all four ideas show up at once.

| # | Station | Track | Rule borrowed from | Idea taught | Checked by |
|---|---|---|---|---|---|
| 1 | Star-up | Data structures | Hardwood: three copies make a ★★ | Hash map: count in one pass, O(1) lookups | `countCopies` |
| 2 | Cap space | Algorithms | Hardwood: the 10G opening cap | 0/1 knapsack by dynamic programming; greedy isn't optimal | `knapsack` (tested against brute force) |
| 3 | Cut the lanes | Graph theory | Pass & Cut boards | Minimum cut, Menger's theorem | Pass & Cut's own `minimalCut` / `connected` |
| 4 | Read the defense | Linear algebra | Read & React payoff matrices | Matrix × vector: expected value of each play | `multiply` |
| 5 | Hardwood round | The game | Hardwood itself | Use all four in a fight | Hardwood's `tactics_mastery` save |

## Files

| File | Role |
|---|---|
| `src/lib/games/shootaround/puzzles.ts` | Seeded generators and checkers for stations 1–4; the station list |
| `src/lib/games/shootaround/progress.ts` | Local save, streak, and Hardwood fight detection |
| `src/components/games/shootaround/Stations.tsx` | The four puzzle stations (ask, check, teach) |
| `src/components/games/shootaround/HardwoodStation.tsx` | The Hardwood station: link out, watch for a fight |
| `src/pages/games/shootaround.tsx` | Day, roster load, stepper, events, summary |

## Decisions and tradeoffs

- **Borrow rules, don't embed games.** Pass & Cut and Read & React unlock levels in
  order and don't take a level from the URL, so linking into a specific board would
  mean changing three pages. The quest imports their level data and their solvers
  instead, so the puzzle a player sees is the same board, judged by the same code.
  Cost: the quest teaches the *idea*, not the full turn-by-turn game; each station
  links to the full game.
- **Hardwood is played for real, not simulated.** Hardwood is a WebAssembly app built
  from another repo, and re-implementing its fight in TypeScript would drift from the
  real thing. Instead the station notes Hardwood's own fight count
  (`tactics_mastery`, which Hardwood bumps for the chosen offense and coverage when a
  fight starts) and finishes when it goes up. Same origin, so a `storage` event
  arrives the moment Hardwood writes in another tab. Cost: it depends on a key inside
  a vendored build; `hardwoodFights` reads it defensively, and a "mark it done" link
  covers another browser.
- **Seeded by day, not random.** `seedFor(day, station)` → the same boards for
  everyone, so a day can be discussed, replayed in a test, and reproduced from a bug
  report. 60 consecutive days are checked in tests.
- **Every board must actually teach.** Generators reject boards where the lesson
  would be hollow: a cap-space board where everyone fits, a min-cut of 1, a matchup
  where one play wins every column (then the scouting report doesn't matter). Cap
  space prefers boards where signing the best-rated players first falls short; tests
  require that on at least 80% of days.
- **"Show me" finishes the station, honestly labelled.** A stuck player sees the
  answer and the lesson rather than quitting; the save records `solved` or `shown`,
  and the summary says which. A later solve never downgrades.
- **Streak forgives today until midnight**, so opening the page in the morning never
  shows a broken streak. No reminders, no guilt copy.
- **Local only.** Progress lives in `zero_shootaround_v1`; nothing new is stored on
  the server. Events go through the shared `trackGame()` (`game_start` on the first
  attempt of a day, `puzzle_solved` / `puzzle_failed` per check, `game_end` when all
  five are done, with how many were shown).

## Measuring it

Player metric to watch: **return within 7 days** for `game: shootaround`, and the
share of `game_end` events with `shown: 0`. Before this change the value is
undefined (the quest is new); the first weekly scorecard sets the baseline. A
5-minute playtest by Brooks should judge: is each station's question clear on the
first read, is the lesson worth reading after a solve, and does the hand-off to
Hardwood feel like a reward or a chore.

## Next steps (not built)

- A second variant per track so the week doesn't repeat shapes (e.g. a queue/stack
  station from Hardwood's shop rolls; BFS on the 5×5 court; dot-product scheme fit).
- Missed stations into the spaced review lanes (`src/lib/review.ts`).
- A welcome-back line from the narrator when today's Shootaround is unfinished.
