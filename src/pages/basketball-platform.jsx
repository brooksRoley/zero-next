import Head from 'next/head'
import Link from 'next/link'
import Reveal from 'src/components/Reveal'
import ShootingDrill from 'src/components/basketball-platform/ShootingDrill'
import JumpshotSimulator from 'src/components/basketball-platform/JumpshotSimulator'
import LayerCard, { SYSTEM_LAYERS } from 'src/components/basketball-platform/SystemLayers'
import ArchitectureDiagram from 'src/components/basketball-platform/ArchitectureDiagram'
import TftBacktestSection from 'src/components/basketball-platform/TftBacktestSection'

const TECH_STACK = [
  { category: 'Languages', items: ['Python', 'C++17', 'Swift', 'TypeScript', 'JavaScript'] },
  { category: 'Frameworks', items: ['Flask', 'FastAPI', 'Vue 3', 'SwiftUI', 'Next.js'] },
  { category: 'Data', items: ['PostgreSQL', 'pandas', 'nba_api', 'balldontlie.io'] },
  { category: 'Infra', items: ['WebAssembly', 'Emscripten', 'Fly.io', 'Vercel', 'GitHub Pages'] },
  { category: 'Testing', items: ['pytest', 'C++ unit tests', 'E2E bot suite', 'Balance analysis'] },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BasketballPlatformPage() {
  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Basketball Data Platform | Brooks Roley</title>
        <meta name="description" content="A unified basketball analytics system: Python data pipeline, C++ WASM simulation engine, Vue 3 auto-battler game, and native SwiftUI iOS app." />
        <meta property="og:title" content="Basketball Data Platform | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Real-time NBA analytics, physics-based simulation, and interactive game experiences — built across Python, C++, Vue 3, and SwiftUI." key="og:description" />
        <meta property="og:image" content="/BRBaller.png" key="og:image" />
      </Head>

      <style>{`
        @keyframes fadeUp {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-18px); }
        }
      `}</style>

      <header className="border-b border-forest-800/60 px-6 py-4">
        <Link href="/" className="text-sm text-forest-400 hover:text-forest-200 transition-colors">
          &larr; Back
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ── Hero ── */}
        <Reveal>
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">&#127936;</span>
              <span className="text-xs font-mono uppercase tracking-widest text-forest-400">
                Full-Stack System &middot; 4 Codebases &middot; 5 Languages
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Basketball Data Platform
            </h1>
            <p className="text-forest-300 text-lg leading-relaxed max-w-3xl">
              A unified system for basketball analytics, simulation, and interactive gaming &mdash;
              spanning a Python data pipeline, a C++ physics engine compiled to WebAssembly,
              a Vue 3 auto-battler, and a native SwiftUI iOS app.
            </p>
          </div>
        </Reveal>

        {/* ── Shooting Drill ── */}
        <Reveal delay={100}>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              Try the Simulation
            </h2>
            <ShootingDrill />
            <p className="text-xs text-forest-600 mt-3 font-mono text-center">
              The same shot-zone model powers the C++ simulation engine and game matchmaking.
            </p>
          </section>
        </Reveal>

        {/* ── Jumpshot Lab ── */}
        <Reveal delay={150}>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              Jumpshot Lab
            </h2>
            <JumpshotSimulator />
            <p className="text-xs text-forest-600 mt-3 font-mono text-center">
              Arc · release · backspin · footwork. The same variables the C++ engine uses to evaluate every shot.
            </p>
          </section>
        </Reveal>

        {/* ── System Layers ── */}
        <section className="mb-14">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-6">
              System Layers
            </h2>
          </Reveal>
          <div className="space-y-5">
            {SYSTEM_LAYERS.map((layer, i) => (
              <LayerCard key={layer.id} layer={layer} index={i} />
            ))}
          </div>
        </section>

        {/* ── Architecture Diagram ── */}
        <Reveal delay={200}>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              System Architecture
            </h2>
            <ArchitectureDiagram />
            <p className="text-xs text-forest-600 mt-3 font-mono text-center">
              Data flows left to right: external APIs &rarr; service layer &rarr; engines &amp; clients
            </p>
          </section>
        </Reveal>

        {/* ── Full Tech Stack ── */}
        <Reveal>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              Technology Stack
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TECH_STACK.map((group) => (
                <div key={group.category} className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-forest-400 mb-3">{group.category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <span key={item} className="text-xs px-2.5 py-1 rounded-full border border-forest-700/60 bg-forest-950/60 text-forest-300 font-mono">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── Design Decisions ── */}
        <Reveal>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              Key Design Decisions
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'WASM for Simulation',
                  desc: 'C++ compiled to WebAssembly runs the physics engine at near-native speed in the browser. The 195KB binary is smaller than most JavaScript game frameworks, and Emscripten\'s embind provides type-safe interop with zero serialization overhead.',
                },
                {
                  title: 'Protocol-Driven Services',
                  desc: 'Both the Swift and Python codebases use protocol/interface patterns for data services. This enables mock implementations for testing, runtime service switching, and clean dependency injection without external DI frameworks.',
                },
                {
                  title: 'Ghost Matchmaking',
                  desc: 'Instead of real-time multiplayer (which requires always-on infrastructure), the auto-battler saves board states to PostgreSQL and matches players against ghosts of previous runs. Same competitive feel, a fraction of the infrastructure cost.',
                },
                {
                  title: 'Shared Domain Model',
                  desc: 'PlayerEntity, SynergyEngine, ShotProbability, and GameEconomy are implemented identically in C++ and Swift. This shared domain model means game balance tuning in one language transfers directly to the other.',
                },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-4">
                  <p className="font-semibold text-white mb-1.5">{card.title}</p>
                  <p className="text-sm text-forest-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>



        <section className="mt-24 border-t border-white/10 pt-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-2">TFT Engine: Backtest 2025-26</h2>
            <p className="opacity-80 mb-8">
              A regression-tuned NBA tactical simulator. The engine&apos;s coefficients are
              fit against the completed 2025-26 season across three targets: team W-L
              (macro), per-player box (meso), and per-player 8-zone shot-origin
              distributions (spatial). Shot-origin priors are synthesized from public
              aggregates until raw shot-chart data is re-sourced.
            </p>
            <TftBacktestSection />
          </div>
        </section>

      </div>
    </main>
  )
}
