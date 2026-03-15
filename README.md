# Brooks Roley — Portfolio

Personal portfolio and project showcase built with Next.js, TypeScript, and Tailwind CSS.

**Live pages:**

- `/` — Landing page with project cards and connect links
- `/resume` — Resume with PDF download and an interactive Mario "?" block easter egg
- `/posts/pente` — Playable 2-player Pente board game (19×19, captures, five-in-a-row)
- `/posts/luminous-flow` — Interactive fluid art with curl noise and particle physics
- `/posts/nanu-pika-td` — Tower defense game with cat wizard towers and ant waves

## Tech Stack

- **Framework:** Next.js 16 (Pages Router), React 18, TypeScript
- **Styling:** Tailwind CSS with custom `forest` and `candy` color palettes
- **Animations:** CSS keyframes, 3D cursor-tracking tilt cards (`TiltCard`), scroll-triggered reveals (`Reveal`), `canvas-confetti`
- **Node:** 24.x

## Getting Started

```bash
yarn install
yarn dev          # http://localhost:3000
yarn build        # Production build
yarn lint         # ESLint
```

## Project Structure

```
src/
├── pages/
│   ├── index.tsx              # Landing page
│   ├── resume.js              # Resume + MarioButton
│   ├── posts/
│   │   ├── pente.js           # Pente board game
│   │   ├── luminous-flow.jsx  # Fluid art canvas
│   │   └── nanu-pika-td.jsx   # Tower defense game
│   └── api/
│       └── search.js          # Studio/stage availability filter
├── components/
│   ├── TiltCard.tsx           # 3D cursor-tracking hover card
│   ├── Reveal.jsx             # IntersectionObserver scroll animation
│   ├── NavHeader.jsx          # Sticky nav with mobile menu
│   ├── mario.js               # Confetti "?" block button
│   └── Scoreboard.js          # Pente game scoreboard
└── styles/
    ├── globals.css            # Tailwind + tilt card hover system
    └── GameBoard.css          # Pente board, stones, animations
```

## Next Steps

### 1. Add page-level `<meta>` and Open Graph tags per project

Right now every page inherits the same generic OG title/description from `_app.tsx`. Each project page (Pente, Luminous Flow, Nanu & Pika TD) should have its own `og:title`, `og:description`, and `og:image` so that links shared on LinkedIn, Twitter, or Slack render with a relevant preview instead of the generic portfolio card. This is the single highest-leverage change for discoverability — it costs almost nothing to implement and directly increases click-through when someone shares your work.

### 2. Lighthouse performance pass on game pages

The Pente, Luminous Flow, and Nanu & Pika TD pages are heavy — large JS bundles, canvas rendering, and inline game logic. Running a Lighthouse audit and acting on the results (code-splitting with `next/dynamic`, lazy-loading game engines below the fold, deferring non-critical audio/assets) would meaningfully improve initial load time, especially on mobile. This matters because a slow-loading portfolio project undermines the impression you're trying to make.

### 3. Add a test foundation

There are no tests in the project. Starting with integration tests on the Pente game logic (win detection, capture mechanics, turn alternation) would be the highest-value entry point — it's pure logic with clear inputs/outputs, no UI mocking needed. A basic Jest or Vitest setup with 5-10 game logic tests would protect against regressions as you keep building and signal engineering rigor to anyone browsing the repo.
