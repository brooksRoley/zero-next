import Head from 'next/head'
import { track } from 'src/lib/analytics'
import { absoluteUrl } from 'src/lib/routes'

// Served same-origin from public/hardwood/ (built from the BballTactics repo
// via `npm run build:hardwood`), so the game shares this site's /api/bball
// backend with no CORS in the path.
const GAME_URL = '/hardwood'

// Why this project exists, said plainly (review, 2026-11-02): what
// Brooks set out to learn, how, and why basketball. Keep every line true.
const WHY: [string, string][] = [
  ['What I wanted to learn', 'How a game engine and its interface fit together, and how to ship updates that players don’t wait for.'],
  ['How I built it', 'With Claude Code, reviewing every change. The simulation is C++ compiled to WebAssembly under a Vue 3 client. The Electron launcher downloads only what changed: a one-line fix is 16 KB of a 1.07 MB build.'],
  ['Why basketball', 'It’s the sport I play and watch most, so it’s the game I wanted to make.'],
]

export default function HardwoodAutochess() {
  return (
    <main className="min-h-screen bg-ink-950 text-white font-sans">
      <Head>
        <title>Hardwood Autochess | Brooks Roley</title>
        <meta
          name="description"
          content="Hardwood Autochess, an NBA auto-battler. Draft a squad, place them on a 5x5 court, pick your schemes, and fight ghost boards over 10 rounds."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Hardwood Autochess — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="An NBA auto-battler. Draft a squad on a 5x5 court, pick your schemes, and fight ghost boards over 10 rounds."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('hardwood')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        {/* ── Header ── */}
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-[#FDB927]/80 mb-2">
            NBA Auto-Battler
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Hardwood <span className="text-[#FDB927]">Autochess</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-300">
            An NBA auto-battler. Draft players from a shop, place them on a 5&times;5
            court, and pick an offense and a defense before each fight. Each round you
            play a saved board from another player&apos;s run. You start with 100 HP,
            lose 20 for each loss, and play 10 rounds.
          </p>
          <dl className="mt-6 grid max-w-3xl gap-4 text-sm leading-relaxed sm:grid-cols-3">
            {WHY.map(([term, body]) => (
              <div key={term}>
                <dt className="font-semibold text-[#FDB927]/90">{term}</dt>
                <dd className="mt-1 text-ink-300">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <a
              href={GAME_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track('cta_click', {
                  page: '/games/hardwood',
                  metadata: { location: 'hardwood_fullscreen' },
                  beacon: true,
                })
              }
              className="inline-flex items-center gap-2 rounded-full border border-[#552583] bg-[#552583]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-[#552583]/20 transition-colors hover:bg-[#552583]"
            >
              Open full screen ↗
            </a>
          </div>
        </header>

        {/* ── Game embed ── */}
        <div className="overflow-hidden rounded-xl border border-ink-800/60 bg-black shadow-2xl shadow-black/40">
          <iframe
            src={GAME_URL}
            title="Hardwood Autochess — NBA auto-battler"
            className="block w-full min-h-[720px]"
            loading="lazy"
            allowFullScreen
            onLoad={() =>
              track('hardwood_embed_load', {
                page: '/games/hardwood',
                metadata: { location: 'hardwood_iframe' },
              })
            }
          />
        </div>

        {/* ── Frame ── */}
        <footer className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
          <p className="text-ink-400">
            Vue 3 front end served same-origin from{' '}
            <span className="font-mono text-ink-300">/hardwood</span>, ghost-board
            backend on this site&apos;s{' '}
            <span className="font-mono text-ink-300">/api/bball</span> routes.
          </p>
        </footer>
      </div>
    </main>
  )
}
