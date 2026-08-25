/**
 * "Jumpshot Lab" — a canvas physics toy for /basketball-platform.
 *
 * Arc, release height, backspin and gather are the same four variables the C++
 * engine scores every shot on; this lets a visitor feel them before reading
 * about them. Animation runs on a canvas via requestAnimationFrame.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

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

export default function JumpshotSimulator() {
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
