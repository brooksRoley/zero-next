import React, { useMemo } from 'react'
import { ALTITUDE_ZONES, MIN_ELO, MAX_ELO, getAltitudePercent, getZone } from 'src/lib/pente/elo'

/**
 * Mountain climb visualizer showing ELO as altitude on a mountain.
 * Renders an SVG mountain with zones, player marker, and history trail.
 */
export default function MountainProgress({ elo, peakElo, eloHistory, compact = false }) {
  const zone = getZone(elo)
  const altPercent = getAltitudePercent(elo)
  const peakPercent = getAltitudePercent(peakElo)

  // Build trail path from history (last 30 entries)
  const trailPoints = useMemo(() => {
    const recent = eloHistory.slice(-30)
    if (recent.length < 2) return null
    return recent.map((entry, i) => {
      const x = 20 + (i / (recent.length - 1)) * 260
      const y = 180 - (getAltitudePercent(entry.elo) / 100) * 160
      return `${x},${y}`
    }).join(' ')
  }, [eloHistory])

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Mini mountain icon */}
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
          <path d="M2 20 L12 4 L22 20 Z" fill="currentColor" className="text-forest-700" />
          <path d="M9 20 L12 4 L15 20 Z" fill="currentColor" className="text-forest-600" />
          {/* Player dot */}
          <circle
            cx={12}
            cy={20 - (altPercent / 100) * 16}
            r="2"
            fill="#ff69b4"
          />
        </svg>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">{elo}</span>
          <span className="text-[10px] text-forest-400">{zone.name}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-forest-900/60 border border-forest-700/40 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-forest-500 uppercase tracking-wider">Rating</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{elo}</span>
            {eloHistory.length > 0 && (
              <span className={`text-xs font-semibold ${
                eloHistory[eloHistory.length - 1]?.delta >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {eloHistory[eloHistory.length - 1]?.delta >= 0 ? '+' : ''}
                {eloHistory[eloHistory.length - 1]?.delta}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-forest-500 uppercase tracking-wider">Zone</span>
          <div className="text-sm font-semibold text-forest-200">{zone.name}</div>
        </div>
      </div>

      {/* Mountain SVG */}
      <svg viewBox="0 0 300 200" className="w-full h-auto" style={{ maxHeight: '180px' }}>
        <defs>
          {/* Mountain gradient */}
          <linearGradient id="mountainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="25%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#6b7280" />
            <stop offset="75%" stopColor="#2d6a4f" />
            <stop offset="100%" stopColor="#1a3a2a" />
          </linearGradient>
          {/* Snow cap */}
          <linearGradient id="snowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
          </linearGradient>
          {/* Player glow */}
          <radialGradient id="playerGlow">
            <stop offset="0%" stopColor="#ff69b4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff69b4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background sky */}
        <rect width="300" height="200" fill="#0c1f17" rx="8" />

        {/* Stars */}
        {[30, 80, 140, 200, 260, 55, 170, 240].map((x, i) => (
          <circle key={i} cx={x} cy={8 + (i % 3) * 12} r="0.8" fill="#ffffff" opacity={0.3 + (i % 3) * 0.2} />
        ))}

        {/* Mountain silhouette - main peak */}
        <path
          d="M0 200 L50 140 L90 160 L130 80 L150 20 L170 80 L210 150 L250 130 L300 200 Z"
          fill="url(#mountainGrad)"
          opacity="0.9"
        />

        {/* Snow cap */}
        <path
          d="M130 80 L150 20 L170 80 L160 70 L150 75 L140 70 Z"
          fill="url(#snowGrad)"
          opacity="0.8"
        />

        {/* Zone lines */}
        {ALTITUDE_ZONES.slice(1).map((z, i) => {
          const y = 180 - (getAltitudePercent(z.min) / 100) * 160
          return (
            <g key={i}>
              <line x1="10" y1={y} x2="290" y2={y} stroke={z.color} strokeWidth="0.5" opacity="0.3" strokeDasharray="4 4" />
              <text x="292" y={y + 3} fontSize="6" fill={z.color} opacity="0.5" textAnchor="end">{z.name}</text>
            </g>
          )
        })}

        {/* ELO history trail */}
        {trailPoints && (
          <polyline
            points={trailPoints}
            fill="none"
            stroke="#ff69b4"
            strokeWidth="1.5"
            opacity="0.4"
            strokeLinejoin="round"
          />
        )}

        {/* Peak marker */}
        {peakElo > elo && (
          <g>
            <circle
              cx={150}
              cy={180 - (peakPercent / 100) * 160}
              r="3"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1"
              opacity="0.5"
            />
            <text
              x={158}
              y={180 - (peakPercent / 100) * 160 + 2}
              fontSize="6"
              fill="#fbbf24"
              opacity="0.5"
            >
              Peak {peakElo}
            </text>
          </g>
        )}

        {/* Player marker */}
        <circle
          cx={150}
          cy={180 - (altPercent / 100) * 160}
          r="12"
          fill="url(#playerGlow)"
        >
          <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle
          cx={150}
          cy={180 - (altPercent / 100) * 160}
          r="4"
          fill="#ff69b4"
          stroke="#fff"
          strokeWidth="1.5"
        >
          <animate attributeName="cy" values={`${180 - (altPercent / 100) * 160 - 1};${180 - (altPercent / 100) * 160 + 1};${180 - (altPercent / 100) * 160 - 1}`} dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Altitude bar */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-forest-600 w-8">400</span>
        <div className="flex-1 h-2 rounded-full bg-forest-800 overflow-hidden relative">
          {/* Zone gradient */}
          <div className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(to right, ${ALTITUDE_ZONES.map((z, i) =>
                `${z.color} ${(getAltitudePercent(z.min) / 100) * 100}%`
              ).join(', ')})`,
              opacity: 0.3,
            }}
          />
          {/* Current position */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${altPercent}%`,
              background: 'linear-gradient(to right, #2d6a4f, #ff69b4)',
            }}
          />
          {/* Peak marker */}
          {peakElo > elo && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
              style={{ left: `${peakPercent}%` }}
            />
          )}
        </div>
        <span className="text-[10px] text-forest-600 w-10 text-right">2400</span>
      </div>
    </div>
  )
}
