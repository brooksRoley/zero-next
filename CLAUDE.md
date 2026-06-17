# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start development server on localhost:3000
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint directly (not next lint — Next.js 16 broke it)
```

There are no tests configured in this project.

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

### Role Schedule (check with `date +%u`)

| Day number | Day | Role |
|---|---|---|
| 1, 4 | Mon, Thu | ENGINEERING |
| 2, 5 | Tue, Fri | DESIGN |
| 3 | Wed | PM / PRODUCT |

---

### Global Rules

- Scan the repo with Glob and selective Read before doing anything. Be token-efficient — do not read every file blindly.
- Produce exactly **ONE PR per session**. One complete, working PR beats several shallow ones.
- Write complete code — no TODOs, no placeholders, no stub functions.
- Every PR must map to at least one livelihood stream (label it clearly in the PR body).
- Attempt `git checkout -b [branch] && git add -A && git commit -m "[title]" && gh pr create` to push and open the PR. If auth fails, output the full PR as a plaintext artifact Brooks can apply manually.
- Keep total token use lean: skip lengthy preamble, get to the work.

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

### DESIGN Role (Tue / Fri)

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

### PM Role (Wed)

No code changes. Write a weekly brief — under 500 words total — that functions as a real product strategy memo:

1. **Shipped** — what changed this week based on recent repo state
2. **Livelihood audit** — for each stream (SaaS / Consulting / Games / Digital Products), one sentence on current state and one concrete next action
3. **Top 3 priorities** for next sprint, ranked by passive income potential × effort ratio
4. **Skill gaps** — one engineering gap and one design gap to address
5. **Validation question** — one specific hypothesis about a revenue stream Brooks could test this week without writing code (e.g. tweet it, post it, DM someone)
6. **Token tip** — one specific way to make these daily agent runs more efficient
7. **Cost vs value** — estimate sessions run this week, approximate token cost, and what concrete livelihood or portfolio value was produced

Also post this brief to Notion (if connected) under a "Weekly Dev Briefs" page, dated with today's date.

---

### Notion Integration (if connected)

When Notion MCP is available:
- PM briefs → "Weekly Dev Briefs" database, one entry per Wednesday
- Engineering PRs → append a one-line summary to "Shipped This Week" page
- Design PRs → append a one-line summary to "Shipped This Week" page

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