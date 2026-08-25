/**
 * The four-layer breakdown of the platform (data pipeline, engine, game, iOS).
 *
 * SYSTEM_LAYERS is the content itself; LayerCard renders one layer, alternating
 * sides as it goes. Exported together because the data and its one renderer are
 * meaningless apart.
 */
import Reveal from 'src/components/Reveal'

// ── System Layer Data ─────────────────────────────────────────────────────────

export const SYSTEM_LAYERS = [
  {
    id: 'data',
    label: 'Data Pipeline',
    tech: 'Python · Flask · nba_api · pandas',
    color: '#60a5fa',
    desc: 'Real-time NBA data ingestion from stats.nba.com. 13 REST endpoints serving teams, players, standings, game logs, and box scores with in-memory caching and consistent JSON contracts.',
    metrics: [
      { value: '13', label: 'API Endpoints' },
      { value: '6', label: 'Adv. Metrics' },
      { value: 'Live', label: 'Game Data' },
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
      { value: '60fps', label: 'Sim Tick Rate' },
      { value: '195KB', label: 'WASM Binary' },
      { value: '11', label: 'Shot Zones' },
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
      { value: 'Live', label: 'Roster Stats' },
      { value: '0', label: 'External Deps' },
      { value: '3', label: 'Platforms' },
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

function MetricPill({ value, label }) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-forest-400 font-mono uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function LayerCard({ layer, index }) {
  const isEven = index % 2 === 0
  return (
    <Reveal delay={index * 100}>
      <div className="rounded-2xl border border-forest-700/40 bg-forest-900/60 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-forest-800/60">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: layer.color }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">{layer.label}</h3>
            <p className="text-xs text-forest-400 font-mono truncate">{layer.tech}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {layer.repo && (
              <a href={layer.repo} target="_blank" rel="noopener noreferrer" className="text-xs text-forest-400 hover:text-white border border-forest-700/60 hover:border-forest-500 rounded-md px-2.5 py-1 transition-colors">
                Source
              </a>
            )}
            {layer.live && (
              <a href={layer.live} target="_blank" rel="noopener noreferrer" className="text-xs text-forest-950 hover:opacity-90 rounded-md px-2.5 py-1 font-semibold transition-opacity" style={{ background: layer.color }}>
                Live Demo
              </a>
            )}
          </div>
        </div>
        <div className={`grid grid-cols-1 ${isEven ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[auto_1fr]'}`}>
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
