import Head from 'next/head'
import { track } from 'src/lib/analytics'
import { BUNDLE, CONTROLS, LAUNCHER_UPDATE, LAYERS, NOT_MEASURED, SOURCE, kb } from 'src/lib/hardwoodCase'
import { absoluteUrl } from 'src/lib/routes'

// Served same-origin from public/hardwood/ (built from the BballTactics repo
// via `npm run build:hardwood`), so the game shares this site's /api/bball
// backend with no CORS in the path.
const GAME_URL = '/hardwood'

const H2 = 'text-sm font-semibold uppercase tracking-widest text-ink-400'

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
            <a
              href={SOURCE.game}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track('cta_click', { page: '/games/hardwood', metadata: { location: 'hardwood_source' }, beacon: true })
              }
              className="inline-flex items-center gap-2 rounded-full border border-ink-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-200 transition-colors hover:border-[#FDB927]/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB927]"
            >
              Source on GitHub ↗
            </a>
            <p className="text-xs text-ink-400">Mouse or touch · sound starts muted</p>
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

        {/* ── Case study ── */}
        <section aria-labelledby="hw-controls" className="mt-12">
          <h2 id="hw-controls" className={H2}>How it plays</h2>
          <dl className="mt-4 grid gap-4 text-sm leading-relaxed sm:grid-cols-3">
            {CONTROLS.map(([term, body]) => (
              <div key={term}>
                <dt className="font-semibold text-white">{term}</dt>
                <dd className="mt-1 text-ink-300">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="hw-architecture" className="mt-12">
          <h2 id="hw-architecture" className={H2}>Architecture</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2">
            {LAYERS.map((layer, i) => (
              <li key={layer.name} className="rounded-xl border border-ink-800 bg-ink-900/40 p-5">
                <p className="font-mono text-xs text-ink-400">
                  {i + 1} · {layer.stack}
                </p>
                <h3 className="mt-2 font-semibold text-white">{layer.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{layer.body}</p>
                <a
                  href={layer.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-sm font-mono text-xs text-[#FDB927]/90 underline decoration-ink-600 underline-offset-4 hover:text-[#FDB927] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB927]"
                >
                  source<span className="sr-only"> for the {layer.name.toLowerCase()} layer</span> ↗
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="hw-measured" className="mt-12">
          <h2 id="hw-measured" className={H2}>Measured</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300">
            Sizes of the build this page serves, raw and gzipped. A test reads the shipped files and fails if
            these numbers drift.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="font-mono text-xs text-ink-400">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-normal">Piece</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Raw</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Gzipped</th>
                  <th scope="col" className="py-2 font-normal">Why it matters</th>
                </tr>
              </thead>
              <tbody className="text-ink-200">
                {BUNDLE.map((m) => (
                  <tr key={m.file} className="border-t border-ink-800 align-top">
                    <th scope="row" className="py-2 pr-4 font-medium text-white">{m.label}</th>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">{kb(m.raw)}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">{kb(m.gzip)}</td>
                    <td className="py-2 text-ink-300">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-300">
            <span className="font-semibold text-white">
              Launcher updates: {LAUNCHER_UPDATE.changedKB} KB of {LAUNCHER_UPDATE.totalMB} MB.
            </span>{' '}
            {LAUNCHER_UPDATE.note}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-400">Not measured yet: {NOT_MEASURED}</p>
        </section>
      </div>
    </main>
  )
}
