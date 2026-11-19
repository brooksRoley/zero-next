# Player roles from real data — design note

Status: draft for review (2026-11-05). Owner: Brooks. No code yet.

## The problem

Every figure in Shootaround and Hardwood shows a role (Sharpshooter, Slasher,
Anchor, Two-Way). The role picks the figure's colour, gear and emblem, and
decides which special move fires in a fight. Today the role is read from the
three engine stats on each card (`shooting`, `speed`, `defense`): the top stat
wins if it leads the next by 6 or more, otherwise the player is a Two-Way
(`src/lib/players/archetype.ts`, `client/game/archetype.js`).

Those three numbers were never meant to describe a player's style:

- **They are balance knobs.** Hardwood's 29-player roster
  (`public/hardwood/engine_roster.json`) was hand-tuned for game balance
  (BballTactics `f1bab4e`, "balance drafts + real-stat roster additions").
- **The roles that come out are wrong in ways a fan sees at once.** Measured on
  that roster: 9 Sharpshooters, 9 Anchors, 9 Two-Ways and **2 Slashers**.
  Nikola Jokić reads as a Sharpshooter, and there is no role at all for a
  player whose game is passing.
- **"Speed" isn't a player's speed in the export pipeline either.** In
  `src/lib/nba/sim/stat-mapper.ts` (lines 73–75), speed is the *team's* pace
  minus an age penalty. Height falls back to a per-position default
  (`src/lib/nba/sim/roster-builder.ts:41`).

So the art is drawing confident pictures of a weak signal. Better art won't fix
that; a better role will.

## Goal and non-goals

**Goal.** Assign each player a role that describes how they actually score and
defend, from public game data, with a confidence and a runner-up role, and show
it on the figure and in the special moves.

**Non-goals.**
- **No change to engine stats or game balance.** The role is presentation plus
  the special-move triggers. Hardwood's sim keeps reading
  `shooting/speed/defense` exactly as now.
- **No player photos or likenesses** (see the art rule in `CLAUDE.md`).
  Names and stats are facts; faces are not ours to use.
- **The figures' look and motion are out of scope** here; that's the next note.

## What data we can actually reach

stats.nba.com — the source with play types, tracking and shot charts — has not
answered from Vercel or from home IPs since 2026-07 (`src/lib/bball/espn.ts`,
`src/pages/api/nba/admin/ingest.ts`). The design can't depend on it.

| Source | Gives us | Status |
|---|---|---|
| ESPN `byathlete` season stats | per-game makes/attempts (FG, 3P, FT), REB, AST, STL, BLK, TO, minutes, age | **In use** (`fetchSeasonStats`) |
| ESPN team rosters | team, position, injury | **In use** (`fetchTeamRosters`). The athlete JSON also carries height and weight, which we don't parse yet: **to verify** |
| ESPN game summary play-by-play | each shot's court x/y, its description ("Driving Layup", "Pullup Jump Shot", "Cutting Dunk", "Alley Oop"…), shooter, assister | **To verify**: not used in this repo yet |
| cdn.nba.com liveData play-by-play | similar fields, with shot area and distance | **To verify**: referenced in `api/nba/analytics/team/[id].ts`; probing it from this session was blocked |
| stats.nba.com | play types, tracking, shot charts | **Dead** since 2026-07 |

Step one of the build is a short script that hits each "to verify" source once
and records what came back. Brooks runs it, or approves it running, since it
calls outside services.

All of these are unofficial, unauthenticated feeds that can change without
notice. So we snapshot what we fetch into Neon, the way the existing ingest
does, and the game never calls them live.

## Features

Per player, per season, over a minimum of 300 minutes. The box score gives the
**base set**; play-by-play gives the **shot set** if it verifies.

| Feature | From | What it separates |
|---|---|---|
| 3PA share of FGA | box | shooters from everyone else |
| FTA per FGA | box | players who get to the line (drivers, bigs) |
| AST per 36 | box | playmakers |
| STL per 36, BLK per 36 | box | perimeter vs rim defenders |
| REB per 36 | box | bigs |
| Height, weight | roster bio | bigs vs wings vs guards, and figure size |
| Rim share: FGA within 4 ft | shots | finishers and bigs |
| Drive share: descriptions with "Driving" | shots | slashers, the role we under-detect today |
| Unassisted share of made 3s | shots | shot-creators vs catch-and-shoot |
| Cut / alley-oop / putback share | shots | rim runners vs drivers |

Every feature is a rate, not a total, so starters and bench players compare
fairly. Each is turned into a z-score against the season's league pool.

## Roles

Keep the four roles and add one, because the clearest miss today has nowhere
to go:

| Role | Move | Signature in the data |
|---|---|---|
| Sharpshooter | Splash | high 3PA share, high catch-and-shoot share |
| Slasher | Blur | high drive share, high FTA/FGA, rim share without the size of a big |
| Anchor | The Wall | high BLK and REB, height, rim share from putbacks and cuts |
| **Playmaker** (new) | **Thread**: a pass that bends through the defense | high AST, high unassisted share |
| Two-Way | Glue | no single signature; good on both ends (STL plus a balanced profile) |

Adding Playmaker means a fifth colour, emblem and move in both repos. If we
would rather not, Jokić-type players fall into Two-Way. (Question 1 below.)

## How to assign a role: three options

**A. Hand-written thresholds** ("3PA share > 0.45 → Sharpshooter").
Easy to read, but brittle: each cutoff is a guess, rules collide, and a league
that shoots more threes every year breaks them.

**B. Clustering** (k-means or a Gaussian mixture on the features, then name
the clusters).
Finds structure we didn't assume, but cluster names drift between seasons and
runs, and a cluster may not match a role a fan would recognise. Hard to explain
on a card.

**C. Nearest prototype (recommended).**
Each role is a prototype vector in feature space, written down from basketball
knowledge and then tuned against labels. A player's role is the nearest
prototype. A softmax over distances gives a confidence and a runner-up
("Slasher 71%, Two-Way 18%").
- *For:* explainable ("closest to Slasher because drive share +1.8σ"), stable
  across seasons, every number is reviewable in one file, and confidence lets
  the art show hybrids honestly.
- *Against:* the prototypes encode our assumptions. The evaluation below is
  what keeps them honest.

The current three-stat rule stays as the **baseline** every option has to beat.

## How we'll know it's better

1. **Labels.** Brooks labels a primary role for about 100 players: the 29 in
   Hardwood plus the top 70 by minutes. This is a basketball judgment, so it's
   Brooks's call, the same way grading queries is for Search Lab. Labels live
   in `src/lib/players/role-labels.json`, with a free-text "why" on any player
   who was hard to call.
2. **Metric.** Agreement with the labels (accuracy and Cohen's κ), with 95%
   bootstrap confidence intervals, for the baseline and for the model. Reported
   per role too, so a model that wins overall by ignoring Slashers is caught.
3. **Ship rule.** The model ships if its κ interval sits clearly above the
   baseline's and no role's recall falls below 0.6. With about 100 labels the
   intervals will be wide; that is a reason to label more, not to relax the rule.
4. **Stability.** For players with two seasons of data, report how often the
   role stays the same. Big swings mean the features are noisy, not that the
   player changed.

The prototypes are tuned on half the labels and scored on the other half, so
we don't grade our own homework.

## Where it lives

- **Ingest** (zero-next): extend the ESPN client with bio fields and, if
  verified, a play-by-play shot pass that stores per-shot rows in Neon. A
  nightly job aggregates per-player features.
- **Model**: `src/lib/players/roles.ts`, pure and tested: prototypes, distance,
  softmax. The evaluation is a script that prints the table above.
- **Export**: `scripts/export-roster.ts` writes
  `role: { primary, secondary, confidence }` and `heightInches` into each
  roster entry.
- **Use**: `archetype.ts` and `archetype.js` read `role` when present and fall
  back to today's rule when absent, so old saves and fixtures keep working.
  Parity tests in both repos pin the shared cases.
- **Bonus**: if real shot locations land, they replace the synthesised zone
  shares in `src/lib/nba/autobattler/spatial-priors.ts`. That module says it
  was built to be drop-in replaced.

## Risks

- **The play-by-play source may not verify.** Then we ship the base set only:
  box score plus bio. That still fixes Playmaker and most bigs, but Slasher
  detection stays weak, and the note says so on the PR.
- **ID matching.** Hardwood's ids are local (1–29), and ESPN's are athlete ids.
  Joining by name needs an explicit map with a test, not fuzzy matching.
- **Small samples.** Below 300 minutes we fall back to the baseline rule rather
  than guess.
- **Feed changes.** Unofficial APIs break. A daily job that "succeeds" with
  zero rows is the failure this repo has already had once (see `ingest.ts`), so
  the job fails loudly when a feed returns nothing.

## Plan (one small PR each)

1. **Verify sources.** A script that fetches one game's play-by-play and one
   roster's bio fields and saves the raw JSON shape. Then this note gets a
   short "verified" table. Under about 100 lines.
2. **Bio and box-score features**, stored in Neon, with a script that prints
   one feature row per player.
3. **The role model and evaluation harness**, run against Brooks's labels.
   This PR carries the measured result.
4. **Wire roles into both repos** (Shootaround cards, Hardwood cards and fight
   specials), plus Playmaker art if approved.
5. *(If verified)* **The play-by-play shot set**, with the evaluation re-run
   to show what it added.

## Open questions for Brooks

1. Add **Playmaker** as a fifth role, or fold passers into Two-Way?
2. Are you willing to label about 100 players? It's roughly 30 minutes with a
   simple form, which I can build.
3. Should roles follow the **current season only**, or blend in the previous
   season early in the year while samples are small?
