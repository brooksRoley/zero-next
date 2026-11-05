import { route, type RouteKey } from 'src/lib/routes'

/**
 * What the `/basketball` hub lists, grouped by what a visitor does there.
 * Every line restates what its page already says about itself (its meta
 * description or on-page copy). Keep it that way: no stats, users or outcomes
 * the page doesn't show.
 *
 * Every route marked `basketball: true` in `src/lib/routes.ts` must appear
 * here; `__tests__/basketballHub.test.ts` enforces it.
 */

/**
 * `input` says how the game is played (checked against each game's handlers).
 * `source` links the code, so a technical reviewer can read it in one click.
 */
export type HubItem = { key: RouteKey; title?: string; line: string; input?: string; source?: string }

const ZERO_NEXT = 'https://github.com/brooksRoley/zero-next/tree/main/'
export type HubSection = { id: string; heading: string; items: HubItem[] }

export const HUB_SECTIONS: HubSection[] = [
  {
    id: 'play',
    heading: 'Play',
    items: [
      {
        key: 'hardwood',
        line: 'An NBA auto-battler. Draft a squad, place it on a 5×5 court, pick your schemes and play ten rounds against ghost boards.',
        input: 'Mouse or touch. Full Court adds keyboard on desktop.',
        source: 'https://github.com/brooksRoley/BballTactics',
      },
      {
        key: 'passAndCut',
        line: 'A passing puzzle built on the Shannon switching game. Claim lanes to connect the inbounder to the rim before the defense cuts them off.',
        input: 'Mouse or touch.',
        source: `${ZERO_NEXT}src/lib/games/passcut`,
      },
      {
        key: 'readAndReact',
        line: 'Call plays against a defense that learns your habits. The way to reach par is to mix your calls well.',
        input: 'Mouse or touch.',
        source: `${ZERO_NEXT}src/lib/games/readreact`,
      },
      {
        key: 'moments',
        line: 'Famous playoff plays stopped one beat before they happen. Read the spacing and the speed, then click the spot.',
        input: 'Mouse or touch.',
        source: `${ZERO_NEXT}src/lib/moments`,
      },
    ],
  },
  {
    id: 'tools',
    heading: 'Tools',
    items: [
      {
        key: 'tradeMachine',
        line: 'Every team’s payroll against the cap, the tax and the aprons, with a trade builder that checks the CBA salary rules.',
      },
      {
        key: 'nba',
        title: 'League Lens / NBA Explorer',
        line: 'Players, teams, standings and game predictions, from an ESPN-fed pipeline that refreshes daily.',
      },
      {
        key: 'nbaAccuracy',
        line: 'How the spread model does against the Vegas line: cover rate, average error and a rolling trend.',
      },
      {
        key: 'rigReport',
        line: 'A tongue-in-cheek “is the NBA rigged?” inspector that explains implied probability, the vig and line movement.',
      },
    ],
  },
  {
    id: 'built',
    heading: 'Built',
    items: [
      {
        key: 'basketballPlatform',
        line: 'One model of the game shared by four codebases: a Python data pipeline, a C++ engine compiled to WebAssembly, a Vue 3 game and a SwiftUI iOS app.',
        source: 'https://github.com/brooksRoley/shared-core',
      },
      {
        key: 'basketballTactics',
        title: 'Lakers Tactics iOS',
        line: 'A SwiftUI app with live Lakers scores, roster season averages and a court you can draw plays on.',
      },
    ],
  },
]

/** Title and href for one hub item, from the registry unless the hub renames it. */
export function hubLink(item: HubItem): { href: string; title: string } {
  const def = route(item.key)
  return { href: def.href, title: item.title ?? def.label }
}
