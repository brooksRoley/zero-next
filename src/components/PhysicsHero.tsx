import Link from 'next/link'
import { ReactNode, useEffect, useRef } from 'react'
import Matter from 'matter-js'
import PreText from 'src/components/PreText'

const PALETTE = {
  mist: '#DADBD9',
  slate: '#415557',
  stone: '#B9968D',
  copper: '#B27236',
  aqua: '#C5E7EA',
}

type TokenTone = 'aqua' | 'stone' | 'copper' | 'slate'

type TokenSpec = {
  label: string
  href: string
  tone: TokenTone
  w: number
  h: number
  desktop: [number, number]
  mobile: [number, number]
}

type StageRect = {
  x: number
  y: number
  w: number
  h: number
}

type Pulse = {
  x: number
  y: number
  radius: number
  alpha: number
}

type TokenState = TokenSpec & {
  body: Matter.Body
  anchorX: number
  anchorY: number
}

const TOKEN_SPECS: TokenSpec[] = [
  {
    label: 'Game Systems',
    href: '/posts/pente',
    tone: 'aqua',
    w: 156,
    h: 50,
    desktop: [0.22, 0.2],
    mobile: [0.22, 0.16],
  },
  {
    label: 'Canvas Motion',
    href: '/posts/luminous-flow',
    tone: 'stone',
    w: 168,
    h: 50,
    desktop: [0.7, 0.22],
    mobile: [0.72, 0.22],
  },
  {
    label: 'Fast Feedback',
    href: '/nba',
    tone: 'copper',
    w: 164,
    h: 52,
    desktop: [0.55, 0.5],
    mobile: [0.5, 0.5],
  },
  {
    label: 'Layered Surfaces',
    href: '/basketball-platform',
    tone: 'slate',
    w: 184,
    h: 50,
    desktop: [0.3, 0.74],
    mobile: [0.2, 0.76],
  },
  {
    label: 'Featured Work',
    href: '/#featured',
    tone: 'aqua',
    w: 158,
    h: 50,
    desktop: [0.78, 0.76],
    mobile: [0.78, 0.74],
  },
]

export default function PhysicsHero({ featured }: { featured?: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tokenRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const pointerRef = useRef({
    x: 0,
    y: 0,
    stageX: 0,
    stageY: 0,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    active: false,
    inStage: false,
    kick: 0,
  })

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!section || !canvas || !stage) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.16 },
    })
    engine.positionIterations = 8
    engine.velocityIterations = 6

    const pulses: Pulse[] = []
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let frame = 0
    let last = performance.now()
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let scene: {
      width: number
      height: number
      stageRect: StageRect
      tokens: TokenState[]
    } = {
      width: 0,
      height: 0,
      stageRect: { x: 0, y: 0, w: 0, h: 0 },
      tokens: [],
    }

    const setCanvasSize = (width: number, height: number) => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const rebuild = () => {
      const sectionRect = section.getBoundingClientRect()
      const stageRectAbs = stage.getBoundingClientRect()
      const width = Math.max(1, Math.round(sectionRect.width))
      const height = Math.max(1, Math.round(sectionRect.height))
      const stageRect = {
        x: stageRectAbs.left - sectionRect.left,
        y: stageRectAbs.top - sectionRect.top,
        w: Math.max(1, Math.round(stageRectAbs.width)),
        h: Math.max(1, Math.round(stageRectAbs.height)),
      }

      setCanvasSize(width, height)
      Matter.World.clear(engine.world, false)

      const wall = 80
      const bodies: Matter.Body[] = [
        Matter.Bodies.rectangle(stageRect.w / 2, -wall / 2, stageRect.w + wall * 2, wall, { isStatic: true }),
        Matter.Bodies.rectangle(stageRect.w / 2, stageRect.h + wall / 2, stageRect.w + wall * 2, wall, { isStatic: true }),
        Matter.Bodies.rectangle(-wall / 2, stageRect.h / 2, wall, stageRect.h + wall * 2, { isStatic: true }),
        Matter.Bodies.rectangle(stageRect.w + wall / 2, stageRect.h / 2, wall, stageRect.h + wall * 2, { isStatic: true }),
      ]

      const isMobile = stageRect.w < 420
      const tokens = TOKEN_SPECS.map(spec => {
        const [nx, ny] = isMobile ? spec.mobile : spec.desktop
        const anchorX = stageRect.w * nx
        const anchorY = stageRect.h * ny
        const body = Matter.Bodies.rectangle(anchorX, anchorY, spec.w, spec.h, {
          chamfer: { radius: spec.h / 2 },
          frictionAir: 0.07,
          friction: 0.002,
          restitution: 0.92,
          density: 0.0018,
        })
        Matter.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 1.4,
          y: (Math.random() - 0.5) * 1.4,
        })
        bodies.push(body)
        return { ...spec, body, anchorX, anchorY }
      })

      Matter.World.add(engine.world, bodies)
      scene = { width, height, stageRect, tokens }
    }

    const addPulse = (x: number, y: number, boost = 1) => {
      pulses.push({
        x,
        y,
        radius: 14,
        alpha: 0.26 + boost * 0.12,
      })
    }

    const updatePointer = (clientX: number, clientY: number) => {
      const sectionRect = section.getBoundingClientRect()
      const stageRectAbs = stage.getBoundingClientRect()
      const pointer = pointerRef.current
      const x = clientX - sectionRect.left
      const y = clientY - sectionRect.top

      pointer.vx = x - pointer.lastX
      pointer.vy = y - pointer.lastY
      pointer.lastX = x
      pointer.lastY = y
      pointer.x = x
      pointer.y = y
      pointer.stageX = clientX - stageRectAbs.left
      pointer.stageY = clientY - stageRectAbs.top
      pointer.active = true
      pointer.inStage =
        pointer.stageX >= 0 &&
        pointer.stageX <= stageRectAbs.width &&
        pointer.stageY >= 0 &&
        pointer.stageY <= stageRectAbs.height
    }

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY)
    }

    const handlePointerLeave = () => {
      const pointer = pointerRef.current
      pointer.active = false
      pointer.inStage = false
    }

    const handlePointerDown = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY)
      const pointer = pointerRef.current
      pointer.kick = Math.min(1.8, pointer.kick + 1.25)
      addPulse(pointer.x, pointer.y, 1.3)
    }

    const draw = (time: number, energy: number, wPhase: number) => {
      ctx.clearRect(0, 0, scene.width, scene.height)
      drawStageAura(ctx, scene, pointerRef.current, time, energy)
      drawStageContours(ctx, scene.stageRect, pointerRef.current, energy, wPhase)
      drawTokenGlows(ctx, scene, time, energy, wPhase)
      drawPulses(ctx, pulses)
      drawLandscape(ctx, scene.width, scene.height, time, pointerRef.current, energy, wPhase)
    }

    const syncTokens = (energy: number, wPhase: number) => {
      const { stageRect, tokens } = scene
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        const el = tokenRefs.current[index]
        if (!el) continue

        const depth = clamp(token.body.position.y / Math.max(stageRect.h, 1), 0, 1)
        const scale = 0.9 + depth * 0.14 + energy * 0.04 - wPhase * 0.02
        const worldX = token.body.position.x - token.w / 2
        const worldY = token.body.position.y - token.h / 2

        el.style.transform = `translate3d(${worldX}px, ${worldY}px, 0) scale(${scale}) rotate(${token.body.angle * 0.6}rad)`
        el.style.opacity = `${0.72 + depth * 0.18}`
      }
    }

    const loop = (now: number) => {
      const dt = Math.min(32, now - last)
      last = now

      const pointer = pointerRef.current
      const pointerSpeed = Math.min(18, Math.hypot(pointer.vx, pointer.vy))
      const wPhase = clamp(window.scrollY / Math.max(window.innerHeight * 0.9, 1), 0, 1)
      const energy = clamp(
        (pointer.active ? 0.16 : 0.03) + pointerSpeed * 0.032 + pointer.kick * 0.16 + wPhase * 0.14,
        0,
        1,
      )

      pointer.vx *= 0.82
      pointer.vy *= 0.82
      pointer.kick *= 0.92

      for (let index = 0; index < scene.tokens.length; index++) {
        const token = scene.tokens[index]
        const bob = reducedMotion ? 0 : Math.sin(now * 0.001 + index * 1.3) * 10
        const targetY = token.anchorY + bob - wPhase * 14
        const springX = token.anchorX - token.body.position.x
        const springY = targetY - token.body.position.y

        Matter.Body.applyForce(token.body, token.body.position, {
          x: springX * 0.00014 * token.body.mass,
          y: springY * 0.00014 * token.body.mass,
        })

        if (!reducedMotion) {
          Matter.Body.applyForce(token.body, token.body.position, {
            x: Math.sin(now * 0.0014 + index * 1.7) * 0.000028,
            y: Math.cos(now * 0.0011 + index * 1.3) * 0.000024,
          })
        }

        if (pointer.active && pointer.inStage) {
          const dx = token.body.position.x - pointer.stageX
          const dy = token.body.position.y - pointer.stageY
          const dist = Math.hypot(dx, dy)
          if (dist < 170) {
            const influence = 1 - dist / 170
            const force = 0.0008 * influence * influence * (1 + pointerSpeed * 0.06 + pointer.kick * 0.2)
            Matter.Body.applyForce(token.body, token.body.position, {
              x: (dx / Math.max(dist, 1)) * force,
              y: (dy / Math.max(dist, 1)) * force,
            })
          }
        }

        for (const pulse of pulses) {
          const wx = scene.stageRect.x + token.body.position.x
          const wy = scene.stageRect.y + token.body.position.y
          const dx = wx - pulse.x
          const dy = wy - pulse.y
          const dist = Math.hypot(dx, dy)
          if (dist < pulse.radius + 96) {
            const influence = 1 - dist / (pulse.radius + 96)
            Matter.Body.applyForce(token.body, token.body.position, {
              x: (dx / Math.max(dist, 1)) * influence * 0.00045,
              y: (dy / Math.max(dist, 1)) * influence * 0.00045,
            })
          }
        }
      }

      Matter.Engine.update(engine, reducedMotion ? 10 : dt)

      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].radius += 5.5
        pulses[i].alpha *= 0.94
        if (pulses[i].alpha < 0.01) pulses.splice(i, 1)
      }

      draw(now, energy, wPhase)
      syncTokens(energy, wPhase)
      frame = requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(rebuild)
    resizeObserver.observe(section)
    resizeObserver.observe(stage)

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
    }

    rebuild()
    frame = requestAnimationFrame(loop)
    section.addEventListener('pointermove', handlePointerMove)
    section.addEventListener('pointerleave', handlePointerLeave)
    section.addEventListener('pointerdown', handlePointerDown)
    mql.addEventListener?.('change', handleMotionChange)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      section.removeEventListener('pointermove', handlePointerMove)
      section.removeEventListener('pointerleave', handlePointerLeave)
      section.removeEventListener('pointerdown', handlePointerDown)
      mql.removeEventListener?.('change', handleMotionChange)
      Matter.World.clear(engine.world, false)
      Matter.Engine.clear(engine)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="terrain-hero relative overflow-hidden text-[#DADBD9]"
      aria-labelledby="home-hero-title"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex min-h-[74vh] max-w-6xl flex-col justify-center gap-10 px-4 py-16 sm:px-6 md:min-h-[82vh] md:flex-row md:items-center md:gap-14 md:py-20">
        <div className="max-w-2xl md:flex-[1.05]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#C5E7EA]/20 bg-[#DADBD9]/8 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-[#C5E7EA]/82 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#B27236]" aria-hidden="true" />
            <span>Los Angeles</span>
            <span className="text-[#DADBD9]/28">/</span>
            <span>games and tools</span>
          </div>

          <div className="mb-4">
            <PreText
              text="Brooks Roley"
              mode="flow"
              color={PALETTE.mist}
              accentColor={PALETTE.aqua}
              tag="h1"
              fontSize="clamp(3.35rem, 9vw, 6.8rem)"
              fontWeight="800"
              interactive
              fieldRadius={110}
              fieldStrength={0.55}
              settle={0.095}
              className="max-w-max"
              style={{ lineHeight: 0.9 }}
            />
            <span id="home-hero-title" className="sr-only">
              Brooks Roley
            </span>
          </div>

          <p className="max-w-xl text-base leading-7 text-[#DADBD9]/80 sm:text-lg sm:leading-8">
            Software engineer building games, tools, and responsive web systems with
            a bias toward fast feedback, tactile motion, and layered interfaces.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#featured"
              className="inline-flex items-center gap-2 rounded-full border border-[#C5E7EA]/22 bg-[#C5E7EA]/10 px-4 py-2 text-sm font-medium text-[#DADBD9] transition-colors hover:border-[#C5E7EA]/38 hover:bg-[#C5E7EA]/16"
            >
              <span>Explore work</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
            <Link
              href="/resume"
              className="inline-flex items-center gap-2 rounded-full border border-[#B9968D]/24 bg-[#B27236]/10 px-4 py-2 text-sm font-medium text-[#DADBD9] transition-colors hover:border-[#B9968D]/40 hover:bg-[#B27236]/16"
            >
              <span>Resume</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          <a
            href="#featured"
            aria-label="Scroll to featured work"
            className="mt-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[#C5E7EA]/62 transition-colors hover:text-[#DADBD9]"
          >
            <span>Scroll</span>
            <span aria-hidden="true">v</span>
          </a>
        </div>

        <div className="relative w-full md:flex-1">
          <div
            ref={stageRef}
            className="terrain-stage relative mx-auto h-[300px] w-full max-w-[440px] sm:h-[340px] md:h-[420px]"
          >
            <div className="pointer-events-none absolute inset-[12%] rounded-[999px] border border-[#C5E7EA]/10" />
            <div className="pointer-events-none absolute inset-x-[18%] top-[48%] h-px bg-[#C5E7EA]/12" />
            <div className="pointer-events-none absolute inset-0 rounded-[42px] bg-[radial-gradient(circle_at_50%_50%,rgba(197,231,234,0.08),rgba(65,85,87,0)_60%)]" />

            <nav aria-label="Hero shortcuts">
              {TOKEN_SPECS.map((token, index) => (
                <Link
                  key={token.label}
                  href={token.href}
                  ref={el => {
                    tokenRefs.current[index] = el
                  }}
                  className={`terrain-token terrain-token--${token.tone}`}
                  style={{ width: token.w, height: token.h }}
                >
                  {token.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {featured ? (
        <div id="featured" className="relative z-10 mx-auto max-w-6xl px-4 pb-14 sm:px-6 md:pb-18">
          {featured}
        </div>
      ) : null}
    </section>
  )
}

function drawStageAura(
  ctx: CanvasRenderingContext2D,
  scene: { width: number; height: number; stageRect: StageRect },
  pointer: { x: number; y: number; active: boolean },
  time: number,
  energy: number,
) {
  const { width, height, stageRect } = scene
  const px = pointer.active ? pointer.x : width * 0.32
  const py = pointer.active ? pointer.y : height * 0.24

  const glow = ctx.createRadialGradient(px, py, 0, px, py, width * 0.32)
  glow.addColorStop(0, withAlpha(PALETTE.aqua, 0.12 + energy * 0.08))
  glow.addColorStop(0.45, withAlpha(PALETTE.stone, 0.08 + energy * 0.05))
  glow.addColorStop(1, withAlpha(PALETTE.aqua, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const stageCx = stageRect.x + stageRect.w / 2
  const stageCy = stageRect.y + stageRect.h / 2
  const stageGlow = ctx.createRadialGradient(stageCx, stageCy, 0, stageCx, stageCy, stageRect.w * 0.72)
  stageGlow.addColorStop(0, withAlpha(PALETTE.aqua, 0.14 + energy * 0.06))
  stageGlow.addColorStop(0.52, withAlpha(PALETTE.copper, 0.08))
  stageGlow.addColorStop(1, withAlpha(PALETTE.slate, 0))
  ctx.fillStyle = stageGlow
  ctx.fillRect(stageRect.x - 120, stageRect.y - 120, stageRect.w + 240, stageRect.h + 240)

  const beamY = height * (0.22 + Math.sin(time * 0.0004) * 0.02)
  const beam = ctx.createLinearGradient(0, beamY - 120, 0, beamY + 120)
  beam.addColorStop(0, withAlpha(PALETTE.aqua, 0))
  beam.addColorStop(0.5, withAlpha(PALETTE.aqua, 0.06))
  beam.addColorStop(1, withAlpha(PALETTE.aqua, 0))
  ctx.fillStyle = beam
  ctx.fillRect(0, beamY - 120, width, 240)
}

function drawStageContours(
  ctx: CanvasRenderingContext2D,
  stageRect: StageRect,
  pointer: { stageX: number; stageY: number; inStage: boolean },
  energy: number,
  wPhase: number,
) {
  const offsetX = pointer.inStage ? (pointer.stageX / stageRect.w - 0.5) * 26 : 0
  const offsetY = pointer.inStage ? (pointer.stageY / stageRect.h - 0.5) * 18 : 0
  const centerX = stageRect.x + stageRect.w / 2 + offsetX
  const centerY = stageRect.y + stageRect.h / 2 + offsetY - wPhase * 10

  ctx.save()
  for (let i = 0; i < 4; i++) {
    const ratio = i / 3
    ctx.strokeStyle = withAlpha(PALETTE.aqua, 0.06 + (1 - ratio) * 0.06 + energy * 0.04)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(
      centerX,
      centerY,
      stageRect.w * (0.19 + ratio * 0.18),
      stageRect.h * (0.14 + ratio * 0.14),
      -0.22 + ratio * 0.1,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }
  ctx.restore()
}

function drawTokenGlows(
  ctx: CanvasRenderingContext2D,
  scene: { stageRect: StageRect; tokens: TokenState[] },
  time: number,
  energy: number,
  wPhase: number,
) {
  const projection = 10 + energy * 22 + wPhase * 18
  for (let index = 0; index < scene.tokens.length; index++) {
    const token = scene.tokens[index]
    const x = scene.stageRect.x + token.body.position.x
    const y = scene.stageRect.y + token.body.position.y
    const shadowX = x + projection * (0.18 + index * 0.03)
    const shadowY = y - projection * 0.26
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0012 + index)
    const color = toneColor(token.tone)

    ctx.fillStyle = withAlpha(color, 0.06 + pulse * 0.07)
    ctx.beginPath()
    ctx.ellipse(shadowX, shadowY, token.w * 0.42, token.h * 0.75, token.body.angle * 0.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = withAlpha(PALETTE.mist, 0.03 + pulse * 0.03)
    ctx.beginPath()
    ctx.ellipse(x, y + token.h * 0.7, token.w * 0.28, token.h * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPulses(ctx: CanvasRenderingContext2D, pulses: Pulse[]) {
  for (const pulse of pulses) {
    ctx.lineWidth = 1.25
    ctx.strokeStyle = withAlpha(PALETTE.aqua, pulse.alpha)
    ctx.beginPath()
    ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = withAlpha(PALETTE.copper, pulse.alpha * 0.55)
    ctx.beginPath()
    ctx.arc(pulse.x, pulse.y, Math.max(0, pulse.radius - 7), 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawLandscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  pointer: { x: number; y: number; active: boolean },
  energy: number,
  wPhase: number,
) {
  const px = pointer.active ? pointer.x / width : 0.42
  const py = pointer.active ? pointer.y / height : 0.32

  drawLandscapeLayer(ctx, {
    width,
    height,
    time,
    fill: withAlpha(PALETTE.slate, 0.76),
    stroke: withAlpha(PALETTE.aqua, 0.16),
    baseY: 0.57 - wPhase * 0.03,
    amplitude: 20,
    freq: 0.008,
    speed: 0.00022,
    pointerShift: (px - 0.5) * 24,
    lift: (py - 0.5) * 14,
    detail: 0.45,
  })

  drawLandscapeLayer(ctx, {
    width,
    height,
    time,
    fill: withAlpha(PALETTE.stone, 0.34),
    stroke: withAlpha(PALETTE.mist, 0.18),
    baseY: 0.68 - wPhase * 0.018,
    amplitude: 26 + energy * 8,
    freq: 0.0105,
    speed: 0.0003,
    pointerShift: (px - 0.5) * 34,
    lift: (py - 0.5) * 18,
    detail: 0.7,
  })

  drawLandscapeLayer(ctx, {
    width,
    height,
    time,
    fill: withAlpha(PALETTE.copper, 0.4),
    stroke: withAlpha(PALETTE.aqua, 0.22),
    baseY: 0.79 + wPhase * 0.02,
    amplitude: 18 + energy * 10,
    freq: 0.013,
    speed: 0.00042,
    pointerShift: (px - 0.5) * 52,
    lift: (py - 0.5) * 20,
    detail: 1,
  })
}

function drawLandscapeLayer(
  ctx: CanvasRenderingContext2D,
  options: {
    width: number
    height: number
    time: number
    fill: string
    stroke: string
    baseY: number
    amplitude: number
    freq: number
    speed: number
    pointerShift: number
    lift: number
    detail: number
  },
) {
  const {
    width,
    height,
    time,
    fill,
    stroke,
    baseY,
    amplitude,
    freq,
    speed,
    pointerShift,
    lift,
    detail,
  } = options

  const yBase = height * baseY
  ctx.beginPath()
  ctx.moveTo(0, height)

  for (let x = 0; x <= width + 24; x += 24) {
    const sway =
      Math.sin(x * freq + time * speed) * amplitude +
      Math.cos(x * freq * 0.55 + time * speed * 1.7) * amplitude * 0.45 * detail +
      pointerShift * Math.sin((x / width) * Math.PI)
    const y = yBase + sway + lift
    ctx.lineTo(x, y)
  }

  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()

  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width + 24; x += 24) {
    const sway =
      Math.sin(x * freq + time * speed) * amplitude +
      Math.cos(x * freq * 0.55 + time * speed * 1.7) * amplitude * 0.45 * detail +
      pointerShift * Math.sin((x / width) * Math.PI)
    const y = yBase + sway + lift
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function toneColor(tone: TokenTone) {
  if (tone === 'aqua') return PALETTE.aqua
  if (tone === 'stone') return PALETTE.stone
  if (tone === 'copper') return PALETTE.copper
  return PALETTE.slate
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
