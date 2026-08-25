/**
 * Interactive shot-zone drill for /basketball-platform.
 *
 * Renders the same eight-zone model the C++ simulation engine and game
 * matchmaking use, so the page demonstrates the real geometry rather than a
 * mock of it. Zone polygons come from src/lib/nba/tft/zones.
 */
import { useState } from 'react'
import { ZONES } from 'src/lib/nba/tft/zones'

// ── Court geometry ────────────────────────────────────────────────────────────
const CX = 230
const W = 460
const BASKET_Y = 238

function centroid(polyStr) {
  const pts = polyStr.split(' ').map(p => p.split(',').map(Number))
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return { x, y }
}

export default function ShootingDrill() {
  const [stats, setStats] = useState(() =>
    Object.fromEntries(ZONES.map(z => [z.id, { makes: 0, attempts: 0 }]))
  )
  const [flash, setFlash] = useState(null) // { zoneId, made }
  const [flashKey, setFlashKey] = useState(0)
  const [hoveredZone, setHoveredZone] = useState(null)

  function shoot(zone) {
    const made = Math.random() < zone.makePct
    setStats(prev => ({
      ...prev,
      [zone.id]: {
        makes: prev[zone.id].makes + (made ? 1 : 0),
        attempts: prev[zone.id].attempts + 1,
      },
    }))
    setFlash({ zoneId: zone.id, made })
    setFlashKey(k => k + 1)
    setTimeout(() => setFlash(null), 700)
  }

  function reset() {
    setStats(Object.fromEntries(ZONES.map(z => [z.id, { makes: 0, attempts: 0 }])))
    setFlash(null)
  }

  const totalAttempts = Object.values(stats).reduce((s, z) => s + z.attempts, 0)
  const totalMakes = Object.values(stats).reduce((s, z) => s + z.makes, 0)
  const totalPts = ZONES.reduce((s, z) => s + stats[z.id].makes * z.pts, 0)
  const totalExpectedPts = ZONES.reduce((s, z) => s + stats[z.id].attempts * z.makePct * z.pts, 0)

  const hovered = hoveredZone ? ZONES.find(z => z.id === hoveredZone) : null

  return (
    <div className="rounded-2xl border border-forest-700/40 bg-forest-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-forest-800/60 min-h-[5.5rem]">
        <div className="flex-1 pr-4">
          <h3 className="text-base font-semibold text-white">Shooting Drill</h3>
          {hovered ? (
            <div className="mt-0.5">
              <p className="text-xs font-semibold text-forest-300">
                {hovered.label} &middot; {Math.round(hovered.makePct * 100)}% expected FG &middot; {hovered.pts}pt
              </p>
              <p className="text-[11px] text-forest-400 font-mono mt-0.5 leading-snug">{hovered.edu}</p>
            </div>
          ) : (
            <div className="mt-0.5">
              <p className="text-xs text-forest-400 font-mono">
                Click a zone to shoot. Percentages are NBA averages.
              </p>
              <p className="text-[11px] text-forest-500 font-mono mt-0.5 leading-snug">
                Try to beat your expected points!
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-forest-800/60">
          {totalAttempts > 0 && (
            <div className="text-right">
              <p className="text-sm font-mono text-white">
                {totalMakes}/{totalAttempts}{' '}
                <span className="text-forest-400">({Math.round((totalMakes / totalAttempts) * 100)}%)</span>
              </p>
              <div className="flex gap-2 justify-end text-xs font-mono mt-0.5">
                <span className="text-[#FDB927]">{totalPts} pts</span>
                <span className="text-forest-400" title="Expected Points">/ Exp: {totalExpectedPts.toFixed(1)}</span>
              </div>
            </div>
          )}
          <button
            onClick={reset}
            className="text-xs text-forest-400 hover:text-white border border-forest-700/60 hover:border-forest-500 rounded-md px-2.5 py-1 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Court SVG */}
      <div className="px-4 pt-5 pb-3 sm:px-8">
        <svg
          viewBox={`0 0 ${W} 270`}
          className="w-full max-w-xl mx-auto block select-none"
          style={{ background: '#12110a' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Shot zones */}
          {ZONES.map(zone => {
            const isFlashing = flash?.zoneId === zone.id
            const isHovered = hoveredZone === zone.id
            let fill = zone.color
            let fillOpacity = isHovered ? 0.45 : 0.22
            if (isFlashing) {
              fill = flash.made ? '#22c55e' : '#ef4444'
              fillOpacity = 0.65
            }
            return (
              <polygon
                key={zone.id}
                points={zone.poly}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={isFlashing ? (flash.made ? '#22c55e' : '#ef4444') : zone.color}
                strokeOpacity={isFlashing ? 1 : isHovered ? 0.8 : 0.4}
                strokeWidth={1.5}
                className="cursor-pointer"
                style={{ transition: 'fill-opacity 0.12s, stroke-opacity 0.12s' }}
                onClick={() => shoot(zone)}
                onMouseEnter={() => setHoveredZone(zone.id)}
                onMouseLeave={() => setHoveredZone(null)}
              />
            )
          })}

          {/* ── Court lines ── */}
          {/* Outer court boundary */}
          <rect x={0} y={12} width={460} height={246} fill="none" stroke="#6b5a2e" strokeWidth={2} />

          {/* Paint / lane */}
          <rect x={170} y={108} width={120} height={150} fill="none" stroke="#6b5a2e" strokeWidth={1.5} />

          {/* FT circle — dashed */}
          <circle cx={CX} cy={108} r={46} fill="none" stroke="#6b5a2e" strokeWidth={1.5} strokeDasharray="7 5" />

          {/* 3pt straight corner portions */}
          <line x1={0} y1={178} x2={44} y2={178} stroke="#6b5a2e" strokeWidth={1.5} />
          <line x1={416} y1={178} x2={460} y2={178} stroke="#6b5a2e" strokeWidth={1.5} />
          {/* 3pt arc (r≈195, from (44,178) to (416,178) curving away from basket) */}
          <path d="M 44 178 A 195 195 0 0 1 416 178" fill="none" stroke="#6b5a2e" strokeWidth={1.5} />

          {/* Restricted area arc */}
          <path d="M 210 258 A 20 20 0 0 0 250 258" fill="none" stroke="#6b5a2e" strokeWidth={1.2} />

          {/* Backboard */}
          <rect x={214} y={235} width={32} height={3} rx={1} fill="#6b5a2e" />
          {/* Rim */}
          <circle cx={CX} cy={BASKET_Y} r={11} fill="none" stroke="#FDB927" strokeWidth={2} />
          {/* Net hint */}
          <circle cx={CX} cy={BASKET_Y} r={2.5} fill="#FDB927" fillOpacity={0.8} />

          {/* Per-zone FG% labels — appear after first shot in zone */}
          {ZONES.map(zone => {
            const s = stats[zone.id]
            if (s.attempts === 0) return null
            const { x, y } = centroid(zone.poly)
            const pct = Math.round((s.makes / s.attempts) * 100)
            const expected = Math.round(zone.makePct * 100)
            const hot = pct >= expected
            return (
              <g key={zone.id} className="pointer-events-none">
                <text
                  x={x} y={y - 7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={hot ? '#86efac' : '#fca5a5'}
                  fontSize={13}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {pct}%
                </text>
                <text
                  x={x} y={y + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#9ca3af"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {s.makes}/{s.attempts}
                </text>
              </g>
            )
          })}

          {/* Shot result flash near basket */}
          {flash && (
            <text
              key={flashKey}
              x={CX}
              y={BASKET_Y - 28}
              textAnchor="middle"
              dominantBaseline="central"
              fill={flash.made ? '#22c55e' : '#ef4444'}
              fontSize={22}
              fontWeight="bold"
              fontFamily="monospace"
              className="pointer-events-none"
              style={{ animation: 'fadeUp 0.7s ease-out forwards' }}
            >
              {flash.made ? '✓' : '✗'}
            </text>
          )}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 justify-center mt-4 mb-1">
          {[
            { color: '#552583', label: 'Paint (~62%)' },
            { color: '#166534', label: 'Mid-Range (~42%)' },
            { color: '#1e40af', label: '3-Pointer (~35–39%)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color, opacity: 0.7 }} />
              <span className="text-xs text-forest-400 font-mono">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-zone stats strip */}
      {totalAttempts > 0 && (
        <div className="border-t border-forest-800/60 px-5 py-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {ZONES.filter(z => stats[z.id].attempts > 0).map(zone => {
              const s = stats[zone.id]
              const pct = Math.round((s.makes / s.attempts) * 100)
              const hot = pct >= Math.round(zone.makePct * 100)
              return (
                <span key={zone.id} className="text-xs font-mono">
                  <span className="text-forest-400">{zone.label} </span>
                  <span className="text-white">{s.makes}/{s.attempts} </span>
                  <span style={{ color: hot ? '#86efac' : '#fca5a5' }}>({pct}%)</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
