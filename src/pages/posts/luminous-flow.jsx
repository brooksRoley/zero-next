import { useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import SupportCta from 'src/components/SupportCta'

/* ═══════════════════════════════════════════════════════
   SIMPLEX NOISE  —  compact 2D/3D implementation
   ═══════════════════════════════════════════════════════ */
const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const F3 = 1 / 3
const G3 = 1 / 6

const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
]

function buildPerm(seed) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  // Fisher-Yates with seed
  let s = seed
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647
    const j = s % (i + 1)
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  const permMod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod12[i] = perm[i] % 12
  }
  return { perm, permMod12 }
}

function createNoise(seed = 42) {
  const { perm, permMod12 } = buildPerm(seed)

  function noise3D(x, y, z) {
    const s = (x + y + z) * F3
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const k = Math.floor(z + s)
    const t = (i + j + k) * G3
    const X0 = i - t, Y0 = j - t, Z0 = k - t
    const x0 = x - X0, y0 = y - Y0, z0 = z - Z0

    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0 }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1 }
      else               { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1 }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1 }
      else if (x0 < z0)  { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1 }
      else               { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0 }
    }

    const x1 = x0-i1+G3, y1 = y0-j1+G3, z1 = z0-k1+G3
    const x2 = x0-i2+2*G3, y2 = y0-j2+2*G3, z2 = z0-k2+2*G3
    const x3 = x0-1+3*G3, y3 = y0-1+3*G3, z3 = z0-1+3*G3

    const ii = i & 255, jj = j & 255, kk = k & 255

    const corners = [
      [x0,y0,z0, permMod12[ii+perm[jj+perm[kk]]]],
      [x1,y1,z1, permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]],
      [x2,y2,z2, permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]],
      [x3,y3,z3, permMod12[ii+1+perm[jj+1+perm[kk+1]]]],
    ]

    let n = 0
    for (const [cx, cy, cz, gi] of corners) {
      const t2 = 0.6 - cx*cx - cy*cy - cz*cz
      if (t2 > 0) {
        const t4 = t2 * t2
        const g = grad3[gi]
        n += t4 * t4 * (g[0]*cx + g[1]*cy + g[2]*cz)
      }
    }
    return 32 * n
  }

  return { noise3D }
}

/* ═══════════════════════════════════════════════════════
   CURL NOISE  —  divergence-free velocity from noise
   ═══════════════════════════════════════════════════════ */
function curlNoise(noise, x, y, z, eps = 0.0001) {
  // curl = ∇ × F — produces incompressible (divergence-free) flow
  const dx = (noise.noise3D(x, y + eps, z) - noise.noise3D(x, y - eps, z)) / (2 * eps)
  const dy = (noise.noise3D(x + eps, y, z) - noise.noise3D(x - eps, y, z)) / (2 * eps)
  return { vx: dx, vy: -dy }
}

/* ═══════════════════════════════════════════════════════
   COLOR PALETTE  —  oceanic → aurora → nebula
   ═══════════════════════════════════════════════════════ */
function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function palette(t) {
  // t: 0..1 → deep blue → teal → aurora green → pink → deep blue
  const stops = [
    [8, 20, 60],       // deep ocean
    [10, 80, 120],     // dark teal
    [20, 180, 140],    // aurora green
    [100, 220, 180],   // bright aurora
    [200, 120, 180],   // nebula pink
    [255, 105, 180],   // hot pink
    [120, 40, 140],    // deep purple
    [8, 20, 60],       // back to deep ocean
  ]
  const seg = (stops.length - 1)
  const idx = t * seg
  const i = Math.min(Math.floor(idx), seg - 1)
  const frac = idx - i
  return lerpColor(stops[i], stops[i + 1], frac)
}

/* ═══════════════════════════════════════════════════════
   PARTICLE
   ═══════════════════════════════════════════════════════ */
function createParticle(w, h, layerIdx, numLayers) {
  const depth = (layerIdx + Math.random()) / numLayers  // 0=far, 1=near
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    depth,
    speed: 0.3 + depth * 1.2,
    size: 0.4 + depth * 1.8,
    life: Math.random() * 600 + 200,
    maxLife: 800,
    age: 0,
    hueOffset: Math.random(),
    layerIdx,
  }
}

function resetParticle(p, w, h) {
  // respawn at edges or random position
  const edge = Math.random()
  if (edge < 0.25) { p.x = 0; p.y = Math.random() * h }
  else if (edge < 0.5) { p.x = w; p.y = Math.random() * h }
  else if (edge < 0.75) { p.x = Math.random() * w; p.y = 0 }
  else { p.x = Math.random() * w; p.y = h }
  p.vx = 0
  p.vy = 0
  p.age = 0
  p.life = Math.random() * 600 + 200
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function LuminousFlow() {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const noise = createNoise(Math.random() * 10000 | 0)
    const NUM_LAYERS = 3
    const PARTICLES_PER_LAYER = Math.min(Math.floor((w * h) / 600), 1800)
    const particles = []
    for (let layer = 0; layer < NUM_LAYERS; layer++) {
      for (let i = 0; i < PARTICLES_PER_LAYER; i++) {
        particles.push(createParticle(w, h, layer, NUM_LAYERS))
      }
    }

    stateRef.current = {
      ctx, w, h, dpr, noise, particles,
      mouse: { x: w / 2, y: h / 2, active: false },
      time: 0,
      noiseScale: 0.002,
      timeScale: 0.0004,
    }

    // initial black fill
    ctx.fillStyle = '#020810'
    ctx.fillRect(0, 0, w, h)
  }, [])

  useEffect(() => {
    init()

    let raf
    const handleResize = () => {
      init()
    }
    const handleMouseMove = (e) => {
      if (stateRef.current) {
        stateRef.current.mouse.x = e.clientX
        stateRef.current.mouse.y = e.clientY
        stateRef.current.mouse.active = true
      }
    }
    const handleTouchMove = (e) => {
      if (stateRef.current && e.touches[0]) {
        stateRef.current.mouse.x = e.touches[0].clientX
        stateRef.current.mouse.y = e.touches[0].clientY
        stateRef.current.mouse.active = true
      }
    }
    const handleMouseLeave = () => {
      if (stateRef.current) stateRef.current.mouse.active = false
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave)

    function animate() {
      const S = stateRef.current
      if (!S) { raf = requestAnimationFrame(animate); return }
      const { ctx, w, h, noise, particles, mouse, noiseScale, timeScale } = S
      S.time++

      const t = S.time * timeScale

      // fade: semi-transparent overlay creates trails
      ctx.fillStyle = 'rgba(2, 8, 16, 0.035)'
      ctx.fillRect(0, 0, w, h)

      // global composite for glow
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.prevX = p.x
        p.prevY = p.y

        // curl noise flow field — 3D noise with time as z-axis
        const depthTimeOffset = p.depth * 0.3
        const curl = curlNoise(
          noise,
          p.x * noiseScale,
          p.y * noiseScale,
          t + depthTimeOffset,
        )

        p.vx += curl.vx * p.speed * 0.4
        p.vy += curl.vy * p.speed * 0.4

        // mouse vortex interaction
        if (mouse.active) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radius = 180
          if (dist < radius && dist > 1) {
            const force = (1 - dist / radius) * 3.5 * p.depth
            // perpendicular = vortex swirl
            const angle = Math.atan2(dy, dx)
            p.vx += Math.cos(angle + Math.PI / 2) * force
            p.vy += Math.sin(angle + Math.PI / 2) * force
            // slight attraction
            p.vx -= dx / dist * force * 0.15
            p.vy -= dy / dist * force * 0.15
          }
        }

        // damping
        p.vx *= 0.96
        p.vy *= 0.96

        p.x += p.vx
        p.y += p.vy
        p.age++

        // reset if out of bounds or expired
        if (p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50 || p.age > p.life) {
          resetParticle(p, w, h)
          continue
        }

        // color: based on velocity + position + time
        const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        const colorT = (Math.sin(p.hueOffset * 6.28 + t * 2 + vel * 0.5) * 0.5 + 0.5)
        const [r, g, b] = palette(colorT)

        // alpha: fade in/out at edges of life, depth-based brightness
        const lifeFrac = p.age / p.life
        const lifeAlpha = lifeFrac < 0.05 ? lifeFrac / 0.05
          : lifeFrac > 0.85 ? (1 - lifeFrac) / 0.15
          : 1
        const alpha = lifeAlpha * (0.15 + p.depth * 0.55) * Math.min(vel * 0.8, 1)

        // draw line from prev to current position
        ctx.beginPath()
        ctx.moveTo(p.prevX, p.prevY)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = `rgba(${r|0},${g|0},${b|0},${alpha.toFixed(3)})`
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.stroke()

        // glow dot at current position for brighter particles
        if (vel > 1.5 && p.depth > 0.5) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${Math.min(r+80,255)|0},${Math.min(g+80,255)|0},${Math.min(b+60,255)|0},${(alpha*0.4).toFixed(3)})`
          ctx.fill()
        }
      }

      ctx.globalCompositeOperation = 'source-over'

      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [init])

  return (
    <>
      <Head>
        <title>Luminous Flow | Brooks Roley</title>
        <meta name="description" content="Interactive fluid art built with curl noise, dynamic lighting, and particle physics." />
        <meta property="og:title" content="Luminous Flow | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Interactive fluid art built with curl noise, dynamic lighting, and particle physics." key="og:description" />
        <meta property="og:image" content="/water1.jpg" key="og:image" />
      </Head>
      <div className="relative w-screen h-screen overflow-hidden bg-[#020810] cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        {/* Overlay UI */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 sm:p-10">
          <div className="flex justify-between items-start">
            <Link href="/" className="pointer-events-auto text-white/30 hover:text-white/70 transition-colors text-sm font-mono tracking-wider">
              &larr; back
            </Link>
          </div>
          <div className="flex justify-end">
            <SupportCta
              page="/posts/luminous-flow"
              location="luminous_flow_tip"
              label="support development →"
              className="pointer-events-auto text-white/30 hover:text-white/70 transition-colors text-sm font-mono tracking-wider"
            />
          </div>
        </div>
      </div>
    </>
  )
}
