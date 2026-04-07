import Head from 'next/head'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import Reveal from 'src/components/Reveal'

const inter = Inter({ subsets: ['latin'] })

// ── Data ─────────────────────────────────────────────────────────────────────

const SYSTEM_LAYERS = [
  {
    id: 'data',
    label: 'Data Pipeline',
    tech: 'Python · Flask · nba_api · pandas',
    color: '#60a5fa',
    desc: 'Real-time NBA data ingestion from stats.nba.com. 13 REST endpoints serving teams, players, standings, game logs, and box scores with in-memory caching and consistent JSON contracts.',
    metrics: [
      { value: '13', label: 'API Endpoints' },
      { value: '173', label: 'Automated Tests' },
      { value: '6', label: 'Advanced Metrics' },
    ],
    details: [
      'True Shooting %, Effective FG%, Usage Rate, Net Rating, PIE, AST/REB%',
      'Team dashboards with offensive/defensive ratings, pace, and lineup analysis',
      'Last-night analytics — top performers with shooting splits and contest data',
      'Session-scoped test cache with rate-limiting for CI-safe integration tests',
    ],
    repo: 'https://github.com/brooksroley/NbaApi',
  },
  {
    id: 'engine',
    label: 'Simulation Engine',
    tech: 'C++17 · WebAssembly · Emscripten · nlohmann/json',
    color: '#f59e0b',
    desc: 'Physics-based basketball simulation compiled to WASM. Handles player movement, shot probability with contest mechanics, ball physics with 3D arc trajectories, and a synergy buff system — all running at native speed in the browser.',
    metrics: [
      { value: '901', label: 'Lines of C++' },
      { value: '60fps', label: 'Sim Tick Rate' },
      { value: '195KB', label: 'WASM Binary' },
    ],
    details: [
      'Shot probability: exponential decay by distance with contest penalty from nearest defender',
      'Ball physics: 3D position/velocity, gravity at 9.8 m/s², bounce damping at 0.6x',
      'Synergy engine: Franchise, Twin Towers, Splash Family, 7 Seconds or Less archetypes',
      'Game economy: 5-tier salary cap mapping, z-score stat normalization, draft lottery',
    ],
    repo: 'https://github.com/brooksroley/BballTactics',
  },
  {
    id: 'game',
    label: 'Auto-Battler Game',
    tech: 'Vue 3 · Vite · FastAPI · PostgreSQL · Canvas 2D',
    color: '#a78bfa',
    desc: 'Full-stack basketball autochess. Drag-and-drop formation planning, real-time WASM-driven match simulation rendered on canvas, ghost matchmaking against other players\' boards, and a 10-round survival run with HP and gold economy.',
    metrics: [
      { value: '10', label: 'Round Runs' },
      { value: '4', label: 'Synergy Types' },
      { value: '5', label: 'Cost Tiers' },
    ],
    details: [
      'Planning phase: 5x5 grid drag-and-drop with bench management and sell mechanics',
      'Simulation: requestAnimationFrame loop parsing C++ engine state as JSON each tick',
      'Matchmaking: PostgreSQL-backed ghost opponents from prior player board states',
      'Deployed: GitHub Pages frontend + Fly.io API + managed PostgreSQL',
    ],
    repo: 'https://github.com/brooksroley/BballTactics',
    live: 'https://brooksroley.github.io/BballTactics/',
  },
  {
    id: 'ios',
    label: 'Native iOS App',
    tech: 'SwiftUI · async/await · MVVM · UIKit bridge',
    color: '#34d399',
    desc: 'Native iOS/macOS/visionOS app with protocol-driven service architecture. Live roster stats from balldontlie.io, animated stat bar visualizations, and an interactive tactics board for diagramming plays with tap-to-place markers and drag-to-draw motion paths.',
    metrics: [
      { value: '18', label: 'Swift Files' },
      { value: '0', label: 'External Deps' },
      { value: '3', label: 'Target Platforms' },
    ],
    details: [
      'Service protocol pattern: LakersStatsService + PlayerStatsService with mock implementations',
      'LoadState machine: idle → loading → loaded/failed driving pure SwiftUI views',
      'UIViewRepresentable bridge for precise tap-coordinate capture on tactics board',
      'Client-side aggregation of per-game stats into season averages with sample-size filtering',
    ],
    repo: 'https://github.com/brooksroley/BasketballTactics',
  },
]

const ARCHITECTURE_NODES = [
  { id: 'nba', label: 'stats.nba.com', x: 80, y: 50, w: 120, h: 36, type: 'external' },
  { id: 'bdl', label: 'balldontlie.io', x: 80, y: 250, w: 120, h: 36, type: 'external' },
  { id: 'api', label: 'NbaApi\n(Flask)', x: 280, y: 50, w: 110, h: 44, type: 'service' },
  { id: 'pg', label: 'PostgreSQL', x: 280, y: 250, w: 110, h: 36, type: 'store' },
  { id: 'fast', label: 'FastAPI\nBackend', x: 280, y: 150, w: 110, h: 44, type: 'service' },
  { id: 'wasm', label: 'C++ WASM\nEngine', x: 480, y: 100, w: 110, h: 44, type: 'engine' },
  { id: 'vue', label: 'Vue 3\nGame Client', x: 480, y: 200, w: 110, h: 44, type: 'frontend' },
  { id: 'swift', label: 'SwiftUI\niOS App', x: 480, y: 10, w: 110, h: 44, type: 'frontend' },
]

const ARCHITECTURE_EDGES = [
  { from: 'nba', to: 'api', label: 'nba_api' },
  { from: 'bdl', to: 'swift', label: 'REST' },
  { from: 'api', to: 'fast', label: 'roster data' },
  { from: 'fast', to: 'pg', label: 'runs/boards' },
  { from: 'fast', to: 'vue', label: 'matchmaking' },
  { from: 'wasm', to: 'vue', label: 'embind' },
  { from: 'api', to: 'swift', label: 'stats' },
]

const TECH_STACK = [
  { category: 'Languages', items: ['Python', 'C++17', 'Swift', 'TypeScript', 'JavaScript'] },
  { category: 'Frameworks', items: ['Flask', 'FastAPI', 'Vue 3', 'SwiftUI', 'Next.js'] },
  { category: 'Data', items: ['PostgreSQL', 'pandas', 'nba_api', 'balldontlie.io'] },
  { category: 'Infra', items: ['WebAssembly', 'Emscripten', 'Fly.io', 'Vercel', 'GitHub Pages'] },
  { category: 'Testing', items: ['pytest (173)', 'C++ unit tests', 'E2E bot suite', 'Balance analysis'] },
]

// ── Helper Components ────────────────────────────────────────────────────────

function NodeBox({ node }) {
  const fills = {
    external: 'fill-forest-800 stroke-forest-600',
    service: 'fill-[#1e3a5f] stroke-blue-500/50',
    store: 'fill-[#3b1f4a] stroke-purple-500/50',
    engine: 'fill-[#4a3000] stroke-amber-500/50',
    frontend: 'fill-[#1a3330] stroke-emerald-500/50',
  }
  const cls = fills[node.type] || fills.external
  const lines = node.label.split('\n')

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={8}
        className={cls}
        strokeWidth={1.5}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={node.x + node.w / 2}
          y={node.y + node.h / 2 + (i - (lines.length - 1) / 2) * 14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white text-[11px] font-mono"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function ArchitectureDiagram() {
  const nodeMap = Object.fromEntries(ARCHITECTURE_NODES.map(n => [n.id, n]))

  return (
    <svg viewBox="0 0 620 300" className="w-full rounded-xl border border-forest-700/40 bg-forest-950/80" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" className="fill-forest-400" />
        </marker>
      </defs>

      {ARCHITECTURE_EDGES.map((edge, i) => {
        const from = nodeMap[edge.from]
        const to = nodeMap[edge.to]
        const x1 = from.x + from.w
        const y1 = from.y + from.h / 2
        const x2 = to.x
        const y2 = to.y + to.h / 2
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2

        return (
          <g key={i}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              className="stroke-forest-500/60"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              markerEnd="url(#arrowHead)"
            />
            <text
              x={mx}
              y={my - 6}
              textAnchor="middle"
              className="fill-forest-400 text-[9px] font-mono"
            >
              {edge.label}
            </text>
          </g>
        )
      })}

      {ARCHITECTURE_NODES.map(node => <NodeBox key={node.id} node={node} />)}
    </svg>
  )
}

function MetricPill({ value, label }) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-forest-400 font-mono uppercase tracking-wider">{label}</span>
    </div>
  )
}

function LayerCard({ layer, index }) {
  const isEven = index % 2 === 0

  return (
    <Reveal delay={index * 100}>
      <div className="rounded-2xl border border-forest-700/40 bg-forest-900/60 overflow-hidden">
        {/* Header bar with color accent */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-forest-800/60">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: layer.color }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">{layer.label}</h3>
            <p className="text-xs text-forest-400 font-mono truncate">{layer.tech}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {layer.repo && (
              <a
                href={layer.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-forest-400 hover:text-white border border-forest-700/60 hover:border-forest-500 rounded-md px-2.5 py-1 transition-colors"
              >
                Source
              </a>
            )}
            {layer.live && (
              <a
                href={layer.live}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-forest-950 hover:opacity-90 rounded-md px-2.5 py-1 font-semibold transition-opacity"
                style={{ background: layer.color }}
              >
                Live Demo
              </a>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isEven ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[auto_1fr]'}`}>
          {/* Description + details */}
          <div className={`px-5 py-5 ${!isEven ? 'lg:order-2' : ''}`}>
            <p className="text-sm text-forest-200 leading-relaxed mb-4">{layer.desc}</p>
            <ul className="space-y-1.5">
              {layer.details.map((detail, i) => (
                <li key={i} className="flex gap-2 text-xs text-forest-300 leading-relaxed">
                  <span className="shrink-0 mt-0.5" style={{ color: layer.color }}>-</span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>

          {/* Metrics sidebar */}
          <div className={`flex lg:flex-col items-center justify-center gap-2 px-5 py-4 bg-forest-950/40 border-t lg:border-t-0 ${isEven ? 'lg:border-l' : 'lg:border-r lg:order-1'} border-forest-800/60`}>
            {layer.metrics.map((m, i) => (
              <MetricPill key={i} value={m.value} label={m.label} />
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BasketballPlatformPage() {
  return (
    <main className={`min-h-screen bg-forest-950 text-white ${inter.className}`}>
      <Head>
        <title>Basketball Data Platform | Brooks Roley</title>
        <meta name="description" content="A unified basketball analytics system: Python data pipeline, C++ WASM simulation engine, Vue 3 auto-battler game, and native SwiftUI iOS app." />
        <meta property="og:title" content="Basketball Data Platform | Brooks Roley" />
        <meta property="og:description" content="Real-time NBA analytics, physics-based simulation, and interactive game experiences — built across Python, C++, Vue 3, and SwiftUI." />
        <meta property="og:image" content="/BRBaller.png" />
      </Head>

      {/* Header */}
      <header className="border-b border-forest-800/60 px-6 py-4">
        <Link href="/" className="text-sm text-forest-400 hover:text-forest-200 transition-colors">
          &larr; Back
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
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
              a Vue 3 auto-battler with PostgreSQL matchmaking, and a native SwiftUI iOS app.
            </p>
          </div>
        </Reveal>

        {/* ── Aggregate stats ─────────────────────────────────────────────── */}
        <Reveal delay={100}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
            {[
              { value: '4', label: 'Codebases', sub: 'Unified system' },
              { value: '5', label: 'Languages', sub: 'Python · C++ · Swift · TS · JS' },
              { value: '173+', label: 'Tests', sub: 'Unit + integration + E2E' },
              { value: '3', label: 'Deployments', sub: 'Vercel · Fly.io · GH Pages' },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-4 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-forest-400 mt-1">{stat.label}</p>
                <p className="text-[10px] text-forest-500 mt-0.5 font-mono">{stat.sub}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── Architecture Diagram ────────────────────────────────────────── */}
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

        {/* ── System Layers ───────────────────────────────────────────────── */}
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

        {/* ── Full Tech Stack ─────────────────────────────────────────────── */}
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

        {/* ── Design Decisions ────────────────────────────────────────────── */}
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

        {/* ── What This Demonstrates ──────────────────────────────────────── */}
        <Reveal>
          <section className="mb-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
              Engineering Competencies
            </h2>
            <div className="rounded-2xl border border-forest-700/40 bg-forest-900/60 p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ['Data Engineering', 'ETL pipelines, API design, caching strategies, statistical computation'],
                  ['Systems Programming', 'C++17, memory management, WASM compilation, cross-language interop'],
                  ['Frontend Engineering', 'Vue 3 composition API, Canvas 2D rendering, real-time game loops'],
                  ['Mobile Development', 'SwiftUI, async/await concurrency, MVVM, UIKit bridging'],
                  ['Backend Architecture', 'FastAPI async services, PostgreSQL schema design, REST API contracts'],
                  ['Testing & Quality', '173+ automated tests, mocking strategies, E2E bot testing, balance analysis'],
                  ['Sports Analytics', 'Advanced metrics (TS%, NetRtg, USG%), shot probability modeling, player evaluation'],
                  ['DevOps & Deployment', 'Multi-platform deployment, Docker, Fly.io, GitHub Pages, Vercel'],
                ].map(([title, desc]) => (
                  <div key={title} className="py-2">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-forest-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <Reveal>
          <section className="mb-8">
            <div className="rounded-2xl border border-forest-700/40 bg-gradient-to-br from-forest-900/80 to-forest-950 p-6 sm:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-bold mb-3">
                Let&apos;s Build Something Together
              </h2>
              <p className="text-forest-300 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
                I&apos;m pursuing senior engineering roles in sports tech and data strategy.
                If you&apos;re building at the intersection of sports and software, I&apos;d love to talk.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="https://calendly.com/brooksroley/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-xl bg-forest-500 hover:bg-forest-400 text-white text-sm font-semibold transition-colors"
                >
                  Schedule a Call
                </a>
                <a
                  href="https://www.linkedin.com/in/brooksroley/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 border border-forest-600/40 text-white text-sm font-semibold transition-colors"
                >
                  Connect on LinkedIn
                </a>
                <Link
                  href="/resume"
                  className="px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 border border-forest-600/40 text-white text-sm font-semibold transition-colors"
                >
                  View Resume
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </main>
  )
}
