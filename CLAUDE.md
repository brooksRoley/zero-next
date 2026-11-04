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

Personal portfolio platform built with Next.js 16 (Pages Router), TypeScript, Tailwind CSS, and `canvas-confetti`.

### Pages

The Pages Router has grown well past the original handful of routes; below is the current map grouped by purpose.

**Portfolio / funnel**
- `/` (`src/pages/index.tsx`) — Quiet landing page (2026-11-03): name, role, availability, the AI note and one row of mono links (resume, hardwood, basketball, work, GitHub, LinkedIn, email) over a faint ridgeline field (`src/components/QuietField.tsx`). Light by default, dark toggle remembered per browser; the site nav is hidden on `/` only (`_app.tsx`)
- `/consulting` (`src/pages/consulting.tsx`) — **Work**: the work by domain (robotics, sustainability, healthcare, finance, insurance, ecology) and the computer science behind the games. No prices, no form, no sticky CTA (2026-10-23). `/api/consulting/leads` and `/checkout` remain but nothing on the site calls them
- `/intake` (`src/pages/intake.jsx`) — Contact: email, LinkedIn and Calendly links only. Nothing is uploaded or stored (see Security & privacy)
- `/funding` — **retired 2026-10-23** (redirects to `/`). No tip jar, no "support development" links, no mention of AI tokens or server bills. The replacement is `src/components/UpdatesCard.tsx`, a brief, optional, one-time "want a note when something new goes up?" card, and it is **switched off** (`UPDATES_CARD_ENABLED = false`). Do not re-add a tip jar, a funding route or a money ask on any page; `src/lib/__tests__/noTipJar.test.ts` fails if one comes back. Turning the card on is the owner's call.
- `/basketball-platform` (`src/pages/basketball-platform.jsx`) — Case-study showcase for the Basketball Data Platform project
- `/resume` (`src/pages/resume.js`) — The resume as real text (summary, experience, skills, education) rendered from `src/lib/resume.ts`, plus the PDF download link and the BallButton easter egg (the site's basketball mascot). `src/lib/__tests__/resume.test.ts` guards the wording
- `/theater` (`src/pages/theater.tsx`) — "The Zero Theater": gallery/landing that stages every game on the site as framed productions (its `REPERTORY` list is one of three route lists that must stay in sync — see NavHeader note). Its **Experimental** section holds Cloudfall, backstage: an opt-in, click-through CSS-grid overlay of Cloudfall played with W A S D + Space over the Theater (`src/components/games/cloudfall/BackstageBlocks.tsx`, pure rules in `src/lib/games/cloudfall/backstage.ts`). Off by default, never remembered, Esc closes it; arrow keys still scroll

**Private / admin** (gated — see Authentication)
- `/login` (`src/pages/login.tsx`) — Password gate for the private dashboard; POSTs to `/api/auth/login`
- `/tracker` (`src/pages/tracker.jsx`) — Private owner dashboard; protected by `src/proxy.ts`
- `/admin/leads` (`src/pages/admin/leads.tsx`) — Admin view of captured consulting leads (also gated by `src/proxy.ts`)
- `/admin/analytics` (`src/pages/admin/analytics.tsx`) — Admin analytics dashboard over first-party `/api/events` data (also gated by `src/proxy.ts`). Leads with "who stops by": weekly scorecard, visitors, resume views and PDF downloads, recent visits, referrers, locations, devices and games played (`src/lib/visitorStats.ts`, `src/components/admin/VisitorSections.tsx`)
- `/zero-paradox`, `/education-tracker`, `/digital-products` — unfinished pages, gated by `src/proxy.ts` since 2026-10-07 (`/stat-galaxy` joined them 2026-10-20: its public heading read "Prototype") and unlinked from public chrome (an entity that does not exist, a personal tracker that reads 0% to visitors, a storefront for an unwritten PDF). To publish one: finish it, remove its `matcher` entry, and add it back to `src/lib/routes.ts`. `src/lib/__tests__/hiringReadiness.test.ts` guards this

**NBA / sports tech**
- `/basketball` (`src/pages/basketball.tsx`) — The one home for every basketball game, tool and case study (data in `src/lib/basketballHub.ts`, routes flagged `basketball: true` in `src/lib/routes.ts`). The nav has one Basketball item; `basketballHub.test.ts` fails if a flagged route is missing from the hub
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
- `/games/cloudfall` (`src/pages/games/cloudfall.tsx`) — Cloudfall: an original falling-block game (WASD + space) over a layered ridge-and-sky backdrop. Rules live in `src/lib/games/cloudfall/engine.ts` (pure, tested); drawing in `src/components/games/cloudfall/`. Design note: `docs/cloudfall.md`. Best score stays in this browser
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
- `src/components/TiltCard.tsx` — Cursor-tracking 3D tilt card with radial glow border and specular highlight (not currently on a page; kept as an instrument)
- `src/components/Reveal.jsx` — Scroll-triggered reveal animation wrapper
- `src/components/BallButton.jsx` — The resume's easter egg: the basketball mascot (`public/BRBaller.png`) bounces and throws confetti. Site imagery is Brooks's own; no borrowed franchise art

**Visual / hero**
- `src/components/PhysicsField.tsx` — Physics-driven particle/field layout (not currently on a page; kept as an instrument)
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
- `src/pages/api/tools/rig-report.ts` — GET: assembles the daily case file for `/tools/rig-report`. Reads Neon odds/predictions first; refreshes one Odds API snapshot into `rig_report_cache` only when `ODDS_API_KEY` is set and the cache is over 6 hours old; with no key and no data it serves labeled `demo` fixtures. Rate-limited 30 / 10 min per IP. The analysis is pure and lives in `src/lib/rig/`

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

Payment work is paused. The consulting checkout
(`api/consulting/checkout.ts`, `webhook.ts`) runs on test keys, verifies webhook signatures and returns
503 without keys. When it resumes: restricted live keys in Vercel only, saved Price IDs via the
`STRIPE_PRICE_*` env vars, register the webhook, test before live.

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
Premium puzzle and competitive tiers are shelved. Build the free game to be worth returning to.

### Styling
- Tailwind CSS is primary; `src/styles/globals.css` has global resets and the `.terrain-*` backgrounds the home and resume pages share
- `src/styles/GameBoard.css` has game-specific styles and keyframe animations used by BallButton and the Pente board
- Resume page uses `.terrain-page-bg` with Brooks's signature (`public/BRLogoTransparent.png`) as a faint watermark

### Component imports
Internal components use the `src/` path alias (e.g., `import ScoreBoard from 'src/components/Scoreboard.js'`), configured in `tsconfig.json`.

### Public assets
Resume PDF is at `public/Brooks_Roley.pdf` (served as `/Brooks_Roley.pdf`). It is **built** from `src/lib/resume.ts` by `yarn resume:pdf` (`scripts/build-resume-pdf.ts`, headless Chrome) — never hand-edited or exported from another document. Change the data, rebuild, commit both.

---

## Security & privacy

These rules outrank any product goal.

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
- **Personal details:** publish only what the resume and home page already show
  (name, region, email, LinkedIn, GitHub, this site). Never a phone number,
  address, birth date, ID or account numbers, or health or family details.
- **Secrets** live in Vercel env and the gitignored `.env.local` only. Never in
  code or PR bodies. When payment work resumes: restricted
  keys, verified webhook signatures, test before live.
- **Errors don't leak internals.** API routes return a generic message to
  the client and log the detail server-side.

## Owner routine

The owner's scheduled-agent instructions (roles, cadence, board) are kept privately, outside this repo.
