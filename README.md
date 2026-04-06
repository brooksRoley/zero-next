# Brooks Roley — Portfolio

Personal portfolio and project showcase built with Next.js, TypeScript, and Tailwind CSS.

**Live pages:**

- `/` — Landing page with project cards and connect links
- `/resume` — Resume with PDF download and an interactive Mario "?" block easter egg
- `/posts/pente` — Playable 2-player Pente board game (19×19, captures, five-in-a-row, bot, tutor, post-game analysis)
- `/posts/luminous-flow` — Interactive fluid art with curl noise and particle physics
- `/posts/nanu-pika-td` — Tower defense game with cat wizard towers and ant waves
- `/posts/basketball-tactics` — Lakers Tactics iOS SwiftUI app showcase
- `/education-tracker` — AWS GenAI Developer certification study roadmap
- `/zero-paradox` — Zero Paradox LLC brand page with Stripe, PayPal, and Venmo payment integration

## Tech Stack

- **Framework:** Next.js 16 (Pages Router), React 18, TypeScript
- **Styling:** Tailwind CSS with custom `forest`, `candy`, and `void` color palettes
- **Animations:** CSS keyframes, 3D cursor-tracking tilt cards (`TiltCard`), scroll-triggered reveals (`Reveal`), `canvas-confetti`, canvas particle systems (`PreText`, `LuminousFlow`)
- **Node:** 24.x

## Getting Started

```bash
yarn install
yarn dev          # http://localhost:3000
yarn build        # Production build
yarn lint         # ESLint
```

## Payment Setup (Zero Paradox LLC)

Add these to `.env.local` to activate the payment page:

```
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...   # dashboard.stripe.com → Payment Links (set "customer chooses price")
NEXT_PUBLIC_PAYPAL_ME=your-username                           # paypal.me handle
NEXT_PUBLIC_VENMO_HANDLE=your-handle                          # Venmo @handle (without @)
```

## Project Structure

```
src/
├── pages/
│   ├── index.tsx                  # Landing page
│   ├── resume.js                  # Resume + MarioButton
│   ├── zero-paradox.jsx           # Zero Paradox LLC brand + payments
│   ├── education-tracker.jsx      # AWS GenAI study tracker
│   ├── posts/
│   │   ├── pente.js               # Pente board game (bot, tutor, multiplayer)
│   │   ├── luminous-flow.jsx      # Fluid art canvas
│   │   ├── nanu-pika-td.jsx       # Tower defense game
│   │   └── basketball-tactics.jsx # Lakers Tactics iOS showcase
│   └── api/
│       ├── pente/                 # Multiplayer game API (Supabase)
│       └── search.js              # Studio/stage availability filter
├── components/
│   ├── PreText.jsx            # Canvas-animated text (flow / pulse / fill modes)
│   ├── TiltCard.tsx           # 3D cursor-tracking hover card
│   ├── Reveal.jsx             # IntersectionObserver scroll animation
│   ├── NavHeader.jsx          # Sticky nav with mobile menu
│   ├── GameLobby.jsx          # Pente multiplayer lobby
│   ├── MultiplayerStatus.jsx  # Pente online game status bar
│   ├── PentePlayerbot.js      # Pente AI opponent
│   ├── PenteTutor.js          # Pente move evaluation + hints
│   ├── Scoreboard.js          # Pente scoreboard
│   └── mario.js               # Confetti "?" block button
└── styles/
    ├── globals.css            # Tailwind + tilt card hover system
    └── GameBoard.css          # Pente board, stones, keyframe animations
```

## CI/CD

Every PR runs three required checks before merge:

| Check | What it does | Blocks merge? |
|---|---|---|
| **Lint** | `next lint` — ESLint across all pages/components | Yes |
| **Build** | `next build` — TypeScript + import errors | Yes |
| **Test** | `vitest run` — Pente game logic unit tests | Yes |
| **Lighthouse** | Audits 6 pages: perf / a11y / SEO / best-practices | a11y + SEO error; others warn |

### GitHub Secrets required

Add these at **Settings → Secrets → Actions**:

```
NEXT_PUBLIC_SUPABASE_URL        # from .env.local
NEXT_PUBLIC_SUPABASE_ANON_KEY   # from .env.local
NEXT_PUBLIC_STRIPE_PAYMENT_LINK # optional — build passes without it
NEXT_PUBLIC_PAYPAL_ME           # optional
NEXT_PUBLIC_VENMO_HANDLE        # optional
LHCI_GITHUB_APP_TOKEN           # from https://github.com/apps/lighthouse-ci
```

### Running tests locally

```bash
yarn test              # run once
yarn test:watch        # interactive watch mode
yarn test:coverage     # with v8 coverage report
```

Tests live in `src/lib/pente/__tests__/gameLogic.test.js`. Add new tests alongside the logic they cover.

### Lighthouse CI locally

```bash
npx @lhci/cli autorun  # requires yarn build first
```

Thresholds are in `lighthouserc.js`. Performance is a warning (canvas-heavy pages); accessibility and SEO are hard errors.
