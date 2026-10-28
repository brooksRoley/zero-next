# brooksroley.com

The portfolio of Brooks Roley, a full-stack software engineer with a front-end lean. Live at [brooksroley.com](https://www.brooksroley.com).

It holds the resume, sports-data tools, browser games and the engineering behind them. The site is built and maintained as a production codebase, with tests, CI and an accessibility gate on every change.

## Highlights

- **Resume** (`/resume`): rendered from `src/lib/resume.ts`. The PDF is built from the same data (`yarn resume:pdf`).
- **NBA tools**: a Salary Cap & Trade Machine, a stats explorer and a prediction pipeline (ingest → Monte Carlo simulation → settle → accuracy).
- **Games** (`/theater`): Pente with a minimax bot in a Web Worker and ELO ratings, Go with lessons and puzzles, and basketball puzzle games built on graph theory and game theory.
- **Basketball Data Platform** (`/basketball-platform`): a case study across a Python API, a C++ engine compiled to WebAssembly, a Vue 3 game and a SwiftUI app.

## Stack

Next.js 16 (Pages Router), React 18, TypeScript, Tailwind CSS, Neon Postgres, Supabase, and Vercel (hosting and cron).

## Development

```bash
yarn install
yarn dev     # http://localhost:3000
yarn test    # vitest
yarn lint    # eslint, zero warnings allowed
yarn build
```

Copy `.env.example` to `.env.local`. It documents every variable and which feature reads it.

## Quality gates

Every pull request runs:

| Check | Fails the PR when |
|---|---|
| Lint | any ESLint warning or error |
| Build | a TypeScript or import error |
| Test | any vitest test fails |
| Lighthouse | accessibility or SEO scores below 90; performance and best practices only warn |

Tests sit next to the code in `__tests__` folders. Some guard the site itself: every route in `src/lib/routes.ts` must resolve to a real page, and public pages may not carry placeholder copy.
