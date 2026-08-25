/**
 * The single source of truth for every public route this site links to.
 *
 * Three surfaces used to keep their own hand-written copy of the route list —
 * NavHeader's NAV_LINKS, the landing page's TiltCard grid, and the Theater's
 * REPERTORY. Nothing tied them together, so a page could ship and stay
 * invisible in the nav (or the theater) until someone noticed by hand. That is
 * a silent conversion leak, not a cosmetic one: a route nobody can reach earns
 * nothing.
 *
 * Rules:
 * - Every internal `href` here must resolve to a real file under `src/pages`.
 *   `__tests__/routes.test.ts` enforces that, so a typo or a deleted page
 *   fails the suite instead of shipping a dead link.
 * - `label` is the canonical name. A surface that needs different wording
 *   overrides it locally (`{ ...route('nba'), label: 'League Lens' }`) rather
 *   than inventing a second href.
 * - Private, proxy-gated routes (`/tracker`, `/admin/*`, `/login`) are
 *   deliberately absent — they are never linked from public chrome, and
 *   listing them here would invite exactly that.
 */

export type RouteDef = {
  /** The path Next.js serves, or an absolute URL for external destinations. */
  href: string
  /** Canonical human label. Surfaces may override for their own voice. */
  label: string
  /** Absolute URLs: opened in a new tab, and skipped by the page-file check. */
  external?: true
}

const REGISTRY = {
  // ── Portfolio / funnel ──
  home: { href: '/', label: 'Home' },
  resume: { href: '/resume', label: 'Resume' },
  consulting: { href: '/consulting', label: 'Services' },
  intake: { href: '/intake', label: 'Contact' },
  funding: { href: '/funding', label: 'Support' },
  zeroParadox: { href: '/zero-paradox', label: 'Zero Paradox' },
  educationTracker: { href: '/education-tracker', label: 'Education Tracker' },
  digitalProducts: { href: '/digital-products', label: 'Digital Products' },

  // ── NBA / sports tech ──
  basketballPlatform: { href: '/basketball-platform', label: 'Basketball Data Platform' },
  nba: { href: '/nba', label: 'NBA Explorer — League Lens' },
  statGalaxy: { href: '/stat-galaxy', label: 'Stat Galaxy' },
  tradeMachine: { href: '/tools/trade-machine', label: 'Trade Machine' },
  rigReport: { href: '/tools/rig-report', label: 'The Rig Report' },
  nbaAccuracy: { href: '/tools/nba-accuracy', label: 'Prediction Accuracy' },
  basketballTactics: { href: '/posts/basketball-tactics', label: 'Lakers Tactics' },

  // ── AI tools ──
  chat: { href: '/tools/chat', label: 'Chat Sandbox' },
  modelArena: { href: '/tools/model-arena', label: 'Model Arena' },

  // ── Games ──
  theater: { href: '/theater', label: 'Theater — every game' },
  pente: { href: '/posts/pente', label: 'Pente' },
  pentePuzzles: { href: '/posts/pente-puzzles', label: 'Pente Puzzles' },
  go: { href: '/posts/go', label: 'Go' },
  goLearn: { href: '/posts/go/learn', label: 'Go — Learn' },
  goPuzzles: { href: '/posts/go/puzzles', label: 'Go Puzzles' },
  passAndCut: { href: '/games/pass-and-cut', label: 'Pass & Cut' },
  readAndReact: { href: '/games/read-and-react', label: 'Read & React' },
  hardwood: { href: '/games/hardwood', label: 'Hardwood Autochess' },
  moments: { href: '/games/moments', label: 'Playoff Moments' },
  nanuPikaTd: { href: '/posts/nanu-pika-td', label: 'Nanu & Pika TD' },

  // ── Misc / experiments ──
  guestbook: { href: '/posts/guestbook', label: 'Guestbook' },
  luminousFlow: { href: '/posts/luminous-flow', label: 'Luminous Flow' },

  // ── External ──
  github: { href: 'https://github.com/brooksroley', label: 'GitHub', external: true },
  linkedin: { href: 'https://www.linkedin.com/in/brooksroley/', label: 'LinkedIn', external: true },
} as const satisfies Record<string, RouteDef>

export type RouteKey = keyof typeof REGISTRY

/**
 * Frozen at module load so a JS consumer (NavHeader is .jsx) can't mutate a
 * shared entry and quietly change the route for every other surface.
 */
export const ROUTES: Record<RouteKey, RouteDef> = Object.freeze(
  Object.fromEntries(
    Object.entries(REGISTRY).map(([key, def]) => [key, Object.freeze({ ...def })]),
  ) as Record<RouteKey, RouteDef>,
)

/** Look up one route. Throws on an unknown key so typos fail loudly in JS too. */
export function route(key: RouteKey): RouteDef {
  const def = ROUTES[key]
  if (!def) throw new Error(`Unknown route key: ${String(key)}`)
  return def
}

/** Canonical public origin, used to build the absolute URLs Open Graph requires. */
export const SITE_ORIGIN = 'https://brooksroley.com'

/**
 * Absolute URL for a route — `og:url` and canonical tags must be absolute, and
 * building them from the registry keeps share cards from pointing at a path
 * that has since moved.
 */
export function absoluteUrl(key: RouteKey): string {
  const { href, external } = route(key)
  return external ? href : `${SITE_ORIGIN}${href}`
}

/** Every key in the registry, in declaration order. */
export const ROUTE_KEYS = Object.keys(ROUTES) as RouteKey[]

/** Keys that point at a page in this repo (i.e. everything not `external`). */
export const INTERNAL_ROUTE_KEYS = ROUTE_KEYS.filter((key) => !ROUTES[key].external)
