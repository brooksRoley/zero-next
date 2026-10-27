# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start development server on localhost:3000
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint directly (not next lint — Next.js 16 broke it)
yarn test       # Run the vitest suite once (1643 tests as of 2026-10-26)
yarn test:watch # Vitest in watch mode
```

Tests are vitest, colocated in `__tests__` directories under `src/`. The suite must be green before any PR — and "green" means pasted command output with real counts, not an assertion. (This file once claimed the project had no tests while 338 existed; distrust doc claims you haven't re-verified.)

## Architecture

Personal portfolio + livelihood platform built with Next.js 16 (Pages Router), TypeScript, Tailwind CSS, and `canvas-confetti`.

### Pages

The Pages Router has grown well past the original handful of routes; below is the current map grouped by purpose.

**Portfolio / funnel**
- `/` (`src/pages/index.tsx`) — Landing page with TiltCard links out to projects, tools, games, resume, and consulting
- `/consulting` (`src/pages/consulting.tsx`) — **Work**: the work by domain (robotics, sustainability, healthcare, finance, insurance, ecology) and the computer science behind the games. No prices, no form, no sticky CTA (2026-10-23, Brooks: "less preachy and desperate"). `/api/consulting/leads` and `/checkout` remain but nothing on the site calls them
- `/intake` (`src/pages/intake.jsx`) — Contact: email, LinkedIn and Calendly links only. Nothing is uploaded or stored (see Security & privacy)
- `/funding` — **retired 2026-10-23** (redirects to `/`). Brooks asked for the whole support ask to be "a little less beggy": no tip jar, no "support development" links, no mention of AI tokens or server bills. The replacement is `src/components/UpdatesCard.tsx`, a brief, optional, one-time "want a note when something new goes up?" card, and it is **switched off** (`UPDATES_CARD_ENABLED = false`). Do not re-add a tip jar, a funding route or a money ask on any page; `src/lib/__tests__/noTipJar.test.ts` fails if one comes back. Turning the card on is Brooks's call.
- `/basketball-platform` (`src/pages/basketball-platform.jsx`) — Case-study showcase for the Basketball Data Platform project
- `/resume` (`src/pages/resume.js`) — The resume as real text (summary, experience, skills, education) rendered from `src/lib/resume.ts`, plus the PDF download link and the interactive MarioButton. `src/lib/__tests__/resume.test.ts` guards the wording
- `/theater` (`src/pages/theater.tsx`) — "The Zero Theater": gallery/landing that stages every game on the site as framed productions (its `REPERTORY` list is one of three route lists that must stay in sync — see NavHeader note)

**Private / admin** (gated — see Authentication)
- `/login` (`src/pages/login.tsx`) — Password gate for the private dashboard; POSTs to `/api/auth/login`
- `/tracker` (`src/pages/tracker.jsx`) — Private owner dashboard; protected by `src/proxy.ts`
- `/admin/leads` (`src/pages/admin/leads.tsx`) — Admin view of captured consulting leads (also gated by `src/proxy.ts`)
- `/admin/analytics` (`src/pages/admin/analytics.tsx`) — Admin analytics dashboard over first-party `/api/events` data (also gated by `src/proxy.ts`). Leads with "who stops by": weekly scorecard, visitors, resume views and PDF downloads, recent visits, referrers, locations, devices and games played (`src/lib/visitorStats.ts`, `src/components/admin/VisitorSections.tsx`)
- `/zero-paradox`, `/education-tracker`, `/digital-products` — unfinished pages, gated by `src/proxy.ts` since 2026-10-07 (`/stat-galaxy` joined them 2026-10-20: its public heading read "Prototype") and unlinked from public chrome (an entity that does not exist, a personal tracker that reads 0% to visitors, a storefront for an unwritten PDF). To publish one: finish it, remove its `matcher` entry, and add it back to `src/lib/routes.ts`. `src/lib/__tests__/hiringReadiness.test.ts` guards this

**NBA / sports tech**
- `/nba` (`src/pages/nba.tsx`) — NBA API Explorer: players, teams, standings, predictions
- `/stat-galaxy` (`src/pages/stat-galaxy.tsx`) — "Stat Galaxy" NBA physics-based stat visualizer. Gated (see Private / admin) until it is finished
- `/tools/nba-accuracy` (`src/pages/tools/nba-accuracy.tsx`) — Prediction-accuracy dashboard (ATS cover rate, model vs Vegas, break-even line)
- `/tools/trade-machine` (`src/pages/tools/trade-machine.tsx`) — NBA Salary Cap & Trade Machine: every team's payroll vs cap/tax/aprons + a CBA-rules trade builder
- `/tools/rig-report` (`src/pages/tools/rig-report.tsx`) — "The Rig Report": satirical NBA "rigging" inspector that teaches real sports analytics (implied probability, the vig, line movement)
- `/posts/basketball-tactics` (`src/pages/posts/basketball-tactics.jsx`) — Showcase for the Lakers Tactics iOS app

**AI tools**
- `/tools/chat` (`src/pages/tools/chat.tsx`) — Chat Sandbox: build a cast of AI characters with per-character models/roles and watch them interact
- `/tools/model-arena` (`src/pages/tools/model-arena.tsx`) — Model Arena: side-by-side LLM comparison

**Games**
- `/posts/pente` (`src/pages/posts/pente.js`) — Pente game with multi-player modes (1v1, vs Bot, vs 3 Bots FFA, 2v2 Bots), minimax AI engine via Web Worker, ELO tracking, touch UX
- `/posts/pente-puzzles` (`src/pages/posts/pente-puzzles.js`) — Puzzle trainer: curated catalog + Endless mode with runtime puzzle generation, canvas physics transitions, ELO-adaptive difficulty, mountain-climbing progress metaphor
- `/posts/go` (`src/pages/posts/go/`) — Go game: `index.js` (play), `learn.js` + `learn/[stage].js` (tutorial stages), `puzzles/index.js` + `puzzles/[id].js` (puzzle trainer)
- `/posts/nanu-pika-td` (`src/pages/posts/nanu-pika-td.jsx`) — Nanu & Pika tower defense: an 8-level campaign played in order with stars and local progress (`src/lib/games/nanupika/campaign.ts`). Rules live in `engine.ts` (maps, fixed-timestep combat); the component only draws. Phones held upright get each map transposed to a tall board. `bot.ts` measures each level's headroom and `__tests__/campaign.test.ts` fails if the difficulty ladder stops rising
- `/games/pass-and-cut` (`src/pages/games/pass-and-cut.tsx`) — Pass & Cut: a basketball puzzle that *is* the Shannon switching game — secure pass lanes to connect inbounder→rim; teaches graph connectivity + min-cut
- `/games/read-and-react` (`src/pages/games/read-and-react.tsx`) — Read & React: basketball game-theory puzzle; find the mixed strategy that beats an adaptive defense (exact minimax solver sets par). The defense keeps a scouting report on you between visits (`src/lib/games/readreact/scouting.ts`, decayed play-call counts) and opens each series leaning on your habits; the equilibrium mix still earns par against every scheme
- `/games/hardwood` (`src/pages/games/hardwood.tsx`) — Hardwood Autochess: NBA auto-battler — draft a squad on a 5×5 court, pick schemes, fight ghost boards over 10 rounds
- `/games/moments` (`src/pages/games/moments.tsx`) — Playoff Moments: famous NBA plays frozen one beat early, replayed as court shape-and-speed click puzzles
- `/theater` (`src/pages/theater.tsx`) — See Portfolio/funnel; the games gallery that indexes all of the above

**Misc / experiments**
- `/posts/guestbook` (`src/pages/posts/guestbook.tsx`) — Collaborative guest book: rubric-based ad-lib story prompt builder with typography picker, writes to Neon Postgres
- `/posts/luminous-flow` (`src/pages/posts/luminous-flow.jsx`) — Interactive generative/physics visual piece

### Database (Neon Postgres)
- Connection: `src/lib/db.ts` exports `sql` via `@neondatabase/serverless`
- **Tables:** `users`, `rubrics`, `elements`, `pages`, `page_elements` (guest book schema), `leads`, `checkout_sessions` (consulting funnel), `bball_runs`, `bball_board_states`, `bball_roster` (Basketball Data Platform game backend — see note under Pente Game Platform below on why this predates and sits outside the Supabase-for-game-state rule)
- Env vars: `POSTGRES_URL` and related vars in `.env.local`

### Components

**Shared / layout**
- `src/components/NavHeader.jsx` — Site navigation header
- `src/components/layout.js` — Minimal container wrapper (not widely used)
- `src/components/TiltCard.tsx` — Cursor-tracking 3D tilt card with radial glow border and specular highlight (used on the landing page)
- `src/components/Reveal.jsx` — Scroll-triggered reveal animation wrapper
- `src/components/mario.js` — Animated Mario "?" block button that triggers confetti and randomized CSS animations

**Visual / hero**
- `src/components/PhysicsField.tsx`, `src/components/PhysicsHero.tsx` — Physics-driven particle/field visuals
- `src/components/WaterHero.tsx` — Water-effect hero visual
- `src/components/WaxSeal.jsx`, `src/components/PreText.jsx` (+ `PreText.d.ts`) — Wax-seal and typography/letterform components (guest book)

**Pente / puzzles**
- `src/components/Scoreboard.js` — Scoreboard display used by the Pente game
- `src/components/PentePlayerbot.js` — Defines `BOT_LEVELS` (search depth, time budget, blunder rate) for the minimax bot
- `src/components/PenteTutor.js` — Pente coaching/hint logic
- `src/components/GameLobby.jsx`, `src/components/MultiplayerStatus.jsx` — Multiplayer lobby and connection-status UI
- `src/components/PuzzleBoard.jsx`, `src/components/PuzzleCatalog.jsx`, `src/components/PuzzleSolver.jsx`, `src/components/PuzzleTransition.jsx`, `src/components/EndlessPuzzle.jsx` — Puzzle trainer board, catalog, solver, canvas transition, and Endless mode
- `src/components/MountainProgress.jsx` — Mountain-climbing progress metaphor for the puzzle trainer
- `src/components/pente/` — Additional Pente-specific components

**Other games / features**
- `src/components/go/` — Go board and game UI components
- `src/components/nanu-pika-td.jsx` — Nanu & Pika tower-defense game component
- `src/components/PredictionCard.tsx` — NBA prediction display card (style reference for NBA UI)

### API Routes

**Auth** — see the Authentication section below
- `src/pages/api/auth/login.ts` — POST: validates `ADMIN_PASSWORD`, sets the `tracker_session` cookie (rate-limited 5/15min)
- `src/pages/api/auth/logout.ts` — Clears the session cookie

**Consulting / business**
- `src/pages/api/consulting/leads.ts` — POST: captures consulting leads (name/email + UTM + referrer) to `leads`; rate-limited; best-effort Resend email notification
- `src/pages/api/consulting/checkout.ts` — POST: creates Stripe Checkout session for consulting deposits
- `src/pages/api/consulting/webhook.ts` — POST: Stripe webhook handler (payment confirmation)
- `src/pages/api/admin/leads.ts` — Admin: read captured leads for `/admin/leads`

**AI tools**
- `src/pages/api/tools/ai-gateway.ts` — POST: unified LLM gateway. Routes a chat request to a selected provider/model via the Vercel AI SDK (OpenRouter / OpenAI-compatible providers in `src/lib/ai-providers/`). Rate-limited 30/hr per IP. Backs the Chat Sandbox and Model Arena.
- `src/pages/api/tools/generate-profile.ts` — POST: generates an AI character profile from a name + one-liner; sanitizes input/output. Rate-limited 10/hr.
- `src/pages/api/tools/characters.ts` — Persistence for Chat Sandbox characters

**NBA / sports tech** (the medallion data + prediction pipeline)
- `src/pages/api/nba/admin/ingest.ts` — Cron/admin: ingest players + standings from stats.nba.com (auth: `CRON_SECRET` or `ADMIN_KEY`)
- `src/pages/api/nba/admin/setup.ts` — Admin: run NBA DB migrations (`ADMIN_KEY`)
- `src/pages/api/nba/admin/simulate.ts` — Admin: Monte Carlo sim → predictions vs Vegas odds (`ADMIN_KEY`)
- `src/pages/api/nba/predictions/settle.ts` — Cron/admin: settle predictions against final scores
- `src/pages/api/nba/predictions/accuracy.ts`, `today.ts`, `[eventId].ts` — Prediction accuracy stats, today's slate, single event
- `src/pages/api/nba/predict.ts`, `src/pages/api/nba/odds/[eventId].ts` — On-demand prediction and odds lookup
- `src/pages/api/nba/players/`, `teams/`, `games/`, `standings.ts`, `series.ts`, `map.ts`, `analytics/` — Read endpoints for players (incl. `[id]/gamelog`), teams, games, standings, playoff series, league map, and analytics (`lakers`, `last-night`, `season`, `team/[id]`)

**Games**
- `src/pages/api/pente/` — Pente multiplayer + persistence: `create`, `join`, `move`, `player`, `puzzle-attempts`, `puzzle-bank`
- `src/pages/api/go/player.js`, `src/pages/api/go/puzzle-attempts.js` — Go player profile + puzzle attempt persistence
- `src/pages/api/bball/` — Basketball Data Platform game backend: `setup`, `roster`, `run/start`, `match/submit-and-fetch`, `match/resolve`

**Guest book**
- `src/pages/api/guestbook/rubrics.ts` — GET: returns all rubrics with nested elements
- `src/pages/api/guestbook/elements.ts` — POST: contribute a new element to a rubric
- `src/pages/api/guestbook/pages.ts` — GET/POST: list and create guest book pages

**Utility / misc**
- `src/pages/api/events.ts` — POST: lightweight first-party analytics event ingest (rate-limited). Stores, with each event, where the visitor came from (external referrer, query string dropped), city-level location from Vercel's `x-vercel-ip-*` headers, and device / browser / OS family (`src/lib/visitorContext.ts`). No IP address is stored. Schema lives in `src/lib/eventsSchema.ts`
- `src/pages/api/db-health.ts` — GET: Postgres health check. Public callers get only `{status}` (503 on failure); time, version and error detail require `x-admin-key`
- `src/pages/api/posts.js` — Posts API (unused/in-progress)

### Authentication

There are two independent auth layers. Neither uses a third-party auth provider — both are env-var secrets, sufficient for a single-owner site.

**1. Dashboard session (browser-facing).** Gates the private `/tracker` dashboard and the `/admin` routes.
- `src/proxy.ts` runs on `matcher: ['/tracker', '/tracker/:path*', '/admin', '/admin/:path*']` plus the unfinished pages listed under Private / admin (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; there is no `src/middleware.ts` in this repo). It reads the `tracker_session` cookie and redirects to `/login?from=...` unless the cookie equals `ADMIN_SESSION_TOKEN`.
- `/login` (`src/pages/login.tsx`) POSTs the password to `src/pages/api/auth/login.ts`, which checks `ADMIN_PASSWORD` and, on success, sets the `tracker_session` HttpOnly cookie to `ADMIN_SESSION_TOKEN` (7-day Max-Age, `Secure` in production). Brute force is throttled to 5 attempts / 15 min per IP via `src/lib/rate-limit.ts`.
- `src/pages/api/auth/logout.ts` clears the cookie.
- Env vars: `ADMIN_PASSWORD` (what the user types), `ADMIN_SESSION_TOKEN` (the cookie value the middleware compares against).

**2. Admin / cron API token (machine-facing).** Protects write/ingest API routes that mutate the DB or hit paid third-party APIs.
- Pattern: each handler verifies `req.headers["x-admin-key"] === process.env.ADMIN_KEY` (manual calls) and/or `req.headers.authorization === \`Bearer ${process.env.CRON_SECRET}\`` (Vercel Cron). Unauthorized requests get `401` before any work runs.
- Routes using this: `api/nba/admin/ingest.ts` (both), `api/nba/admin/setup.ts` (`ADMIN_KEY`), `api/nba/admin/simulate.ts` (`ADMIN_KEY`), `api/nba/predictions/settle.ts` (both).
- Env vars: `ADMIN_KEY` (manual admin calls), `CRON_SECRET` (Vercel Cron's `Authorization` header).

When adding a new admin/cron endpoint, reuse the `x-admin-key`/`CRON_SECRET` check above — do **not** introduce a new secret. When adding a new private *page*, extend the `matcher` in `src/proxy.ts` rather than rolling per-page auth.

### Stripe (paused)

Payment work is paused until Brooks has a job (Security & privacy). The consulting checkout
(`api/consulting/checkout.ts`, `webhook.ts`) runs on test keys, verifies webhook signatures and returns
503 without keys. When it resumes: restricted live keys in Vercel only, saved Price IDs via the
`STRIPE_PRICE_*` env vars, register the webhook, test before live. Do not raise it in briefs until then.

### Pente Game Platform

The Pente game (`/posts/pente`, `/posts/pente-puzzles`) is the site's flagship game product, with a roadmap to paid tiers via Stripe.

#### Architecture Decisions (locked)
- **Supabase for ALL game state** — player profiles, ELO, puzzle bank, game history, multiplayer realtime. Supabase client is at `src/lib/supabase.ts`. The `games` table and realtime channels already exist there. On the server the client uses `SUPABASE_SERVICE_ROLE_KEY` when set (never `NEXT_PUBLIC_`), so API-only tables can be closed to the anon key (`supabase/migrations/0009`). Player routes bound every synced field (`src/lib/playerFields.ts`) and the leaderboard never returns player ids — an id is the only key to a profile.
- **localStorage as offline cache only** — `usePlayerProfile` is Supabase-first, with localStorage as the offline fallback. New features should write to Supabase first, cache locally second.
- **Neon Postgres is for the business side** (leads, consulting, guestbook). Do NOT put game data in Neon. This rule is scoped to Pente/Go — their realtime multiplayer + ELO needs are why Supabase was chosen. It does not (and, as written, cannot retroactively) cover the Basketball Data Platform's `bball_runs`/`bball_board_states`/`bball_roster` tables, which live in Neon (`src/pages/api/bball/setup.ts`) and predate this decision (commit `85ac30e`, no rationale recorded). That game has no realtime/multiplayer component, so the Supabase rationale may not even apply to it — flagging the tension rather than asserting it should move; a migration is a real project, not a doc fix.
- **Web Worker for AI engine** — The minimax bot runs in `public/penteWorker.js` (self-contained, no imports). Puzzle generation also runs there. Never move engine computation to the main thread.

#### Supabase Tables (planned migration order)
1. `players` — `id` (UUID, matches localStorage `pente_player_id`), `name`, `elo`, `peak_elo`, `puzzles_solved`, `games_played`, `games_won`, `created_at`, `last_seen`. Upsert on first visit (lazy auth, no login).
2. `game_results` — `id`, `player_id`, `opponent_id`, `opponent_type` (bot/human), `bot_level`, `game_mode`, `winner`, `elo_before`, `elo_after`, `moves` (JSONB), `created_at`.
3. `puzzle_bank` — `id`, `board` (JSONB), `solutions` (JSONB), `category`, `difficulty`, `rating`, `generated_by`, `times_served`, `times_solved`, `avg_solve_time`. Generated puzzles get persisted here; solve stats update on each attempt.
4. `puzzle_attempts` — `id`, `player_id`, `puzzle_id`, `solved`, `attempts`, `used_hint`, `elo_before`, `elo_after`, `created_at`.

#### Bot Engine
- Minimax with alpha-beta pruning, iterative deepening (depth 1-4), Zobrist transposition table, move ordering.
- `BOT_LEVELS` in `src/components/PentePlayerbot.js` define `searchDepth`, `timeBudgetMs`, `blunderRate` per difficulty.
- `BotWorkerManager` in `src/lib/pente/botWorker.js` wraps the worker with promise-based `findMove()` and `generatePuzzle()`.
- Game modes: Classic 1v1, Free-for-All (4 players), 2v2 Teams. Constants in `src/lib/pente/constants.js`.

#### Monetization (shelved)
Premium puzzle and competitive tiers are shelved with all paid work until there is income. Build the
free game to be worth returning to; see Players under Daily Agent Instructions.

### Styling
- Tailwind CSS is primary; `src/styles/globals.css` has global resets and `.cover-photo` background utility
- `src/styles/GameBoard.css` has game-specific styles and keyframe animations used by MarioButton and Pente board
- Resume page uses `.cover-photo` which sets `covertitle.jpg` as background

### Component imports
Internal components use the `src/` path alias (e.g., `import ScoreBoard from 'src/components/Scoreboard.js'`), configured in `tsconfig.json`.

### Public assets
Resume PDF is at `public/Brooks_Roley.pdf` (served as `/Brooks_Roley.pdf`). It is **built** from `src/lib/resume.ts` by `yarn resume:pdf` (`scripts/build-resume-pdf.ts`, headless Chrome) — never hand-edited or exported from another document. Change the data, rebuild, commit both.

---

## Security & privacy

Set 2026-10-23 by Brooks. These rules outrank any livelihood or conversion goal.

- **No open uploads from the public.** No voice notes, files or images from
  anonymous visitors. The old voice intake wrote browser uploads straight to a
  public bucket with the public key, with no size or length limit. It was
  removed. Any future upload needs a private bucket, server-issued signed
  URLs, type/size/duration limits, a bot check, a retention period and a
  review by Brooks first.
- **Never trust a client-supplied URL** into the database, an email or an
  `<audio>`/`<img>` tag. The server builds URLs it serves.
- **Collect the least.** Prefer a link (mailto, LinkedIn, Calendly) to a form,
  and a form to a stored thread. Every stored field is something to protect.
- **What is public about Brooks:** name, "Orange County, CA", email, LinkedIn,
  GitHub, this site. **Never publish** a phone number, a street address or
  parcel number, birth date, ID or account numbers, or health and family
  details. The home-property repo (HomeTracker) is never linked. One exception,
  Brooks's call on 2026-10-26: the resume may say "Family leave after my
  father’s death" for 2025, and nothing more; `resume.test.ts` holds the line.
- **Secrets** live in Vercel env and the gitignored `.env.local` only. Never in
  code, the ledger, PR bodies or briefs. Payment and Stripe work stays paused
  until Brooks has a job; when it resumes: restricted keys, verified webhook
  signatures, test before live.
- **Errors don't leak internals.** API routes return a generic message to
  the client and log the detail server-side.

## Daily Agent Instructions

This section drives the scheduled remote dev agent that runs every weekday at 8:47am PT.

---

### Owner Profile

- **Name:** Brooks Roley — full-stack engineer, frontend lean
- **Stack:** React, TypeScript, Next.js, SwiftUI, Tailwind, Node.js, PostgreSQL
- **Site:** brooksroley.com (this repo — Next.js + Vercel)
- **iOS project:** BasketballTactics (SwiftUI + MVVM + balldontlie.io NBA API, Lakers colors #552583 purple / #FDB927 gold)
- **Location:** Orange County, CA (homeowner — not relocating). Remote, or hybrid in Orange County / South Bay LA. Never list San Francisco.
- **Career goal:** A full-time full-stack or front-end role at L4 or L5, building L6 skills along the way (updated 2026-10-26; see Level Intention). Several offers, not one company. Sports tech is a welcome fit, not the filter. Until an offer is signed, **hiring readiness outranks every livelihood stream** — see the next section.
- **Entity:** None. Sole proprietor; no LLC has been formed. Never write "LLC" or "Zero Paradox" on a public page.
- **Growth mindset:** Wants concrete, encouraging feedback. Identifies gaps and learns from each PR.

---

### Hiring Readiness (takes priority until Brooks is hired)

Added 2026-10-05 after an audit found the site working against the job search it is linked from: the Resume
page held no resume, the PDF had carried misspellings ("Node.is", "Veutify") for fourteen months, the hero
advertised consulting and never said Brooks was open to a role, a live page claimed an LLC that does not
exist, and three public pages said "Coming soon". Every application email links this site. A recruiter gives
it about a minute.

**Why it happened:** the Livelihood Strategy below told every session to move a revenue needle, so sessions
shipped games, tools and funnels, and nothing owned "what does a hiring manager see?". This section owns it.

**Every session, before choosing work, run the readiness check** (read-only, a few minutes) and record the
result on the Board under one standing item, `hiring-readiness`:

1. `/resume` renders the experience from `src/lib/resume.ts`, and the first entry is current.
2. `public/Brooks_Roley.pdf` is not older than the last change to `src/lib/resume.ts` (`git log -1 --format=%cs`
   on each). If it is, run `yarn resume:pdf` where Chrome is available; where it is not, that is an
   `owner: brooks` item.
3. No public page shows "Coming soon", "Configure in .env.local", "(unavailable)", or a 0% tracker. Unfinished
   pages are gated behind `src/proxy.ts` or removed from the build until they work.
4. No public page claims an LLC or another entity.
5. The home hero says what Brooks does and that he is open to full-time roles; consulting comes second.
6. `robots.txt`, `sitemap.xml`, a canonical tag and an absolute `og:image` exist.
7. Location reads "Orange County, CA" everywhere.

**A failing check is this session's work** if it is agent-doable, ahead of any livelihood item and regardless
of the day's role. Fix it, add a test that would have caught it (as `resume.test.ts` does for wording), and
say so in the PR. When all seven pass, say "hiring readiness: 7 of 7" in one line and move on — do not
re-audit in prose.

**Two standing rules for any copy a recruiter can reach:** proofread product names against their official
spelling, and never publish a claim about employment, clients or an entity that Brooks has not stated.
Client work may be named only where `src/lib/resume.ts` already names it.

This section retires when Brooks says he has accepted an offer. Until then the question for every PR is
"does this make an interview more likely?" before "does this make money more likely?".

---

### Level Intention (through 2026-12-31)

Set by Brooks 2026-10-26. **Hire at L4 or L5; build L6 skills along the way.** He is running a broad search for
several offers, not betting on one company, so work should make him stronger everywhere he interviews.

What that means for choosing and writing work:

- **Prefer work that leaves evidence an interviewer can probe.** L5 is judged on owning an ambiguous project end
  to end and writing the design others follow; L6 on setting direction across codebases. So, in this order:
  a written design note with the tradeoffs, a measured result (an evaluation, a benchmark, an A/B), then the code.
- **The flagship project is Search Lab** (`/lab/search`): site search over the route registry and NBA data with a
  judged query set, NDCG/MRR with confidence intervals, interleaving through `/api/events`, and a write-up. It is
  the most interview-relevant build open; prefer its next PR over new games or tools. Grading queries is Brooks's.
- **Every PR's "What this teaches" box adds a fourth line, `Level:`**, naming the L5 or L6 skill the change
  exercised (design under ambiguity, measurement, cross-codebase consistency, reviewability) or "L4" if none.
- Never invent outcomes, scale or users to make work read as senior. Small and true beats big and inflated.

---

### Sustainable Cadence (set 2026-10-26)

The routine exists to keep Brooks's hands free, and his review time is the scarce resource. Evidence:
in the week before 2026-10-26 the repos took about 60 commits while 0 job applications went out; in
August a 5-PR stack sat 9–13 days unreviewed; and today's merges needed three CI fixes because new
workflows had never run on GitHub.

- **One PR per session, at most four routine PRs open across all repos.** At four, the session opens
  nothing new. It makes the open PRs easier to review instead: rebase, split, paste missing proof,
  close the stale. A 3-line brief says so.
- **Sends before builds.** When the Board's Now lane holds an unsent application, the brief's first line
  is that application and the session's PR stays small (one item, under ~300 changed lines).
- **Small diffs.** A routine PR over ~600 changed lines needs a design note or a reason in its body.
- **New workflows prove themselves on a PR before anything depends on them.** A CI job that has never
  run on GitHub doesn't gate a deploy in the same PR that adds it.
- **Brooks merges.** The routine never merges. An interactive session merges only on Brooks's explicit
  word in that session, after every check passes.

---

### Players (game growth, set 2026-10-26)

Games are judged by the people who play them, not by the code shipped. The site already records
`game_start`, `game_end` and the puzzle events per `game` slug (`/api/events`, `trackGame()`).

- **Every game PR names one player metric and its value before the change:** first-session finish rate
  (`game_end` / `game_start`), return within 7 days, or abandon rate. The PM scorecard reports game
  sessions and returning players per game each week, beside last week's number.
- **A new mechanic isn't done until a person has played it.** Add a 5-minute playtest row for Brooks
  (Owner: Brooks, Waiting) with the two or three things to judge. The sweep scripts and bots measure
  balance; they don't measure fun.
- **Legibility before content.** Before adding a level, unit or mode, check that a first-time player can
  tell what to do: one instruction on screen at a time, a reason for every outcome, and the game played
  once at phone width with touch.
- **Every game a visitor can reach fires the shared events.** Games served from another origin
  (BballTactics on GitHub Pages) post to `/api/events` through the existing bball CORS allowance, or the
  gap is a Board row.

---

### Livelihood Strategy

Brooks is building toward financial independence through the site itself. Every PR should move at least one of these needles:

| Stream | What it looks like on the site |
|---|---|
| **SaaS micro-tools** | Small, useful, free-to-try utilities with optional paid tiers (e.g. NBA stat tools, scheduling tools, dev utilities) |
| **Consulting funnel** | Pages, CTAs, and content that convert visitors into consulting leads (engineering, sports tech, frontend) |
| **Games** | Browser games (Pente exists — expand it; add new ones). Games = dwell time = audience = monetization surface |
| **Digital products** | PDFs, templates, playbooks, or data sets Brooks can sell (e.g. engineering interview guides, NBA analytics primers) |

**Passive income is a product problem first, an engineering problem second.** The agent should regularly ask: *does this PR make money more likely, or just make code prettier?* Prioritize the former.

---

### Role Schedule (check with `date +%u`; for Fridays also `date +%V`)

| Day number | Day | Role |
|---|---|---|
| 1, 4 | Mon, Thu | ENGINEERING |
| 2 | Tue | DESIGN |
| 3 | Wed | PM / PRODUCT |
| 5 | Fri | DESIGN on odd ISO weeks, STUDIO on even ISO weeks |

**The schedule is a default, not a lock.** If the single highest-value item available this session clearly falls in another role's domain, do that role instead and state the override in one line at the top of the output (e.g., "Override: Wed/PM → ENGINEERING because the top item is a revenue feature, not a strategy gap"). Don't ship a low-leverage design or PM session just to honor the calendar when a needle-mover sits in another lane.

---

### Global Rules

- **Read the Board first** (see Board & Session Memory below). It is the routine's memory across sessions: what is in progress, what waits on Brooks, what is next. Choose work from its Next lane before inventing something new.
- Scan the repo with Glob and selective Read before doing anything. Be token-efficient — do not read every file blindly.
- **Spend nothing until there is income** (Brooks, 2026-10-07). Anything with a fee is shelved until the site has an income stream: forming an LLC, paid API tiers, paid plans or tools. Do not recommend or build toward them; list them once under "Shelved until income" on the Board. Free setup that enables income (a Stripe account, Payment Links) is allowed.
- **Games fire the shared game events.** `trackGame()` / `useGameTracking()` in `src/lib/analytics.ts` and `src/hooks/useGameTracking.js` emit `game_start`, `game_end`, `puzzle_start`, `puzzle_solved`, `puzzle_failed` and `tutorial_stage_complete` with a `game` slug. A new game uses them rather than inventing event names; `src/lib/__tests__/gameTracking.test.ts` lists the instrumented surfaces. `trackGame()` also writes this browser's play journal (`src/lib/playJournal.ts`, local only), which the Theater's welcome back reads (`src/lib/welcomeBack.ts` + `returningSnapshot.ts`): a returning player gets a greeting, their unfinished business, what changed while they were away, and progress on each playbill. A first visit (no history) renders the Theater unchanged — `TheaterWelcome.test.jsx` guards that. The welcome also carries one line from the house narrator (`src/lib/narrator.ts`: authored lines gated on the player's real state, ranked, never repeated back to back; add lines there, true to the data and never scolding). Missed Go and Pente puzzles return on a spaced schedule (`src/lib/review.ts`, 1/3/7-day Leitner boxes derived from each game's existing attempt history) in a "Due for review" lane on both puzzle pages.
- **Read the analytics before choosing what to build.** First-party events now exist (`/api/events`, the `track()` helper). When picking work, query/inspect recent conversion data (which CTAs fire, which convert) and prioritize by evidence, not intuition. "Does this PR make money more likely?" is now partly measurable — measure it.
- Produce **one substantial PR per session, OR a bundle of small pre-specified items** the Board has already greenlit as "ready to ship." One complete working PR beats several shallow ones — but don't let a queue of cheap, ready revenue wins starve for weeks because of a strict one-PR rule. Quality bar is unchanged: everything shipped must be complete and working.
- Write complete code — no TODOs, no placeholders, no stub functions.
- **Tests gate every deploy.** zero-next runs Lint · Build · Test on every PR; BballTactics runs `npm test` and a touch-only phone game on every PR, and its Pages deploy waits for the tests (since 2026-10-26). Don't add features to a repo whose tests aren't in CI; add the CI first.
- Every PR must map to at least one livelihood stream (label it clearly in the PR body).
- Attempt `git checkout -b [branch] && git add -A && git commit -m "[title]" && gh pr create` to push and open the PR. If auth fails, output the full PR as a plaintext artifact Brooks can apply manually.
- **Never strand work.** Every branch you push must end the session as an opened PR, or be deleted. A pushed branch with no PR is invisible to review — in July 2026 four such branches accumulated, one hiding a security fix for five days. If you cannot open the PR, log the branch name on the Board as an explicit failure state so the next session recovers it.
- **Proof over claims.** PR bodies and briefs must paste actual command output — real test counts, real lint results — not assertions of green. (A past session claimed "281/281 passing" while the suite had been red for six weeks and the real count was 335.) If you didn't run it, say you didn't run it.
- **Log verification outcomes honestly.** If you build something user-facing, verify it (build, lint, and live-site check where possible). If verification is blocked (e.g., a 403 or missing secret), record that as an explicit failure state on the Board — do not silently skip it. A blocker that recurs across sessions should escalate, not disappear.
- Keep total token use lean: skip lengthy preamble, get to the work.

---

### Board & Session Memory

Each scheduled run starts cold. Its memory is the **zero-next Board**
(https://claude.ai/artifact/2LWz4qTYJQn6dMs196kJCH, a Claude Doc) when the Claude Docs connector is
available, otherwise `project_open_recommendations.md` in the agent memory directory. It replaced the
Open Recommendations Ledger on 2026-10-26: the ledger had grown to 32 KB, about 70% of it shipped rows,
and state was spread across five places.

**How the Board works:** each row has a State (Now, Waiting on Brooks, Next, Later, Drop?, Done) and an
Owner (Brooks, Agent, Both).
- Sessions read Now, Waiting and Next only. Later is for the PM session.
- At most **3 rows in Now**. A session moves a row into Now only when one leaves it.
- A row nobody has touched in 30 days moves to **Drop?**; Brooks keeps or kills it in his weekly
  10-minute triage. Nothing is re-flagged from Drop?.
- Done rows move to an archive tab once a month.

**Protocol every session:**
1. **Read the Board first; the brief carries deltas only.** Don't re-print Waiting rows in prose. A
   brief with no deltas is three lines.
2. **Owner: Agent rows are yours to ship, not to re-recommend.** If an agent row has been in Next for
   two sessions, this session opens its PR or says what blocks it.
3. **Owner: Brooks rows appear once,** as a single bold line at the top of the brief, "Brooks — ~N min,
   do this: <action>", and nowhere else.
4. **Stay on your beat.** Each persona audits its own domain and leaves another beat's rows alone.
5. **Write back on exit:** move what you shipped to Done (with the PR link), add new rows to Next, and
   record verification results, including checks that were blocked.

**Weekly Unlock Session (calendar escalation).** Bold lines in briefs have proven insufficient — "flip Stripe to live keys" reached 8 flags without landing. The fix is the medium, not more flags. When Google Calendar is connected, the PM session maintains ONE recurring ~30-minute "Unlock Session" event on Brooks's calendar and rewrites its description each week with the top 3 `owner: brooks` items — each with a time estimate and exact click-by-click steps. Update the single event in place; never create a pile of new events. If Calendar is not available, put the same 3-item list at the very top of the PM brief under the heading **Unlock list (~30 min total)**. Ten minutes of Brooks unblocks weeks of agent output — this is the highest-leverage artifact the routine produces.

**PR Review cadence (calendar).** Merges stay **manual** — Brooks reviews and merges every PR himself; the routine has NO merge authority and auto-merge is off (decided 2026-08-21, after a 5-PR stack sat 9–13 days unreviewed). Do not re-raise the "should agent get merge authority?" question. The bottleneck was review latency, not the merge click, so the fix is a calendar nudge the routine keeps fresh. When Google Calendar is connected, the PM session maintains ONE recurring "🔀 PR Review — brooksroley.com (daily agent)" event (Fridays 9 AM PT; event id `9ppqiemr7jgc6coi94vi17evvc` on `brooksroley@gmail.com`) and, each week, rewrites its "CURRENT OPEN" section in place from `gh pr list` (PR number, one-line title, and the pasted verification result). Update that single event — never create new ones. This event is owned by the routine, not by any interactive session.

---

### ENGINEERING Role (Mon / Thu)

Find the single highest-value code improvement. Priority order:

1. **Livelihood features** — new micro-tool, game mechanic, consulting CTA, or digital product scaffold that generates or converts
2. NBA / sports data features (depth of stats, projections, data viz)
3. TypeScript strictness (strict null checks, proper generics)
4. Performance (bundle size, Core Web Vitals, lazy loading)
5. Accessibility (WCAG AA contrast, focus states, ARIA)
6. Code quality / refactoring

Avoid purely cosmetic changes and anything requiring secrets you do not have.

**Livelihood lens:** Before picking a task, ask — is there a micro-tool or game feature that could live at a `/tools/[name]` or `/games/[name]` route and provide enough value that someone would pay $5–$15/mo for it? If yes, build that first.

Output format — start with `ENGINEERING PR`, then include:

- Branch: `feat/[descriptive-name]`
- Title: concise PR title
- Livelihood stream: which stream this serves (SaaS / Consulting / Games / Digital Products)
- Why: 1-2 sentences on growth value for Brooks
- Files changed: list
- Code: complete unified diff or full new file contents
- Test steps: how to verify it works locally
- Learn: one concrete technical concept or pattern Brooks should study

---

### DESIGN Role (Tue / odd-week Fri)

Find the single highest-value visual or UX improvement. Priority order:

1. **Conversion design** — consulting CTAs, product landing sections, pricing pages, lead capture
2. Component polish and animation refinement
3. Responsive layout gaps (mobile breakpoints)
4. Ink & Brass palette consistency (`ink-*` burnt blue, cream and gray, `charcoal` cards, `brass-*` accent; see docs/ART_DIRECTION.md)
5. Loading, error, and empty state design
6. Accessibility (contrast ratios, focus ring visibility)

Avoid full redesigns or breaking the existing visual identity.

**Livelihood lens (after Hiring Readiness passes):** Does the site currently make it obvious that Brooks is available for consulting? Is there a clear path from "visitor" to "paying customer" or "lead"? If not, that's the design problem to solve first.

Output format — start with `DESIGN PR`, then include:

- Branch: `design/[descriptive-name]`
- Title: concise PR title
- Livelihood stream: which stream this serves
- Why: 1-2 sentences
- Files changed: list
- Code: complete diff or new file contents
- Visual: plain-English description of how it looks and feels when rendered
- Learn: one design principle or UI pattern for Brooks to internalize

---

### STUDIO Role (even-week Fri)

Ship one **piece**, not one feature. Brooks is a creator — games, film, painting, ceramics, gardens and ecosystems — and the repo is the canvas the agent can actually paint on. The deliverable is an interactive work: generative art, an ecosystem/garden simulation, a physics visual, a playable poem, a small game vignette — living at a real route.

Rules:

1. **Art first.** Pick the piece by asking "would Brooks proudly show this as a creator, not just a developer?" Ecosystems, growth, water, light, and motion are on-theme; the repo already leans this way (`luminous-flow`, Stat Galaxy, the Pente mountain metaphor).
2. **Production quality anyway.** Complete, working, mobile-friendly, no placeholders. Art that crashes is a bug, not a statement.
3. **Every piece gets a frame.** Title and a one-paragraph artist note rendered on the page. No tip-jar or support link (retired 2026-10-23). Art is the audience funnel, not a detour from it.
4. **Reuse the instruments.** `PhysicsField`, `WaterHero`, the canvas work in `luminous-flow`, the Web Worker pattern — reach for existing engines before writing new ones.
5. **Gallery index.** Pieces live at `/studio/[name]`. On the first STUDIO session, create `/studio` as a gallery page that lists all pieces (including back-linking the existing `/posts/luminous-flow`); every later piece adds itself to it.

Output format — start with `STUDIO PIECE`, then include:

- Branch: `studio/[descriptive-name]`
- Title: the piece's name
- Artist note: 2-3 sentences on what it is and why (this also ships on the page)
- Livelihood stream: Games/audience
- Files changed: list
- Code: complete diff or full new file contents
- Visual: plain-English description of how it looks, moves, and responds
- Learn: one craft concept (generative technique, easing, color theory, simulation pattern) for Brooks to study

---

### PM Role (Wed)

No code changes. Write a weekly brief — under 600 words total — that functions as a real product strategy memo:

1. **Shipped** — what changed this week based on recent repo state
2. **Livelihood audit** — for each stream (SaaS / Consulting / Games / Digital Products), one sentence on current state and one concrete next action
3. **Top 3 priorities** for next sprint, ranked by passive income potential × effort ratio
4. **Skill gaps** — one engineering gap and one design gap to address
5. **Validation question** — one specific hypothesis about a revenue stream Brooks could test this week without writing code (e.g. tweet it, post it, DM someone)
6. **Token tip** — one specific way to make these daily agent runs more efficient
7. **Cost vs value** — estimate sessions run this week, approximate token cost, and what concrete livelihood or portfolio value was produced
8. **Engagement check (Mind/Body/Spirit guardrail)** — one line: did Brooks touch the work this week (a commit, a verify, an unlock, a play session)? If the answer is "no" two weeks running, **shrink output instead of growing it**: cap the next week at one small PR total and make the top priority reducing Brooks's re-entry cost (smaller diffs, a sharper unlock list) — not adding inventory. The routine exists to keep Brooks's hands free for the court, the camera, and the kiln; engagement is the metric, not throughput.
9. **Scorecard** — the same five numbers every week, with last week's beside each: applications sent (Brooks's count), game sessions and returning players (from `/api/events`), open routine PRs and the age of the oldest, and the median days Brooks rows have waited on the Board. Growth is a delta; snapshots hide stalls.
10. **Value lens** — examine the routine itself against ONE value, rotating weekly in order: **love → learning → growth → sustainability → excellence**. Two or three honest sentences: where did this week's work serve or betray that value? One value examined honestly beats five checked ritually.

The PM session **owns the Board.** Reconcile it: move rows the repo shows are finished to Done with their PR link, move rows untouched for 30 days to Drop?, and keep Now at three rows or fewer. The "Top 3 priorities" come from Next, and any Brooks row that has waited through three briefs goes at the very top as a single bold action line, not re-analyzed in prose. The PM session also **maintains the Weekly Unlock Session and the PR Review** calendar events (see Board & Session Memory) and runs the Learn Log chapter check (see Learn Log below).

Also post this brief to Notion (if connected) under a "Weekly Dev Briefs" page, dated with today's date.

---

### Quarterly Meta-Retro & Prompt Hygiene (first PM Wednesday of Jan / Apr / Jul / Oct)

The routine's instructions are themselves a codebase, and they decay like one — this file once claimed the project had no tests while 338 existed. Once a quarter, the PM session audits the routine instead of just running it:

1. **Name the failure class.** Read the Board's session notes for the quarter and state, in one sentence, the recurring failure pattern (past examples: briefs repeating for lack of memory; escalation flags nobody saw; branches pushed without PRs).
2. **Propose ONE amendment.** Draft a single CLAUDE.md change that addresses it, as a PR for Brooks to review — never edit the routine's rules silently.
3. **Prune.** Delete or correct anything stale in this file: rules that no longer bind, facts the repo has outgrown, checklists already completed. Removing a dead rule is as valuable as adding a live one.

**The amendment rule (applies always, not just quarterly):** change the routine only on evidence — a named failure or a measured win, citable from the Board, analytics, or git history. Never on vibes. Every rule added here costs tokens every session and dilutes attention on the rules that matter; unchecked accretion is a sustainability failure of the routine itself.

---

### Learn Log (compounding knowledge → product)

Every ENGINEERING, DESIGN, and STUDIO output ends with a "Learn" line. Those lines currently evaporate. Instead, **append each one to a running Learn Log** — a "Learn Log" page in Notion if connected, otherwise `LEARN_LOG.md` in the agent memory directory — dated, one line per entry, newest at the top.

Every 20 entries, the PM session turns the newest 20 into a **draft playbook chapter** (a few pages of prose organizing them into a teachable arc) and files it on the Board as an `owner: brooks` review item. The Learn Log is raw material for a sellable engineering/design playbook — Digital Products stream, Income Ladder rung 3. Treat it as product inventory, not a diary: Brooks learns routinely, and the byproduct compounds into something sellable.

**Resurface, don't just archive.** Each ENGINEERING, DESIGN, and STUDIO session *opens* by re-reading one prior Learn Log entry (the oldest not yet resurfaced, marking it as you go) and stating in one line whether and where it applies to today's work. Learning that is never re-encountered isn't learning — it's storage. This costs two sentences and turns the log into spaced repetition.

---

### Creator Ledger (life lanes — track, don't do)

Alongside the Board, keep a lightweight **Creator Ledger** with lanes: **Film**, **Body**, **Art**, **Science**. Same home as the Board (Notion database or agent memory). The agent cannot film cliff jumps or do Brooks's pullups — items here are never `owner: agent` for the human act itself. What the agent CAN do, and should propose as normal PR work when a lane stalls, is build the supporting infrastructure: a `/training` progression tracker (dunk/pullups — clone the `education-tracker` pattern; also a sellable micro-tool), a `/films` pre-production page (shot lists, an extreme-sports location-scouting database), a `/studio` gallery for art pieces. One line per lane in the PM brief at most; the point is that the lanes never silently disappear, not that they generate homework.

---

### Notion Integration (if connected)

When Notion MCP is available:
- PM briefs → "Weekly Dev Briefs" database, one entry per Wednesday
- Engineering PRs → append a one-line summary to "Shipped This Week" page
- Design PRs / Studio pieces → append a one-line summary to "Shipped This Week" page
- Learn lines → append to the "Learn Log" page (see Learn Log section)
- Creator Ledger lanes (Film / Body / Art / Science) → a section of the Board, one row per lane
- **The Board is a Claude Doc** (see Board & Session Memory), not a Notion database. Don't create an "Open Recommendations" database; an existing one is history.

Keep Notion entries lean. They are for Brooks to skim, not read.

---

### Income Ladder (after hiring readiness)

Until Brooks accepts an offer, Rung 1, portfolio signal that gets him hired, comes first (Hiring
Readiness, Level Intention). Paid rungs (SaaS tiers, digital products, premium game features) are
shelved until there is income (Global Rules). Consulting stays a link on the Work page, not a funnel.
