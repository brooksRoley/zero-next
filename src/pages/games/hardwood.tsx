import Head from 'next/head'
import Link from 'next/link'
import { track } from 'src/lib/analytics'

// Served same-origin from public/hardwood/ (built from the BballTactics repo
// via `npm run build:hardwood`), so the game shares this site's /api/bball
// backend with no CORS in the path.
const GAME_URL = '/hardwood'

export default function HardwoodAutochess() {
  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Hardwood Autochess | Brooks Roley</title>
        <meta
          name="description"
          content="Hardwood Autochess — an NBA auto-battler. Draft a squad, place them on a 5x5 court, pick your schemes, and fight ghost boards over 10 rounds."
        />
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
          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-forest-300">
            A TFT-style NBA auto-battler. Draft a squad from a cost-tiered shop, place
            them on a 5&times;5 court grid, then pick an offense and a coverage scheme
            before each fight. Every round you battle a ghost board from another
            player&apos;s run — 10 rounds, 100 HP, &minus;20 per loss. Survive the gauntlet.
          </p>
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
            <span className="text-xs text-forest-500">
              If the embed below doesn&apos;t load, the full-screen link always works.
            </span>
          </div>
        </header>

        {/* ── Game embed ── */}
        <div className="overflow-hidden rounded-xl border border-forest-800/60 bg-black shadow-2xl shadow-black/40">
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

        {/* ── Frame / tip jar ── */}
        <footer className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
          <p className="text-forest-400">
            Vue 3 front end served same-origin from{' '}
            <span className="font-mono text-forest-300">/hardwood</span>, ghost-board
            backend on this site&apos;s{' '}
            <span className="font-mono text-forest-300">/api/bball</span> routes.
          </p>
          <Link
            href="/funding"
            onClick={() =>
              track('cta_click', {
                page: '/games/hardwood',
                metadata: { location: 'hardwood_tip' },
                beacon: true,
              })
            }
            className="text-candy-500 transition-colors hover:text-candy-400"
          >
            Enjoying the game? Support development →
          </Link>
        </footer>
      </div>
    </main>
  )
}
