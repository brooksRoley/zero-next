# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start development server on localhost:3000
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint directly (not next lint — Next.js 16 broke it)
yarn test       # Run the vitest suite once (~338 tests as of 2026-07)
yarn test:watch # Vitest in watch mode
```

Tests are vitest, colocated in `__tests__` directories under `src/`. The suite must be green before any PR — and "green" means pasted command output with real counts, not an assertion. (This file once claimed the project had no tests while 338 existed; distrust doc claims you haven't re-verified.)

## Architecture

Personal portfolio + livelihood platform built with Next.js 13 (Pages Router), TypeScript, Tailwind CSS, and `canvas-confetti`.

### Pages

The Pages Router has grown well past the original handful of routes; below is the current map grouped by purpose.

**Portfolio / funnel**
- `/` (`src/pages/index.tsx`) — Landing page with TiltCard links out to projects, tools, games, resume, and consulting
- `/consulting` (`src/pages/consulting.tsx`) — Consulting funnel: service tiers, DB-backed lead capture (with UTM + referrer attribution), Stripe Checkout deposit flow, Calendly integration
- `/intake` (`src/pages/intake.jsx`) — Contact / intake form that feeds the consulting funnel
- `/funding` (`src/pages/funding.tsx`) — "Support Brooks Roley" tip-jar / funding page
- `/zero-paradox` (`src/pages/zero-paradox.jsx`) — Zero Paradox LLC landing/brand page
- `/basketball-platform` (`src/pages/basketball-platform.jsx`) — Case-study showcase for the Basketball Data Platform project
- `/resume` (`src/pages/resume.js`) — Resume page with PDF download link and the interactive MarioButton
- `/education-tracker` (`src/pages/education-tracker.jsx`) — Personal certification-exam (AIF-C01) study progress tracker

**Private / admin** (gated — see Authentication)
- `/login` (`src/pages/login.tsx`) — Password gate for the private dashboard; POSTs to `/api/auth/login`
- `/tracker` (`src/pages/tracker.jsx`) — Private owner dashboard; protected by `src/middleware.ts`
- `/admin/leads` (`src/pages/admin/leads.tsx`) — Admin view of captured consulting leads

**NBA / sports tech**
- `/nba` (`src/pages/nba.tsx`) — NBA API Explorer: players, teams, standings, predictions
- `/stat-galaxy` (`src/pages/stat-galaxy.tsx`) — "Stat Galaxy" NBA physics-based stat visualizer
- `/tools/nba-accuracy` (`src/pages/tools/nba-accuracy.tsx`) — Prediction-accuracy dashboard (ATS cover rate, model vs Vegas, break-even line)
- `/posts/basketball-tactics` (`src/pages/posts/basketball-tactics.jsx`) — Showcase for the Lakers Tactics iOS app

**AI tools**
- `/tools/chat` (`src/pages/tools/chat.tsx`) — Chat Sandbox: build a cast of AI characters with per-character models/roles and watch them interact
- `/tools/model-arena` (`src/pages/tools/model-arena.tsx`) — Model Arena: side-by-side LLM comparison

**Games**
- `/posts/pente` (`src/pages/posts/pente.js`) — Pente game with multi-player modes (1v1, vs Bot, vs 3 Bots FFA, 2v2 Bots), minimax AI engine via Web Worker, ELO tracking, touch UX
- `/posts/pente-puzzles` (`src/pages/posts/pente-puzzles.js`) — Puzzle trainer: curated catalog + Endless mode with runtime puzzle generation, canvas physics transitions, ELO-adaptive difficulty, mountain-climbing progress metaphor
- `/posts/go` (`src/pages/posts/go/`) — Go game: `index.js` (play), `learn.js` + `learn/[stage].js` (tutorial stages), `puzzles/index.js` + `puzzles/[id].js` (puzzle trainer)
- `/posts/nanu-pika-td` (`src/pages/posts/nanu-pika-td.jsx`) — Nanu & Pika tower-defense game (pathfinding, wave logic, upgrades)

**Misc / experiments**
- `/posts/guestbook` (`src/pages/posts/guestbook.tsx`) — Collaborative guest book: rubric-based ad-lib story prompt builder with typography picker, writes to Neon Postgres
- `/posts/luminous-flow` (`src/pages/posts/luminous-flow.jsx`) — Interactive generative/physics visual piece
- `/posts/first-post` (`src/pages/posts/first-post.js`), `/posts/post-form` (`src/pages/posts/post-form.jsx`) — Early blog scaffolding (in-progress)

### Database (Neon Postgres)
- Connection: `src/lib/db.ts` exports `sql` via `@neondatabase/serverless`
- **Tables:** `users`, `rubrics`, `elements`, `pages`, `page_elements` (guest book schema), `leads`, `checkout_sessions` (consulting funnel)
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
- `src/pages/api/intake/messages.js`, `src/pages/api/intake/send.js` — Intake-form message thread (list / send)

**AI tools**
- `src/pages/api/tools/ai-gateway.ts` — POST: unified LLM gateway. Routes a chat request to a selected provider/model via the Vercel AI SDK (OpenRouter / OpenAI-compatible providers in `src/lib/ai-providers/`). Rate-limited 10/hr per IP. Backs the Chat Sandbox and Model Arena.
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
- `src/pages/api/events.ts` — POST: lightweight first-party analytics event ingest (rate-limited)
- `src/pages/api/db-health.ts` — GET: Postgres connection health check
- `src/pages/api/search.js` — Filters `stage_data.json` by location/date range; studio/stage availability lookup
- `src/pages/api/posts.js` — Posts API (unused/in-progress)
- `src/pages/api/hello.ts` — Default Next.js example route

### Authentication

There are two independent auth layers. Neither uses a third-party auth provider — both are env-var secrets, sufficient for a single-owner site.

**1. Dashboard session (browser-facing).** Gates the private `/tracker` dashboard.
- `src/middleware.ts` runs on `/tracker` and `/tracker/:path*` (see its `matcher`). It reads the `tracker_session` cookie and redirects to `/login?from=...` unless the cookie equals `ADMIN_SESSION_TOKEN`.
- `/login` (`src/pages/login.tsx`) POSTs the password to `src/pages/api/auth/login.ts`, which checks `ADMIN_PASSWORD` and, on success, sets the `tracker_session` HttpOnly cookie to `ADMIN_SESSION_TOKEN` (7-day Max-Age, `Secure` in production). Brute force is throttled to 5 attempts / 15 min per IP via `src/lib/rate-limit.ts`.
- `src/pages/api/auth/logout.ts` clears the cookie.
- Env vars: `ADMIN_PASSWORD` (what the user types), `ADMIN_SESSION_TOKEN` (the cookie value the middleware compares against).

**2. Admin / cron API token (machine-facing).** Protects write/ingest API routes that mutate the DB or hit paid third-party APIs.
- Pattern: each handler verifies `req.headers["x-admin-key"] === process.env.ADMIN_KEY` (manual calls) and/or `req.headers.authorization === \`Bearer ${process.env.CRON_SECRET}\`` (Vercel Cron). Unauthorized requests get `401` before any work runs.
- Routes using this: `api/nba/admin/ingest.ts` (both), `api/nba/admin/setup.ts` (`ADMIN_KEY`), `api/nba/admin/simulate.ts` (`ADMIN_KEY`), `api/nba/predictions/settle.ts` (both).
- Env vars: `ADMIN_KEY` (manual admin calls), `CRON_SECRET` (Vercel Cron's `Authorization` header).

When adding a new admin/cron endpoint, reuse the `x-admin-key`/`CRON_SECRET` check above — do **not** introduce a new secret. When adding a new private *page*, extend the `matcher` in `src/middleware.ts` rather than rolling per-page auth.

### Stripe — Shipping Checklist (Pre-Launch)

The consulting funnel (`/consulting`) has Stripe Checkout wired up but is currently using **test keys**. Before going live:

1. **Create the Product in Stripe Dashboard**
   - Go to dashboard.stripe.com → Products → + Add product
   - Create three products matching the service tiers: "Strategy Session" ($150), "Dev Sprint" ($2,400/week deposit), "Fractional CTO" ($4,000/month deposit)
   - The checkout API at `src/pages/api/consulting/checkout.ts` currently uses ad-hoc `price_data` (no saved Product/Price IDs). Once products exist in the dashboard, refactor to use `price: 'price_XXXX'` instead of inline `price_data` for cleaner reporting and Stripe Tax support.

2. **Switch to Live Keys**
   - In Stripe Dashboard → Developers → API keys, copy the **live** secret key and publishable key
   - Set in Vercel environment variables (NOT `.env.local` for production):
     - `STRIPE_SECRET_KEY=sk_live_...`
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - Keep test keys in `.env.local` for local dev; Vercel env vars override for production

3. **Private Key Management**
   - `STRIPE_SECRET_KEY` is server-only (no `NEXT_PUBLIC_` prefix) — never exposed to the browser
   - The checkout API validates the key is present and returns 503 if missing/placeholder
   - For production: set `STRIPE_SECRET_KEY` in Vercel → Settings → Environment Variables → Production only
   - Rotate keys periodically via Stripe Dashboard → Developers → API keys → Roll key
   - Never commit live keys to the repo; `.env*.local` is gitignored

4. **Webhook for Payment Confirmation** (next agent should build this)
   - Create `src/pages/api/consulting/webhook.ts` to handle `checkout.session.completed` events
   - Verify webhook signature using `STRIPE_WEBHOOK_SECRET` env var
   - Update `checkout_sessions.status` from 'pending' → 'paid' in the DB
   - Optionally send a notification (email or Slack) when a deposit lands

5. **Post-Launch Hardening**
   - Add rate limiting to `/api/consulting/leads` to prevent spam
   - Add CSRF protection or honeypot field to the contact form
   - Consider Stripe Customer Portal for managing recurring fractional CTO billing
   - The `leads` table `status` column supports a pipeline: 'new' → 'contacted' → 'qualified' → 'converted' → 'closed'

### Pente Game Platform

The Pente game (`/posts/pente`, `/posts/pente-puzzles`) is the site's flagship game product, with a roadmap to paid tiers via Stripe.

#### Architecture Decisions (locked)
- **Supabase for ALL game state** — player profiles, ELO, puzzle bank, game history, multiplayer realtime. Supabase client is at `src/lib/supabase.ts`. The `games` table and realtime channels already exist there.
- **localStorage as offline cache only** — `usePlayerProfile` is Supabase-first, with localStorage as the offline fallback. New features should write to Supabase first, cache locally second.
- **Neon Postgres is for the business side** (leads, consulting, guestbook). Do NOT put game data in Neon.
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

#### Monetization Roadmap (Pente → Stripe)
The puzzle system is the monetization path. Model: freemium with tip-jar and premium tiers.

| Phase | What | Revenue |
|---|---|---|
| **Free tier (now)** | Curated puzzles, Endless mode, bot play, ELO tracking | Dwell time, audience building |
| **Tip jar (next)** | "Buy me a coffee" after solve streaks, donate to keep servers running | One-time tips via Stripe |
| **Premium puzzles** | Daily challenge puzzles, leaderboard, puzzle history/replay, export stats | $5-9/mo Stripe subscription |
| **Competitive tier** | Ranked matchmaking, seasonal ELO resets, tournament brackets, profile badges | $9-15/mo Stripe subscription |

When building puzzle/game features, always ask: *does this make the free tier sticky enough to convert, or does this belong behind the premium gate?* Free should be generous. Premium should feel like "I want more of this."

### Styling
- Tailwind CSS is primary; `src/styles/globals.css` has global resets and `.cover-photo` background utility
- `src/styles/GameBoard.css` has game-specific styles and keyframe animations used by MarioButton and Pente board
- Resume page uses `.cover-photo` which sets `covertitle.jpg` as background

### Component imports
Internal components use the `src/` path alias (e.g., `import ScoreBoard from 'src/components/Scoreboard.js'`), configured in `tsconfig.json`.

### Public assets
Resume PDF is at `public/Brooks_Roley.pdf` (served as `/Brooks_Roley.pdf`).

---

## Daily Agent Instructions

This section drives the scheduled remote dev agent that runs every weekday at 8:47am PT.

---

### Owner Profile

- **Name:** Brooks Roley — full-stack engineer, frontend lean
- **Stack:** React, TypeScript, Next.js, SwiftUI, Tailwind, Node.js, PostgreSQL
- **Site:** brooksroley.com (this repo — Next.js + Vercel)
- **iOS project:** BasketballTactics (SwiftUI + MVVM + balldontlie.io NBA API, Lakers colors #552583 purple / #FDB927 gold)
- **Career goal:** Senior engineering roles in sports tech; actively targeting LA Lakers Software Developer - Basketball Data Strategy
- **Growth mindset:** Wants concrete, encouraging feedback. Identifies gaps and learns from each PR.

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

- **Read the Open Recommendations Ledger first** (see the section below). It is the routine's memory across sessions — it tells you what's already been recommended, what shipped, and what's blocked on Brooks. Choose work from open, agent-doable items before inventing something new.
- Scan the repo with Glob and selective Read before doing anything. Be token-efficient — do not read every file blindly.
- **Read the analytics before choosing what to build.** First-party events now exist (`/api/events`, the `track()` helper). When picking work, query/inspect recent conversion data (which CTAs fire, which convert) and prioritize by evidence, not intuition. "Does this PR make money more likely?" is now partly measurable — measure it.
- Produce **one substantial PR per session, OR a bundle of small pre-specified items** the ledger has already greenlit as "ready to ship." One complete working PR beats several shallow ones — but don't let a queue of cheap, ready revenue wins starve for weeks because of a strict one-PR rule. Quality bar is unchanged: everything shipped must be complete and working.
- Write complete code — no TODOs, no placeholders, no stub functions.
- Every PR must map to at least one livelihood stream (label it clearly in the PR body).
- Attempt `git checkout -b [branch] && git add -A && git commit -m "[title]" && gh pr create` to push and open the PR. If auth fails, output the full PR as a plaintext artifact Brooks can apply manually.
- **Never strand work.** Every branch you push must end the session as an opened PR, or be deleted. A pushed branch with no PR is invisible to review — in July 2026 four such branches accumulated, one hiding a security fix for five days. If you cannot open the PR, log the branch name in the ledger as an explicit failure state so the next session recovers it.
- **Proof over claims.** PR bodies and briefs must paste actual command output — real test counts, real lint results — not assertions of green. (A past session claimed "281/281 passing" while the suite had been red for six weeks and the real count was 335.) If you didn't run it, say you didn't run it.
- **Log verification outcomes honestly.** If you build something user-facing, verify it (build, lint, and live-site check where possible). If verification is blocked (e.g., a 403 or missing secret), record that as an explicit failure state in the ledger — do not silently skip it. A blocker that recurs across sessions should escalate, not disappear.
- Keep total token use lean: skip lengthy preamble, get to the work.

---

### Open Recommendations Ledger & Session Memory

Each scheduled run starts cold with no memory of prior runs. Without a shared ledger, briefs repeat the same recommendations for weeks (e.g., "flip Stripe to live keys" led every brief for over a month because nothing tracked that it had already been said). This section fixes that.

**Where it lives:** the Notion "Open Recommendations" database if Notion is connected; otherwise the agent memory directory. Treat it as the single source of truth for cross-session state. Read it at session start, write to it at session end.

**Each ledger item carries:** a short title, `owner` (`agent` or `brooks`), `status` (`open` → `shipped` → `verified`, or `blocked`), `first_flagged` date, and `flagged_count`.

**Protocol every session:**

1. **Read the ledger first.** Do not re-derive analysis for items already in it — only add net-new items or transition existing ones.
2. **Separate agent-doable from human-blocked.** `owner: agent` items are yours to ship. `owner: brooks` items (Stripe Dashboard, env vars, writing a PDF, real testimonials, anything needing secrets you lack) are NOT yours — never burn a session re-analyzing them.
3. **Escalate, don't repeat.** When a `owner: brooks` item reaches `flagged_count` ≥ 3, stop writing paragraphs about it. Surface it as a single bold line at the very top of the output: **"Brooks — ~30 min, do this: <action>"** — then move on to work you can actually ship. Depth of analysis should correlate with the agent's ability to act, not inversely.
4. **Pick agent work from open items**, prefer those with analytics or ledger evidence of value.
5. **Write back on exit:** transition anything you shipped to `shipped`, add any new recommendations as `open`, increment `flagged_count` on anything you re-surfaced, and record verification results (including blocked checks).

**Weekly Unlock Session (calendar escalation).** Bold lines in briefs have proven insufficient — "flip Stripe to live keys" reached 8 flags without landing. The fix is the medium, not more flags. When Google Calendar is connected, the PM session maintains ONE recurring ~30-minute "Unlock Session" event on Brooks's calendar and rewrites its description each week with the top 3 `owner: brooks` items — each with a time estimate and exact click-by-click steps. Update the single event in place; never create a pile of new events. If Calendar is not available, put the same 3-item list at the very top of the PM brief under the heading **Unlock list (~30 min total)**. Ten minutes of Brooks unblocks weeks of agent output — this is the highest-leverage artifact the routine produces.

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
4. Dark-forest Tailwind palette consistency (`forest-*` colors, candy-pink accents)
5. Loading, error, and empty state design
6. Accessibility (contrast ratios, focus ring visibility)

Avoid full redesigns or breaking the existing visual identity.

**Livelihood lens:** Does the site currently make it obvious that Brooks is available for consulting? Is there a clear path from "visitor" to "paying customer" or "lead"? If not, that's the design problem to solve first.

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
3. **Every piece gets a frame.** Title, a one-paragraph artist note rendered on the page, and a tip-jar link (`/funding`). Art is the audience funnel, not a detour from it — this is Income Ladder rung 2 widened beyond games.
4. **Reuse the instruments.** `PhysicsField`, `WaterHero`, the canvas work in `luminous-flow`, the Web Worker pattern — reach for existing engines before writing new ones.
5. **Gallery index.** Pieces live at `/studio/[name]`. On the first STUDIO session, create `/studio` as a gallery page that lists all pieces (including back-linking the existing `/posts/luminous-flow`); every later piece adds itself to it.

Output format — start with `STUDIO PIECE`, then include:

- Branch: `studio/[descriptive-name]`
- Title: the piece's name
- Artist note: 2-3 sentences on what it is and why (this also ships on the page)
- Livelihood stream: Games/audience (tip-jar frame)
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
9. **Scorecard** — the same 4–5 numbers every week, with last week's value beside each: leads captured, tips/checkouts, game sessions (from `/api/events`), and **unlock burn rate** (median days-open of `owner: brooks` ledger items). Growth is a delta; snapshots hide stalls. The unlock burn rate is the health gauge of the human interface — the routine's proven bottleneck.
10. **Value lens** — examine the routine itself against ONE value, rotating weekly in order: **love → learning → growth → sustainability → excellence**. Two or three honest sentences: where did this week's work serve or betray that value? One value examined honestly beats five checked ritually.

The PM session **owns the Open Recommendations Ledger.** Reconcile it: mark shipped items `verified` (or back to `open` if a check failed), prune duplicates, and make sure every human-blocked item has an accurate `flagged_count`. The "Top 3 priorities" must be drawn from the ledger, and any `owner: brooks` item flagged ≥ 3 times goes at the very top as a single bold action line — not re-analyzed in prose. The PM session also **maintains the Weekly Unlock Session** calendar event (see the Ledger section) and runs the Learn Log chapter check (see Learn Log below).

Also post this brief to Notion (if connected) under a "Weekly Dev Briefs" page, dated with today's date.

---

### Quarterly Meta-Retro & Prompt Hygiene (first PM Wednesday of Jan / Apr / Jul / Oct)

The routine's instructions are themselves a codebase, and they decay like one — this file once claimed the project had no tests while 338 existed. Once a quarter, the PM session audits the routine instead of just running it:

1. **Name the failure class.** Read the ledger's session notes for the quarter and state, in one sentence, the recurring failure pattern (past examples: briefs repeating for lack of memory; escalation flags nobody saw; branches pushed without PRs).
2. **Propose ONE amendment.** Draft a single CLAUDE.md change that addresses it, as a PR for Brooks to review — never edit the routine's rules silently.
3. **Prune.** Delete or correct anything stale in this file: rules that no longer bind, facts the repo has outgrown, checklists already completed. Removing a dead rule is as valuable as adding a live one.

**The amendment rule (applies always, not just quarterly):** change the routine only on evidence — a named failure or a measured win, citable from the ledger, analytics, or git history. Never on vibes. Every rule added here costs tokens every session and dilutes attention on the rules that matter; unchecked accretion is a sustainability failure of the routine itself.

---

### Learn Log (compounding knowledge → product)

Every ENGINEERING, DESIGN, and STUDIO output ends with a "Learn" line. Those lines currently evaporate. Instead, **append each one to a running Learn Log** — a "Learn Log" page in Notion if connected, otherwise `LEARN_LOG.md` in the agent memory directory — dated, one line per entry, newest at the top.

Every 20 entries, the PM session turns the newest 20 into a **draft playbook chapter** (a few pages of prose organizing them into a teachable arc) and files it in the ledger as an `owner: brooks` review item. The Learn Log is raw material for a sellable engineering/design playbook — Digital Products stream, Income Ladder rung 3. Treat it as product inventory, not a diary: Brooks learns routinely, and the byproduct compounds into something sellable.

**Resurface, don't just archive.** Each ENGINEERING, DESIGN, and STUDIO session *opens* by re-reading one prior Learn Log entry (the oldest not yet resurfaced, marking it as you go) and stating in one line whether and where it applies to today's work. Learning that is never re-encountered isn't learning — it's storage. This costs two sentences and turns the log into spaced repetition.

---

### Creator Ledger (life lanes — track, don't do)

Alongside the Open Recommendations Ledger, keep a lightweight **Creator Ledger** with lanes: **Film**, **Body**, **Art**, **Science**. Same home as the main ledger (Notion database or agent memory). The agent cannot film cliff jumps or do Brooks's pullups — items here are never `owner: agent` for the human act itself. What the agent CAN do, and should propose as normal PR work when a lane stalls, is build the supporting infrastructure: a `/training` progression tracker (dunk/pullups — clone the `education-tracker` pattern; also a sellable micro-tool), a `/films` pre-production page (shot lists, an extreme-sports location-scouting database), a `/studio` gallery for art pieces. One line per lane in the PM brief at most; the point is that the lanes never silently disappear, not that they generate homework.

---

### Notion Integration (if connected)

When Notion MCP is available:
- PM briefs → "Weekly Dev Briefs" database, one entry per Wednesday
- Engineering PRs → append a one-line summary to "Shipped This Week" page
- Design PRs / Studio pieces → append a one-line summary to "Shipped This Week" page
- Learn lines → append to the "Learn Log" page (see Learn Log section)
- Creator Ledger lanes (Film / Body / Art / Science) → same database as Open Recommendations or a sibling database with the same columns
- **Open Recommendations Ledger → "Open Recommendations" database** (the cross-session memory from the Global Rules). Read at session start, reconcile at session end. If the database doesn't exist yet, create it with columns: Title, Owner (agent/brooks), Status (open/shipped/verified/blocked), First flagged (date), Flagged count (number), Notes. When Notion is not connected, keep the same ledger in the agent memory directory instead.

Keep Notion entries lean. They are for Brooks to skim, not read.

---

### Income Ladder (reference when choosing what to build)

Use this to prioritize features. Lower rungs are easier to ship; higher rungs generate more recurring revenue.

```
Rung 5 — SaaS ($9–$29/mo recurring)
         Micro-tools with auth + Stripe + usage limits

Rung 4 — Consulting ($150–$300/hr)
         Clear CTA, Calendly integration, case studies

Rung 3 — Digital Products ($15–$99 one-time)
         PDFs, templates, data sets, playbooks

Rung 2 — Games (ad revenue / tip jar / premium features)
         Dwell time → audience → monetization

Rung 1 — Portfolio signal (indirect — gets Brooks hired)
         NBA tools, TypeScript quality, sports tech work
```

When in doubt, build for the highest rung you can complete in one PR.
