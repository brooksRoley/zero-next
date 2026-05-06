# Daily Routines Design — Portfolio Signal Audit + Chief of Staff

**Date:** 2026-05-06
**Author:** Brooks Roley + Claude
**Status:** Approved

---

## Context

Brooks runs 5 interconnected repos under Zero Paradox LLC:

| Repo | Purpose | Existing Trigger? |
|------|---------|-------------------|
| `zero-next` | Portfolio, consulting funnel, games (brooksroley.com) | Yes — `daily-repo-audit` (role-rotated, 8:47 AM PT) |
| `ChannelZero` | Psychometric matchmaking app | Yes — `ChannelZeroDaily` (role-rotated) |
| `NbaApi` / `BballTactics` / `NBASwiftTactics` | NBA analytics + iOS app | Yes — `Basketball Modeling` |
| `JobSearchTool` | Job discovery, ranking, skills mastery tracking | **No** |
| `OceanAdvisor` | SoCal marine ecosystem explorer (Tideline) | **No** |

Two routine slots remain. This spec defines both.

---

## Routine #4 — Portfolio Signal Audit

### Identity

- **Trigger name:** `portfolio-signal-audit`
- **Schedule:** Weekdays 9:15 AM PT (`15 16 * * 1-5` UTC)
- **Sources:** `brooksRoley/JobSearchTool`, `brooksRoley/zero-next`
- **MCPs:** Notion, Gmail

### Purpose

Daily audit of Brooks' public presence through the lens of his top job targets. Answers: "What signal are you sending vs. what signal do employers need to see?"

### Execution Flow

1. **Read job targets** — parse `data/jobs.json` from JobSearchTool, filter to top 10 by `rank_score` in `discovered` + `outreach` phases.

2. **Extract demand signal** — aggregate `tech_stack`, `skills`, and `industry` fields across top 10 into a frequency-ranked demand profile. Example: "8/10 want TypeScript, 6/10 want system design, 4/10 want GraphQL."

3. **Audit public presence** — WebFetch:
   - `brooksroley.com` — landing page, what does a hiring manager see?
   - `brooksroley.com/resume` — does it mention in-demand skills?
   - `brooksroley.com/consulting` — does it signal the right expertise?
   - `github.com/brooksRoley` — profile README, pinned repos, what story do they tell?

4. **Read skills state** — check `data/mastery.json` and `data/resume.json` from JobSearchTool for claimed vs. visible skills.

5. **Gap analysis** — compare demand profile against visible signal:
   - **Blind Spots** — skills demanded by multiple top jobs but invisible in portfolio. "6/10 top jobs want GraphQL but it appears nowhere on your site or pinned repos."
   - **Underplayed Strengths** — mastery exists but isn't shown. "You have Practiced mastery in Docker and 3 repos using it, but /resume doesn't mention it."
   - **Signal Wins** — things your portfolio already proves. "Your Pente game demonstrates algorithm design — 3/10 jobs list it."

6. **Actionable output** — 2-3 specific changes ranked by impact. Each must be completable in under 30 minutes. Example: "Add GraphQL to /consulting skills list — 15 min, covers 6/10 target gap."

7. **Deliver:**
   - Notion page in "Weekly Dev Briefs" titled `Signal Audit — [date]`
   - Gmail draft to brooksroley@gmail.com with gap analysis + action items

### Boundaries

- No code changes or PRs — intelligence only
- No scraping new jobs — that's JobSearchTool's concern
- No LinkedIn scraping — assesses publicly visible signal only

---

## Routine #5 — Chief of Staff ("The Gardener")

### Identity

- **Trigger name:** `chief-of-staff`
- **Schedule:** Weekdays 9:45 AM PT (`45 16 * * 1-5` UTC)
- **Sources:** ALL repos — `brooksRoley/zero-next`, `brooksRoley/JobSearchTool`, `brooksRoley/OceanAdvisor`, `brooksRoley/ChannelZero`, `brooksRoley/NbaApi`, `brooksRoley/BballTactics`, `brooksRoley/NBASwiftTactics`
- **MCPs:** Notion, Gmail, Google Calendar

### Purpose

Cross-repo meta intelligence. A holistic "state of the garden" that tells Brooks what needs water, what's blooming, and what's surprising. Not a role-specific audit — pattern recognition across silos.

### The Three Sections

#### 1. Soil Health — maintenance that prevents rot

Scans all 7 repos for:
- Stale branches (>14 days with no activity)
- Unfixed lint/build warnings
- Outdated dependencies with security advisories
- `.env.example` drift vs actual env configuration
- Uncommitted work on remote branches

Assigns a quick health score per repo:
- `fresh` — healthy, active, clean
- `dry` — needs attention, minor issues
- `wilting` — neglected, stale, or degrading

Example output: "OceanAdvisor's requirements.txt pins FastAPI 0.109 but 0.115 has a security patch. ChannelZero has 6 stale branches from April."

#### 2. What Needs Water — momentum that stalled

- Compares git activity: commits in last 7 days vs prior 7 days per repo
- Identifies the project that had energy and lost it: "OceanAdvisor had 8 commits two weeks ago, zero since. The seed data and ERDDAP client are half-built."
- Cross-references Google Calendar for open time blocks
- Surfaces dangling work: open PRs, branches with recent commits but no PR, TODO items in CLAUDE.md files

#### 3. Surprise Bloom — the creative spark

One unexpected connection, observation, or opportunity. Grounded in evidence, not filler. Types:

- **Cross-repo patterns:** "Your JobSearchTool ranker and Pente ELO system both solve the same calibration problem — write about it."
- **External signal:** WebSearches for news relevant to projects (ocean conservation SoCal, NBA analytics trends, psychometric tech).
- **Portfolio synthesis:** "3 of your top-ranked jobs are at companies building mapping products — Tideline is directly relevant portfolio signal, but you haven't linked it from brooksroley.com."
- **LLC angle:** "Zero Paradox LLC consulting page lists 11 skills but none mention marine/geo data — OceanAdvisor proves you can build PostGIS + NOAA integrations."

### The Close

**One Thing Today** — a single sentence. The highest-leverage action across the entire garden, considering what's stalled, what's rotting, and what's about to bloom. Not a list. One thing.

### Delivery

- Notion page in "Weekly Dev Briefs" titled `Garden Report — [date]`
- Gmail draft to brooksroley@gmail.com with all three sections + One Thing, plain text

### Boundaries

- No code changes — pure intelligence and synthesis
- No duplicating other routines (won't re-audit zero-next through role lenses or re-run job gap analysis)
- No generic motivational filler — every sentence grounded in something observed in repos, calendar, or web

---

## Full Routine Schedule (all 5 triggers)

| Time (PT) | Trigger | Focus |
|-----------|---------|-------|
| 8:47 AM | `daily-repo-audit` | zero-next role-rotated deep dive |
| 9:00 AM | `Basketball Modeling` | NBA game analysis + modeling |
| 9:00 AM | `ChannelZeroDaily` | ChannelZero role-rotated audit |
| 9:15 AM | `portfolio-signal-audit` | Job targets vs. public signal gap |
| 9:45 AM | `chief-of-staff` | Cross-repo garden report |

The Chief of Staff runs last intentionally — it can reference patterns from the other routines' Notion output.
