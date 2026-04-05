# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start development server on localhost:3000
yarn build      # Build for production
yarn start      # Start production server
yarn lint       # Run ESLint via next lint
```

There are no tests configured in this project.

## Architecture

Personal portfolio site built with Next.js 13 (Pages Router), TypeScript, Tailwind CSS, and `canvas-confetti`.

### Pages
- `/` (`src/pages/index.tsx`) — Landing page with card links to Resume, LinkedIn, GitHub, Calendly, and the Pente game
- `/resume` (`src/pages/resume.js`) — Resume page with PDF download link and the interactive MarioButton
- `/posts/pente` (`src/pages/posts/pente.js`) — Playable 2-player Pente board game (19×19 grid, capture/five-in-a-row win conditions)

### Components
- `src/components/mario.js` — Animated Mario "?" block button that triggers confetti and randomized CSS animations
- `src/components/Scoreboard.js` — Scoreboard display used by the Pente game
- `src/components/layout.js` — Minimal container wrapper (not widely used)

### API Routes
- `src/pages/api/search.js` — Filters `stage_data.json` (not in repo) by location and date range; used for studio/stage availability lookup
- `src/pages/api/posts.js` — Posts API (unused/in-progress)
- `src/pages/api/hello.ts` — Default Next.js example route

### Styling
- Tailwind CSS is primary; `src/styles/globals.css` has global resets and the `.cover-photo` background utility
- `src/styles/GameBoard.css` has game-specific styles and the keyframe animations (`shake`, `mario-jump`, `float`, etc.) used by MarioButton and the Pente board
- The resume page uses `.cover-photo` which sets `covertitle.jpg` as background

### Component imports
Internal components use the `src/` path alias (e.g., `import ScoreBoard from 'src/components/Scoreboard.js'`), configured in `tsconfig.json`.

### Public assets
Resume PDF is at `public/Brooks_Roley.pdf` (served as `/Brooks_Roley.pdf`).

---

## Daily Agent Instructions

This section is for the scheduled remote dev agent that runs every weekday.

### Owner Profile

- **Name:** Brooks Roley — full-stack engineer, frontend lean
- **Stack:** React, TypeScript, Next.js, SwiftUI, Tailwind, Node.js, PostgreSQL
- **Site:** brooksroley.com (this repo — Next.js + Supabase + Vercel)
- **iOS project:** BasketballTactics (SwiftUI + MVVM + balldontlie.io NBA API, Lakers colors #552583 purple / #FDB927 gold)
- **Career goal:** Senior engineering roles in sports tech; actively targeting LA Lakers Software Developer - Basketball Data Strategy
- **Growth mindset:** Wants concrete, encouraging feedback. Identifies gaps and learns from each PR.

### Role Schedule (check with `date +%u`)

| Day number | Day    | Role        |
| ---------- | ------ | ----------- |
| 1, 4 | Mon, Thu | ENGINEERING |
| 2, 5 | Tue, Fri | DESIGN |
| 3 | Wed | PM / PRODUCT |

### Global Rules

- Scan the repo with Glob and selective Read before doing anything. Be token-efficient — do not read every file blindly.
- Produce exactly ONE PR per session. One complete, working PR beats several shallow ones.
- Write complete code — no TODOs, no placeholders, no stub functions.
- Attempt `git checkout -b [branch] && git add -A && git commit -m "[title]" && gh pr create` to push and open the PR. If auth fails, output the full PR as a plaintext artifact Brooks can apply manually.
- Keep total token use lean: skip lengthy preamble, get to the work.

### ENGINEERING Role (Mon / Thu)

Find the single highest-value code improvement. Priority order:

1. NBA / sports data features (depth of stats, projections, data viz)
2. TypeScript strictness (strict null checks, proper generics)
3. Performance (bundle size, Core Web Vitals, lazy loading)
4. Accessibility (WCAG AA contrast, focus states, ARIA)
5. Code quality / refactoring

Avoid purely cosmetic changes and anything requiring secrets you do not have.

Output format — start with `ENGINEERING PR`, then include:

- Branch: `feat/[descriptive-name]`
- Title: concise PR title
- Why: 1-2 sentences on growth value for Brooks
- Files changed: list
- Code: complete unified diff or full new file contents
- Test steps: how to verify it works locally
- Learn: one concrete technical concept or pattern Brooks should study

### DESIGN Role (Tue / Fri)

Find the single highest-value visual or UX improvement. Priority order:

1. Component polish and animation refinement
2. Responsive layout gaps (mobile breakpoints)
3. Dark-forest Tailwind palette consistency (`forest-*` colors, candy-pink accents)
4. Loading, error, and empty state design
5. Accessibility (contrast ratios, focus ring visibility)

Avoid full redesigns or breaking the existing visual identity.

Output format — start with `DESIGN PR`, then include:

- Branch: `design/[descriptive-name]`
- Title: concise PR title
- Why: 1-2 sentences
- Files changed: list
- Code: complete diff or new file contents
- Visual: plain-English description of how it looks and feels when rendered
- Learn: one design principle or UI pattern for Brooks to internalize

### PM Role (Wed)

No code changes. Write a weekly brief under 400 words total:

1. **Shipped** — what changed this week based on recent repo state
2. **Top 3 priorities** for next sprint, ranked by impact vs effort
3. **Skill gaps** — one engineering gap and one design gap to address
4. **Token tip** — one specific way to make these daily agent runs more efficient
5. **Cost vs value** — estimate sessions run this week, approximate token cost, and what concrete portfolio value was produced
