/**
 * Static SVG of the platform's data flow: external APIs on the left, service
 * layer in the middle, engines and clients on the right.
 *
 * Hand-positioned rather than force-laid-out — the graph is small and fixed, so
 * coordinates in ARCHITECTURE_NODES are clearer than a layout algorithm.
 */


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

// ── Helper Components ─────────────────────────────────────────────────────────

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
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={8} className={cls} strokeWidth={1.5} />
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

export default function ArchitectureDiagram() {
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
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-forest-500/60" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#arrowHead)" />
            <text x={mx} y={my - 6} textAnchor="middle" className="fill-forest-400 text-[9px] font-mono">{edge.label}</text>
          </g>
        )
      })}
      {ARCHITECTURE_NODES.map(node => <NodeBox key={node.id} node={node} />)}
    </svg>
  )
}
