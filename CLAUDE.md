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
