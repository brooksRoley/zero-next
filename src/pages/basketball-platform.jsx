import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import Reveal from 'src/components/Reveal'
import { ZONES } from 'src/lib/nba/tft/zones'
import TeamResidualsTable from 'src/components/tft/TeamResidualsTable'
import CoefficientsTable from 'src/components/tft/CoefficientsTable'
import ShotHeatmap from 'src/components/tft/ShotHeatmap'

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

function ShootingDrill() {
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

// ── Jumpshot Simulator ────────────────────────────────────────────────────────

const JS = {
  W: 520, H: 240,
  FY: 212,   // floor y
  SX: 88,    // shooter x
  RX: 416,   // rim center x
  RY: 96,    // rim y
  RR: 16,    // rim radius
  BX: 444,   // backboard x
}

const JS_SHOT_TYPES = [
  { label: 'Pull-Up',       optArc: 52, optRel: 72, optSpin: 7, optGather: 73, tol: 1.00 },
  { label: 'Step-Back',     optArc: 56, optRel: 78, optSpin: 8, optGather: 65, tol: 0.85 },
  { label: 'Floater',       optArc: 66, optRel: 83, optSpin: 9, optGather: 60, tol: 0.90 },
  { label: 'Catch & Shoot', optArc: 49, optRel: 68, optSpin: 6, optGather: 82, tol: 1.10 },
  { label: 'Spin Move',     optArc: 58, optRel: 75, optSpin: 8, optGather: 58, tol: 0.80 },
]

const KYRIE = { arc: 55, rel: 82, spin: 8, gather: 75 }

const JS_QUIPS = {
  silk:   ["Pure silk. That's vintage Kyrie.", "Absolutely filthy.", "Like he's not even trying."],
  good:   ["Bucket.", "Clean release.", "Money."],
  rimSave:["Rattled in — that touch saved it.", "Backspin to the rescue."],
  rimOut: ["Rattled out.", "Off the back iron.", "Hit back iron, no good."],
  flat:   ["Too flat — needs more lift.", "Front rim. Arc it up."],
  late:   ["Late release. Trust the timing.", "Off the front of the rim."],
  miss:   ["Brick.", "Work on that form.", "Missed."],
}

function jsPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function drawJsFrame(ctx, { ballX, ballY, spinAngle, trail, text, textColor }) {
  const { W, H, FY, SX, RX, RY, RR, BX } = JS
  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = '#09090b'
  ctx.fillRect(0, 0, W, H)

  // Floor
  ctx.strokeStyle = '#2d1f08'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, FY)
  ctx.lineTo(W, FY)
  ctx.stroke()

  // Lane marking on floor
  ctx.strokeStyle = '#1e1508'
  ctx.lineWidth = 1
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(RX - 115, FY)
  ctx.lineTo(RX + 38, FY)
  ctx.stroke()
  ctx.setLineDash([])

  // Support pole
  ctx.strokeStyle = '#3a2c10'
  ctx.lineWidth = 3
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(BX + 2, RY + 30)
  ctx.lineTo(BX + 2, FY)
  ctx.stroke()

  // Backboard
  ctx.fillStyle = '#3d2e10'
  ctx.fillRect(BX, RY - 30, 5, 60)
  ctx.strokeStyle = '#5a4520'
  ctx.lineWidth = 1
  ctx.strokeRect(BX, RY - 30, 5, 60)

  // Rim
  ctx.strokeStyle = '#FDB927'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(RX - RR, RY)
  ctx.lineTo(RX + RR, RY)
  ctx.stroke()

  // Net
  ctx.lineWidth = 0.8
  for (let i = 0; i <= 6; i++) {
    const nx = (RX - RR) + i * (RR * 2 / 6)
    const lean = ((i / 6) - 0.5) * -5
    ctx.strokeStyle = 'rgba(200,200,200,0.2)'
    ctx.beginPath()
    ctx.moveTo(nx, RY)
    ctx.lineTo(nx + lean, RY + 22)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(180,180,180,0.18)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(RX - RR + 3, RY + 22)
  ctx.lineTo(RX + RR - 3, RY + 22)
  ctx.stroke()

  // Shooter (jump pose)
  const sx = SX
  const liftOff = ballX !== null ? 9 : 0
  const sy = FY - liftOff
  ctx.strokeStyle = '#52525b'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Legs
  ctx.beginPath()
  ctx.moveTo(sx - 7, sy)
  ctx.lineTo(sx - 4, sy - 22)
  ctx.lineTo(sx + 1, sy - 46)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sx + 9, sy)
  ctx.lineTo(sx + 5, sy - 22)
  ctx.lineTo(sx + 1, sy - 46)
  ctx.stroke()
  // Torso
  ctx.beginPath()
  ctx.moveTo(sx + 1, sy - 46)
  ctx.lineTo(sx + 3, sy - 72)
  ctx.stroke()
  // Head
  ctx.beginPath()
  ctx.arc(sx + 3, sy - 79, 7, 0, Math.PI * 2)
  ctx.stroke()
  // Shooting arm (up, extended)
  ctx.strokeStyle = '#52525b'
  ctx.beginPath()
  ctx.moveTo(sx + 3, sy - 62)
  ctx.lineTo(sx + 16, sy - 85)
  ctx.lineTo(sx + 9, sy - 108)
  ctx.stroke()
  // Guide hand (falling away)
  ctx.strokeStyle = '#3f3f46'
  ctx.beginPath()
  ctx.moveTo(sx + 3, sy - 62)
  ctx.lineTo(sx - 7, sy - 80)
  ctx.stroke()

  // Trajectory trail
  if (trail && trail.length > 1) {
    ctx.strokeStyle = 'rgba(253,185,39,0.1)'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    trail.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y) })
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Ball
  if (ballX !== null) {
    // Shadow (grows as ball approaches floor)
    const prog = (ballX - SX) / (RX - SX)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(ballX, FY + 1, 9 * (0.4 + prog * 0.6), 2.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ball
    const gr = ctx.createRadialGradient(ballX - 3, ballY - 3, 1, ballX, ballY, 12)
    gr.addColorStop(0, '#fb923c')
    gr.addColorStop(1, '#c2410c')
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.arc(ballX, ballY, 12, 0, Math.PI * 2)
    ctx.fill()

    // Seams (rotate with spin)
    ctx.save()
    ctx.translate(ballX, ballY)
    ctx.rotate(spinAngle)
    ctx.strokeStyle = 'rgba(0,0,0,0.48)'
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(0, 0, 12, -Math.PI * 0.45, Math.PI * 0.45)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 12, Math.PI * 0.55, Math.PI * 1.45)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Result text
  if (text) {
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = textColor || '#22c55e'
    ctx.fillText(text, W / 2, H / 2 - 8)
  }
}

function JsSlider({ label, sub, value, min, max, onChange, unit = '', kyrie, edu }) {
  return (
    <div className="group relative">
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-forest-400 flex items-center gap-1.5">
          {label} <span className="text-forest-600 text-[10px]">{sub}</span>
        </span>
        <span className="text-forest-300">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-candy-500 cursor-pointer"
      />
      <div className="flex justify-between text-[9px] font-mono text-forest-700 mt-0.5">
        <span>{min}{unit}</span>
        <span>Kyrie ≈ {kyrie}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {edu && (
        <p className="hidden group-hover:block absolute z-10 bottom-full mb-2 left-0 w-48 bg-forest-900 border border-forest-700 p-2 text-[10px] text-forest-300 font-sans rounded shadow-xl leading-relaxed">
          {edu}
        </p>
      )}
    </div>
  )
}

function JumpshotSimulator() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  const [arc, setArc] = useState(52)
  const [rel, setRel] = useState(70)
  const [spin, setSpin] = useState(6)
  const [gather, setGather] = useState(70)
  const [shotType, setShotType] = useState(JS_SHOT_TYPES[0].label)

  const [horse, setHorse] = useState('')
  const [shooting, setShooting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [stats, setStats] = useState({ makes: 0, attempts: 0 })

  const kyriePct = () => {
    const a = Math.max(0, 1 - Math.abs(arc - KYRIE.arc) / 20)
    const r = Math.max(0, 1 - Math.abs(rel - KYRIE.rel) / 35)
    const s = Math.max(0, 1 - Math.abs(spin - KYRIE.spin) / 6)
    const g = Math.max(0, 1 - Math.abs(gather - KYRIE.gather) / 35)
    return Math.round((a * 0.28 + r * 0.32 + s * 0.25 + g * 0.15) * 100)
  }

  const drawEmpty = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawJsFrame(ctx, { ballX: null, ballY: null, spinAngle: 0, trail: [], text: null })
  }, [])

  useEffect(() => {
    drawEmpty()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [drawEmpty])

  const shoot = () => {
    if (shooting || horse.length >= 5) return
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setShooting(true)

    const type = JS_SHOT_TYPES.find(t => t.label === shotType) || JS_SHOT_TYPES[0]

    // Outcome: score how close params are to the shot type's optimum
    const arcErr    = Math.abs(arc    - type.optArc)    / 22
    const relErr    = Math.abs(rel    - type.optRel)    / 42
    const spinErr   = Math.abs(spin   - type.optSpin)   / 7
    const gatherErr = Math.abs(gather - type.optGather) / 42
    const base = 1 - (arcErr * 0.35 + relErr * 0.35 + spinErr * 0.2 + gatherErr * 0.1)
    const noise = (Math.random() - 0.5) * 0.38
    const score = Math.max(0, Math.min(1, base * type.tol + noise))
    const made = score > 0.47
    const isClose = !made && score > 0.32
    const isAirball = score < 0.12

    let comment
    if (made && score > 0.82)     comment = jsPick(JS_QUIPS.silk)
    else if (made)                 comment = jsPick(JS_QUIPS.good)
    else if (isClose && spin > 5)  comment = jsPick(JS_QUIPS.rimSave)
    else if (isClose)              comment = jsPick(JS_QUIPS.rimOut)
    else {
      // Educational Feedback: Find the biggest error
      const maxErr = Math.max(arcErr, relErr, spinErr, gatherErr)
      if (maxErr === arcErr) {
        comment = arc < type.optArc ? `Too flat! Needs more arc. (Target: ~${type.optArc}°)` : `Too much arc! (Target: ~${type.optArc}°)`
      } else if (maxErr === relErr) {
        comment = rel < type.optRel ? `Early release on the jump. (Target: ~${type.optRel})` : `Late release. Shoot at the apex. (Target: ~${type.optRel})`
      } else if (maxErr === gatherErr) {
        comment = `Off-balance footwork. (Target: ~${type.optGather})`
      } else {
        comment = spin < type.optSpin ? `Not enough backspin for a soft touch.` : `Too much spin.`
      }
    }

    // Trajectory geometry (parametric parabola)
    const { FY, SX, RX, RY } = JS
    const releaseY = FY - 96 - (rel / 100) * 14
    const apexLift = ((arc - 30) / 40) * 72 + 22
    const apexY = Math.min(releaseY, RY) - apexLift
    const FRAMES = 68 + Math.round(arc * 0.4)
    let frame = 0
    let trail = []

    const animate = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return

      const t = frame / FRAMES
      const bx = SX + (RX - SX) * t
      const yLinear = releaseY + (RY - releaseY) * t
      const height = Math.abs(releaseY - apexY) + 14
      const by = yLinear - height * 4 * t * (1 - t)

      trail.push({ x: bx, y: by })
      if (trail.length > 28) trail = trail.slice(-28)

      // Backspin: more spin = faster clockwise rotation
      const spinAngle = frame * 0.11 * (spin / 5 + 0.5)

      if (frame >= FRAMES) {
        const label = made
          ? (score > 0.82 ? 'SILK ✓' : 'GOOD ✓')
          : (isAirball ? 'AIRBALL ✗' : 'MISS ✗')
        drawJsFrame(ctx, { ballX: RX, ballY: RY - 4, spinAngle, trail, text: label, textColor: made ? '#22c55e' : '#ef4444' })
        setLastResult({ made, comment, score })
        setShooting(false)
        setStats(prev => ({ makes: prev.makes + (made ? 1 : 0), attempts: prev.attempts + 1 }))
        if (!made) setHorse(h => h.length < 5 ? h + 'HORSE'[h.length] : h)
        return
      }

      drawJsFrame(ctx, { ballX: bx, ballY: by, spinAngle, trail, text: null })
      frame++
      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
  }

  const reset = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setHorse('')
    setLastResult(null)
    setStats({ makes: 0, attempts: 0 })
    setShooting(false)
    drawEmpty()
  }

  const kPct = kyriePct()
  const fgPct = stats.attempts > 0 ? Math.round((stats.makes / stats.attempts) * 100) : null
  const gameOver = horse === 'HORSE'

  return (
    <div className="rounded-2xl border border-forest-700/40 bg-forest-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-forest-800/60">
        <div>
          <h3 className="text-base font-semibold text-white">Jumpshot Lab — HORSE</h3>
          <p className="text-xs text-forest-400 font-mono mt-0.5">
            {lastResult ? lastResult.comment : "Set your form. Shoot. Don't spell HORSE."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 font-mono text-lg font-black tracking-widest bg-forest-950 px-2 py-0.5 rounded-md border border-forest-800/60 shadow-inner">
            {'HORSE'.split('').map((L, i) => (
              <span key={i} className={i < horse.length ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-forest-800/50'}>{L}</span>
            ))}
          </div>
          {fgPct !== null && (
            <span className="text-xs font-mono text-forest-500">
              {stats.makes}/{stats.attempts} ({fgPct}%)
            </span>
          )}
          <button
            onClick={reset}
            className="text-xs text-forest-500 hover:text-white border border-forest-800 hover:border-forest-500 rounded-md px-2.5 py-1 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="px-4 pt-4">
        <canvas
          ref={canvasRef}
          width={JS.W}
          height={JS.H}
          className="w-full block rounded-lg"
        />
      </div>

      {gameOver ? (
        <div className="text-center py-10 px-6">
          <p className="font-mono text-3xl font-black text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] tracking-[0.2em] mb-2">H-O-R-S-E</p>
          <p className="text-forest-300 text-sm mb-6 leading-relaxed">
            You shot <span className="font-bold text-white">{fgPct}%</span> from the field with <span className="font-bold text-white">{stats.makes}</span> makes.<br/>
            Analyze your form and try again to improve your consistency.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl bg-candy-600 hover:bg-candy-500 text-white font-bold text-sm transition-all shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] hover:-translate-y-0.5"
          >
            Run It Back
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* Kyrie form meter */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-forest-500">Kyrie Form Match</span>
              <span style={{ color: kPct > 75 ? '#10b981' : kPct > 50 ? '#f59e0b' : '#ef4444' }}>
                {kPct}%
              </span>
            </div>
            <div className="h-1.5 bg-forest-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${kPct}%`,
                  background: kPct > 75 ? '#10b981' : kPct > 50 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <JsSlider label="Arc" sub="lift" value={arc} min={30} max={70} onChange={setArc} unit="°" kyrie={55} edu="Optimal arc (approx 45-55°) maximizes the effective size of the hoop." />
            <JsSlider label="Release" sub="timing" value={rel} min={0} max={100} onChange={setRel} kyrie={82} edu="Releasing at the apex of the jump transfers maximum kinetic energy from the legs." />
            <JsSlider label="Backspin" sub="touch" value={spin} min={0} max={10} onChange={setSpin} kyrie={8} edu="Backspin softens the bounce off the rim, increasing the chance of a favorable roll." />
            <JsSlider label="Footwork" sub="gather" value={gather} min={0} max={100} onChange={setGather} kyrie={75} edu="A balanced gather sets the foundation for a stable upward transfer of power." />
          </div>

          {/* Shot type + shoot */}
          <div className="flex gap-3 pt-1">
            <select
              value={shotType}
              onChange={e => setShotType(e.target.value)}
              disabled={shooting}
              className="flex-1 bg-forest-950/60 border border-forest-700/50 rounded-lg px-3 py-2 text-forest-200 text-sm focus:outline-none focus:border-candy-500/50"
            >
              {JS_SHOT_TYPES.map(t => <option key={t.label}>{t.label}</option>)}
            </select>
            <button
              onClick={shoot}
              disabled={shooting}
              className="flex-1 py-2 rounded-xl bg-candy-600 hover:bg-candy-500 disabled:bg-forest-700 disabled:text-forest-500 text-white font-semibold text-sm transition-colors"
            >
              {shooting ? 'In the air…' : 'Shoot'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── System Layer Data ─────────────────────────────────────────────────────────

const SYSTEM_LAYERS = [
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
  { category: 'Testing', items: ['pytest', 'C++ unit tests', 'E2E bot suite', 'Balance analysis'] },
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
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-forest-500/60" strokeWidth={1.5} strokeDasharray="6 3" markerEnd="url(#arrowHead)" />
            <text x={mx} y={my - 6} textAnchor="middle" className="fill-forest-400 text-[9px] font-mono">{edge.label}</text>
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

// ── TFT Backtest Section ──────────────────────────────────────────────────────

function TftBacktestSection() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [heroPlayerId] = useState(2544) // LeBron ESPN id — fallback if not in backtest
  const [heroData, setHeroData] = useState(null)

  useEffect(() => {
    fetch('/api/nba/tft/summary').then(async (r) => {
      if (r.ok) setSummary(await r.json())
      else setError((await r.json()).error)
    }).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!heroPlayerId) return
    fetch(`/api/nba/tft/player/${heroPlayerId}`).then(async (r) => {
      if (r.ok) setHeroData(await r.json())
      else setHeroData(null)
    }).catch(() => setHeroData(null))
  }, [heroPlayerId])

  if (error) return <div className="text-sm opacity-70">Backtest not yet activated: {error}</div>
  if (!summary) return <div className="text-sm opacity-70">Loading backtest...</div>

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Scorecard label="Wins MAE" value={summary.metrics?.best_loss?.toFixed(3) ?? 'n/a'} />
        <Scorecard label="Fit season" value={summary.fit_season} />
        <Scorecard label="Version" value={summary.version} />
      </div>
      <div>
        <h3 className="text-xl mb-3">Team residuals</h3>
        <TeamResidualsTable rows={summary.teams ?? []} />
      </div>
      {heroData && (
        <div>
          <h3 className="text-xl mb-3">Player shot origins (sim vs prior)</h3>
          <ShotHeatmap simBins={heroData.sim_shot_bins ?? {}} priorBins={heroData.actual_shot_bins ?? {}} />
        </div>
      )}
      <div>
        <h3 className="text-xl mb-3">Active coefficients</h3>
        <CoefficientsTable coeffs={summary.coefficients ?? {}} />
      </div>
      <details className="text-sm opacity-80">
        <summary className="cursor-pointer opacity-100">Methodology</summary>
        <p className="mt-3 leading-relaxed">
          The engine uses a stat-mapper (real season stats → 0-100 ratings) feeding a
          Monte Carlo game simulator. Coefficients are fit with CMA-ES against a
          weighted multi-objective loss: L = 0.4·L_wl + 0.4·L_box + 0.2·L_spa,
          where L_wl is MAE of season wins ÷ 82, L_box is per-player normalized
          RMSE across (PTS, REB, AST), and L_spa is Jensen-Shannon divergence
          between simulated and prior 8-zone shot-origin distributions.
          Shot priors are generated from position, height, and 3-point rate;
          real shot-chart ingest is deferred pending a new data source (stats.nba.com
          stopped serving in 2026). Scheme extraction is a heuristic pattern-match
          on opponent shot mix.
        </p>
      </details>
    </div>
  )
}

function Scorecard({ label, value }) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-2xl font-mono mt-1">{value}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BasketballPlatformPage() {
  return (
    <main className="min-h-screen bg-forest-950 text-white font-sans">
      <Head>
        <title>Basketball Data Platform | Brooks Roley</title>
        <meta name="description" content="A unified basketball analytics system: Python data pipeline, C++ WASM simulation engine, Vue 3 auto-battler game, and native SwiftUI iOS app." />
        <meta property="og:title" content="Basketball Data Platform | Brooks Roley" />
        <meta property="og:description" content="Real-time NBA analytics, physics-based simulation, and interactive game experiences — built across Python, C++, Vue 3, and SwiftUI." />
        <meta property="og:image" content="/BRBaller.png" />
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
