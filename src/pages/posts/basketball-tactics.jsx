import Head from 'next/head'
import Link from 'next/link'

const statPlayers = [
  { name: 'LeBron James',      pos: 'F',  pts: 25.7, reb: 7.3,  ast: 8.3,  gp: 71 },
  { name: 'Anthony Davis',     pos: 'C',  pts: 24.7, reb: 12.6, ast: 3.5,  gp: 76 },
  { name: 'Austin Reaves',     pos: 'G',  pts: 15.9, reb: 4.4,  ast: 5.5,  gp: 79 },
  { name: "D'Angelo Russell",  pos: 'G',  pts: 14.3, reb: 3.1,  ast: 6.0,  gp: 68 },
  { name: 'Rui Hachimura',     pos: 'F',  pts: 13.7, reb: 4.7,  ast: 1.4,  gp: 74 },
  { name: 'Max Christie',      pos: 'G',  pts: 10.2, reb: 3.3,  ast: 1.8,  gp: 62 },
  { name: 'Gabe Vincent',      pos: 'G',  pts: 8.4,  reb: 2.1,  ast: 2.9,  gp: 58 },
]

const MAX_PTS = statPlayers[0].pts

function posLabel(p) {
  const m = { G: 'Guard', F: 'Forward', C: 'Center' }
  return m[p] ?? p
}

function StatBar({ label, value, max, color }) {
  const pct = Math.min(value / max, 1) * 100
  return (
    <div className="flex-1">
      <p className="text-[10px] text-forest-400 mb-1 font-mono uppercase tracking-widest">{label}</p>
      <div className="h-1.5 rounded-full bg-forest-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-xs font-bold mt-1 text-forest-200">{value.toFixed(1)}</p>
    </div>
  )
}

function PlayerCard({ player }) {
  return (
    <div className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-semibold text-white">{player.name}</p>
          <p className="text-xs text-forest-400">{posLabel(player.pos)}</p>
        </div>
        <span className="text-xs text-forest-500 font-mono">{player.gp} GP</span>
      </div>
      <div className="flex gap-3">
        <StatBar label="PTS" value={player.pts} max={MAX_PTS} color="#facc15" />
        <StatBar label="REB" value={player.reb} max={15}       color="#f97316" />
        <StatBar label="AST" value={player.ast} max={12}       color="#60a5fa" />
      </div>
    </div>
  )
}

function CourtSVG() {
  return (
    <svg viewBox="0 0 400 280" className="w-full rounded-xl border border-forest-700/40" style={{ background: '#1a0f05' }}>
      {/* Court surface */}
      <rect x="10" y="10" width="380" height="260" rx="4" fill="#7c3a1a" opacity="0.4" />
      {/* Outer boundary */}
      <rect x="10" y="10" width="380" height="260" rx="4" fill="none" stroke="#c47f3a" strokeWidth="2" />
      {/* Half-court line */}
      <line x1="10" y1="140" x2="390" y2="140" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Center circle */}
      <circle cx="200" cy="140" r="30" fill="none" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Left paint */}
      <rect x="10" y="90" width="80" height="100" fill="none" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Left free-throw circle */}
      <circle cx="90" cy="140" r="36" fill="none" stroke="#c47f3a" strokeWidth="1.5" strokeDasharray="6 4" />
      {/* Left 3-pt arc */}
      <path d="M 10 68 Q 160 10 160 140 Q 160 270 10 212" fill="none" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Left basket */}
      <circle cx="30" cy="140" r="6" fill="none" stroke="#e8a045" strokeWidth="2" />
      {/* Right paint */}
      <rect x="310" y="90" width="80" height="100" fill="none" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Right free-throw circle */}
      <circle cx="310" cy="140" r="36" fill="none" stroke="#c47f3a" strokeWidth="1.5" strokeDasharray="6 4" />
      {/* Right 3-pt arc */}
      <path d="M 390 68 Q 240 10 240 140 Q 240 270 390 212" fill="none" stroke="#c47f3a" strokeWidth="1.5" />
      {/* Right basket */}
      <circle cx="370" cy="140" r="6" fill="none" stroke="#e8a045" strokeWidth="2" />
      {/* Example play: 5-out motion */}
      <circle cx="200" cy="190" r="10" fill="#552583" stroke="#FDB927" strokeWidth="2" />
      <text x="200" y="194" textAnchor="middle" fill="#FDB927" fontSize="9" fontWeight="bold">1</text>
      <circle cx="140" cy="155" r="10" fill="#552583" stroke="#FDB927" strokeWidth="2" />
      <text x="140" y="159" textAnchor="middle" fill="#FDB927" fontSize="9" fontWeight="bold">2</text>
      <circle cx="260" cy="155" r="10" fill="#552583" stroke="#FDB927" strokeWidth="2" />
      <text x="260" y="159" textAnchor="middle" fill="#FDB927" fontSize="9" fontWeight="bold">3</text>
      <circle cx="115" cy="108" r="10" fill="#552583" stroke="#FDB927" strokeWidth="2" />
      <text x="115" y="112" textAnchor="middle" fill="#FDB927" fontSize="9" fontWeight="bold">4</text>
      <circle cx="285" cy="108" r="10" fill="#552583" stroke="#FDB927" strokeWidth="2" />
      <text x="285" y="112" textAnchor="middle" fill="#FDB927" fontSize="9" fontWeight="bold">5</text>
      {/* Motion arrows */}
      <path d="M 200 180 Q 170 165 150 163" fill="none" stroke="#60a5fa" strokeWidth="1.5" markerEnd="url(#arr)" strokeDasharray="5 3" />
      <path d="M 130 148 Q 118 130 117 118" fill="none" stroke="#60a5fa" strokeWidth="1.5" markerEnd="url(#arr)" strokeDasharray="5 3" />
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
        </marker>
      </defs>
    </svg>
  )
}

export default function BasketballTacticsPage() {
  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Lakers Tactics iOS | Brooks Roley</title>
        <meta name="description" content="SwiftUI iOS app for Lakers basketball data — live game scores, roster season averages, and an interactive tactics board." />
        <meta property="og:title" content="Lakers Tactics iOS | Brooks Roley" key="og:title" />
        <meta property="og:description" content="SwiftUI iOS app: live Lakers stats, roster averages with animated stat bars, interactive play-drawing court." key="og:description" />
        <meta property="og:image" content="/BRBaller.png" key="og:image" />
      </Head>

      {/* Header */}
      <header className="border-b border-forest-800/60 px-6 py-4">
        <Link href="/" className="text-sm text-forest-400 hover:text-forest-200 transition-colors">
          ← Back
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Title block */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏀</span>
            <span className="text-xs font-mono uppercase tracking-widest text-forest-400">SwiftUI · iOS · REST API</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Lakers Tactics</h1>
          <p className="text-forest-300 text-lg leading-relaxed">
            A native iOS app for the LA Lakers ecosystem — live game scores, season-average stat cards
            with animated bar charts pulled from a REST API, and an interactive half-court tactics board
            for diagramming plays.
          </p>
        </div>

        {/* Stack chips */}
        <div className="flex flex-wrap gap-2 mb-10">
          {['Swift', 'SwiftUI', 'async/await', 'MVVM', 'REST API', 'UIKit bridge', 'Combine'].map(t => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full border border-forest-700/60 bg-forest-900/60 text-forest-300 font-mono">
              {t}
            </span>
          ))}
        </div>

        {/* Live roster demo */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
            Roster Season Averages
          </h2>
          <div className="grid gap-3">
            {statPlayers.map(p => <PlayerCard key={p.name} player={p} />)}
          </div>
          <p className="text-xs text-forest-600 mt-3 font-mono">
            Live data via balldontlie.io API · averaged client-side per season
          </p>
        </section>

        {/* Tactics board demo */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
            Tactics Board
          </h2>
          <CourtSVG />
          <p className="text-xs text-forest-600 mt-3 font-mono">
            In the app: tap to place player markers · drag to draw motion paths · shake or tap Clear to reset
          </p>
        </section>

        {/* Architecture section */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-400 mb-5">
            Architecture
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                title: 'Service Layer',
                desc: 'Protocol-driven services (LakersStatsService, PlayerStatsService) with live balldontlie.io implementations and offline mocks for testing.'
              },
              {
                title: 'MVVM ViewModels',
                desc: 'ObservableObject + @Published state machines (idle → loading → loaded/failed) driving pure SwiftUI views.'
              },
              {
                title: 'Data Processing',
                desc: 'Client-side aggregation of per-game stat entries into season averages — grouped by player, filtered for meaningful sample sizes.'
              },
              {
                title: 'UIKit Bridge',
                desc: 'UIViewRepresentable for precise tap-location capture on the tactics board, where SwiftUI TapGesture lacks coordinate data.'
              }
            ].map(card => (
              <div key={card.title} className="rounded-xl border border-forest-700/40 bg-forest-900/60 p-4">
                <p className="font-semibold text-white mb-1">{card.title}</p>
                <p className="text-sm text-forest-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Source */}
        <section>
          <a
            href="https://github.com/brooksroley/BasketballTactics"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-forest-300 hover:text-white border border-forest-700/60 hover:border-forest-500 rounded-lg px-4 py-2 transition-colors"
          >
            View source on GitHub
            <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </section>
      </div>
    </main>
  )
}
