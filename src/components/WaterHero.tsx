import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  ReactNode,
  RefObject,
} from 'react'

type Ripple = {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
  hue: number
  width: number
}

type GlyphRect = { x: number; y: number; w: number; h: number }

type GlyphCtx = {
  containerRef: RefObject<HTMLDivElement>
  register: (id: string, rects: GlyphRect[] | null) => void
}

const GlyphContext = createContext<GlyphCtx | null>(null)

/**
 * WaterHero — interactive ripple canvas layered over an animated
 * indigo→cyan→candy gradient. Children render as DOM (so text remains
 * accessible/selectable); WaterText children additionally publish
 * per-glyph rects through context so the ripple draw loop can omit
 * ring segments that pass through letterforms — water visibly parts
 * around the headline.
 */
export default function WaterHero({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ripplesRef = useRef<Ripple[]>([])
  const rafRef = useRef<number>(0)
  const lastMoveRef = useRef(0)

  // Glyph registry — keyed by source id so multiple WaterText instances
  // can co-exist without overwriting each other.
  const glyphMapRef = useRef<Map<string, GlyphRect[]>>(new Map())
  const glyphCacheRef = useRef<{
    flat: GlyphRect[]
    pad: number
    minX: number
    minY: number
    maxX: number
    maxY: number
  }>({ flat: [], pad: 6, minX: 0, minY: 0, maxX: 0, maxY: 0 })

  const recomputeGlyphCache = () => {
    const flat: GlyphRect[] = []
    glyphMapRef.current.forEach(rs => flat.push(...rs))
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const r of flat) {
      if (r.x < minX) minX = r.x
      if (r.y < minY) minY = r.y
      if (r.x + r.w > maxX) maxX = r.x + r.w
      if (r.y + r.h > maxY) maxY = r.y + r.h
    }
    glyphCacheRef.current = {
      flat,
      pad: 6,
      minX: flat.length ? minX : 0,
      minY: flat.length ? minY : 0,
      maxX: flat.length ? maxX : 0,
      maxY: flat.length ? maxY : 0,
    }
  }

  const ctx: GlyphCtx = {
    containerRef,
    register: (id, rects) => {
      if (rects && rects.length) glyphMapRef.current.set(id, rects)
      else glyphMapRef.current.delete(id)
      recomputeGlyphCache()
    },
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const c = canvas.getContext('2d', { alpha: true })
    if (!c) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const spawn = (x: number, y: number, strong = false) => {
      const count = strong ? 3 : 1
      for (let i = 0; i < count; i++) {
        ripplesRef.current.push({
          x,
          y,
          r: strong ? 4 + i * 6 : 0,
          maxR: strong ? 280 + Math.random() * 140 : 110 + Math.random() * 80,
          alpha: strong ? 0.78 : 0.34,
          hue: Math.random(),
          width: strong ? 2.4 : 1.1,
        })
      }
      if (ripplesRef.current.length > 220) {
        ripplesRef.current.splice(0, ripplesRef.current.length - 220)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now()
      if (now - lastMoveRef.current < 26) return
      lastMoveRef.current = now
      const rect = container.getBoundingClientRect()
      spawn(e.clientX - rect.left, e.clientY - rect.top, false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      spawn(e.clientX - rect.left, e.clientY - rect.top, true)
    }
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerdown', onPointerDown)

    let ambientAccum = 0
    let t = 0
    let last = performance.now()

    // Returns true if (px, py) sits inside any padded glyph rect.
    const insideGlyph = (px: number, py: number) => {
      const cache = glyphCacheRef.current
      if (cache.flat.length === 0) return false
      const p = cache.pad
      // Coarse aabb gate around the union of all rects.
      if (px < cache.minX - p || px > cache.maxX + p) return false
      if (py < cache.minY - p || py > cache.maxY + p) return false
      for (const r of cache.flat) {
        if (
          px >= r.x - p &&
          px <= r.x + r.w + p &&
          py >= r.y - p &&
          py <= r.y + r.h + p
        ) return true
      }
      return false
    }

    // Draws a ring with cutouts — segments whose midpoint sits inside a
    // glyph rect are skipped so the ripple visibly parts around letters.
    const drawRingWithCutouts = (
      cx: number,
      cy: number,
      radius: number,
      stroke: string,
      lineWidth: number,
    ) => {
      // Fast path — if nothing to deflect, draw a full arc.
      const cache = glyphCacheRef.current
      if (cache.flat.length === 0) {
        c.lineWidth = lineWidth
        c.strokeStyle = stroke
        c.beginPath()
        c.arc(cx, cy, radius, 0, Math.PI * 2)
        c.stroke()
        return
      }

      // Cheap reject: if the ring's bbox doesn't intersect the glyph
      // union bbox, skip per-segment checks entirely.
      const p = cache.pad
      const ringMinX = cx - radius, ringMaxX = cx + radius
      const ringMinY = cy - radius, ringMaxY = cy + radius
      if (
        ringMaxX < cache.minX - p ||
        ringMinX > cache.maxX + p ||
        ringMaxY < cache.minY - p ||
        ringMinY > cache.maxY + p
      ) {
        c.lineWidth = lineWidth
        c.strokeStyle = stroke
        c.beginPath()
        c.arc(cx, cy, radius, 0, Math.PI * 2)
        c.stroke()
        return
      }

      // Segment count scales with radius so larger rings stay smooth.
      const segs = Math.max(48, Math.min(160, Math.round(radius * 0.55)))
      const step = (Math.PI * 2) / segs

      c.lineWidth = lineWidth
      c.strokeStyle = stroke
      c.beginPath()
      let pen = false
      for (let i = 0; i <= segs; i++) {
        const a = i * step
        const x = cx + Math.cos(a) * radius
        const y = cy + Math.sin(a) * radius
        // Test segment midpoint by sampling slightly inside this vertex.
        const blocked = insideGlyph(x, y)
        if (blocked) {
          pen = false
          continue
        }
        if (!pen) {
          c.moveTo(x, y)
          pen = true
        } else {
          c.lineTo(x, y)
        }
      }
      c.stroke()
    }

    const draw = (dt: number) => {
      t += dt
      c.clearRect(0, 0, width, height)

      if (!prefersReduced) {
        ambientAccum += dt
        while (ambientAccum > 520) {
          ambientAccum -= 520
          spawn(Math.random() * width, Math.random() * height, false)
        }
      }

      c.globalCompositeOperation = 'lighter'
      const arr = ripplesRef.current
      for (let i = arr.length - 1; i >= 0; i--) {
        const r = arr[i]
        r.r += (r.maxR - r.r) * 0.02 + 0.7
        r.alpha *= 0.984
        if (r.alpha < 0.01 || r.r >= r.maxR - 1) {
          arr.splice(i, 1)
          continue
        }
        const cyanStroke = `rgba(125, 211, 252, ${r.alpha * (1 - r.hue * 0.6)})`
        const candyStroke = `rgba(255, 140, 194, ${r.alpha * (0.35 + r.hue * 0.4)})`

        drawRingWithCutouts(r.x, r.y, r.r, cyanStroke, r.width)
        drawRingWithCutouts(r.x, r.y, Math.max(0, r.r - 4), candyStroke, r.width * 0.55)
      }

      // Drifting caustic bands — screen-blended sine waves
      c.globalCompositeOperation = 'screen'
      const bandCount = 3
      for (let b = 0; b < bandCount; b++) {
        const phase = t * 0.00016 * (b + 1) + b * 1.3
        const y = (Math.sin(phase) * 0.5 + 0.5) * height
        const grad = c.createLinearGradient(0, y - 90, 0, y + 90)
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)')
        grad.addColorStop(0.5, `rgba(56, 189, 248, ${0.055 - b * 0.012})`)
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)')
        c.fillStyle = grad
        c.fillRect(0, y - 90, width, 180)
      }

      c.globalCompositeOperation = 'source-over'
    }

    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      draw(dt)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <GlyphContext.Provider value={ctx}>
      <section
        ref={containerRef}
        className="water-hero-bg relative overflow-hidden text-white"
      >
        <div className="water-gradient-base absolute inset-0" aria-hidden />
        <div className="water-caustic absolute inset-0" aria-hidden />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        />
        <div className="relative">{children}</div>
        <svg
          className="pointer-events-none absolute bottom-0 left-0 h-16 w-full text-void-950"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0 48 Q 180 12 360 42 T 720 40 T 1080 44 T 1440 36 V80 H0 Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      </section>
    </GlyphContext.Provider>
  )
}

/**
 * WaterText — accessible DOM text that publishes per-glyph rects (in
 * canvas-local coordinates) to its parent WaterHero so the ripple
 * draw loop can deflect rings around the letterforms. Re-measures on
 * font load and resize.
 */
export function WaterText({
  children,
  className,
  id,
}: {
  children: string
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  const reg = useContext(GlyphContext)
  const instanceId = useRef(id || `water-text-${Math.random().toString(36).slice(2)}`)

  useLayoutEffect(() => {
    if (!reg) return
    const el = ref.current
    const container = reg.containerRef.current
    if (!el || !container) return

    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const el2 = ref.current
      const c2 = reg.containerRef.current
      if (!el2 || !c2) return

      const cs = getComputedStyle(el2)
      const font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`

      const meas = document.createElement('canvas').getContext('2d')
      if (!meas) return
      meas.font = font

      // Measure each character's advance.
      const widths: number[] = []
      let total = 0
      for (const ch of children) {
        const w = meas.measureText(ch).width
        widths.push(w)
        total += w
      }

      const elRect = el2.getBoundingClientRect()
      const cRect = c2.getBoundingClientRect()

      // Headline is text-center inside a centered container — derive the
      // glyph baseline strip from element padding box and font metrics.
      const fontSize = parseFloat(cs.fontSize)
      // Approximate cap height as a fraction of font-size; close enough
      // for rounded sans-serif headers (Inter etc.) and we pad anyway.
      const ascent = fontSize * 0.78
      const descent = fontSize * 0.18

      const lineH = parseFloat(cs.lineHeight) || fontSize * 1.2
      const startX = elRect.left + (elRect.width - total) / 2 - cRect.left
      const baselineY =
        elRect.top + (elRect.height - lineH) / 2 + (lineH + ascent - descent) / 2 - cRect.top

      const rects: GlyphRect[] = []
      let x = startX
      for (let i = 0; i < children.length; i++) {
        const ch = children[i]
        const w = widths[i]
        if (ch !== ' ' && w > 0) {
          rects.push({
            x,
            y: baselineY - ascent,
            w,
            h: ascent + descent,
          })
        }
        x += w
      }
      reg.register(instanceId.current, rects)
    }

    measure()

    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      ;(document as any).fonts.ready.then(() => measure()).catch(() => {})
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (reg.containerRef.current) ro.observe(reg.containerRef.current)
    window.addEventListener('resize', measure)

    const id = instanceId.current
    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', measure)
      reg.register(id, null)
    }
  }, [children, reg])

  return (
    <h1 ref={ref} className={className}>{children}</h1>
  )
}
