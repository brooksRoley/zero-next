import { Fragment, useEffect, useRef, type CSSProperties, type ElementType } from 'react'
import { prefersReducedMotion } from 'src/lib/motion'
import { CREAM, BRASS_STEPS, heatAt, pickWeather, rng, sweepPosition, type Weather } from 'src/lib/ember/weather'
import { sampleDots, settleNow, stepDots, stepFor, throwSparks, type Dot } from 'src/lib/ember/field'

// Ember, the house light (docs/ART_DIRECTION.md). Words drawn as cream dots
// that fly in and settle; a brass band sweeps across them at irregular gaps,
// follows the pointer, and throws the odd spark. The real text stays in the
// DOM: visible until the canvas is ready, then transparent but still read by
// screen readers and selectable.

type Part = { text: string; accent?: boolean }

type EmberTextProps = {
  /** One string, or parts where `accent` parts rest in brass instead of cream. */
  text: string | Part[]
  as?: ElementType
  id?: string
  className?: string
  /** Applied to the text element: font size, weight, line height. */
  style?: CSSProperties
  /** Class for accent parts while the text is visible (no canvas yet). */
  accentClassName?: string
  /** Fixes the weather (tests, screenshots); otherwise one is drawn per visit. */
  seed?: number
}

const SEED_KEY = 'ember-seed'

function visitSeed(): number {
  try {
    const kept = sessionStorage.getItem(SEED_KEY)
    if (kept) return Number(kept) >>> 0
    const fresh = (Math.random() * 2 ** 32) >>> 0
    sessionStorage.setItem(SEED_KEY, String(fresh))
    return fresh
  } catch {
    return (Math.random() * 2 ** 32) >>> 0
  }
}

const ACCENT_REST = BRASS_STEPS[1]
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
const mix = (a: number[], b: number[], k: number) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k))

export default function EmberText({ text, as: Tag = 'h1', id, className = '', style, accentClassName = '', seed }: EmberTextProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const parts: Part[] = typeof text === 'string' ? [{ text }] : text
  const label = parts.map((p) => p.text).join('')

  useEffect(() => {
    const wrap = wrapRef.current
    const textEl = textRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !textEl || !canvas || !ctx) return

    const reduced = prefersReducedMotion()
    const weather: Weather = pickWeather(seed ?? visitSeed())
    const rand = rng((seed ?? 0) ^ 0x9e3779b9 ^ Math.floor(performance.now()))
    wrap.dataset.ember = `${weather.direction}${weather.flare ? ' flare' : ''}`

    let dots: Dot[] = []
    let W = 0, H = 0, pad = 0, fontSize = 16, r = 1
    // Small sizes get fuller, brighter dots: at a 2px step thin dots read as gray.
    let rest = 0.6
    let t0 = performance.now(), last = t0
    let raf = 0, running = false, visible = true, cancelled = false
    let arrived = false
    let sweepStart = -1, nextSweep = 0, flareUntil = 0, sweeps = 0
    let pointer: { x: number; y: number } | null = null
    let frameCount = 0
    // Reduced motion: a band resting this far in, instead of a moving one.
    let restAt: number | null = null

    function sample(keepSettled: boolean) {
      const cs = getComputedStyle(textEl!)
      fontSize = parseFloat(cs.fontSize)
      pad = Math.round(fontSize * 0.6)
      const tw = Math.ceil(textEl!.offsetWidth), th = Math.ceil(textEl!.offsetHeight)
      W = tw + pad * 2
      H = th + pad * 2
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = W * dpr
      canvas!.height = H * dpr
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      canvas!.style.left = `${-pad}px`
      canvas!.style.top = `${-pad}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const off = document.createElement('canvas')
      off.width = W
      off.height = H
      const o = off.getContext('2d', { willReadFrequently: true })
      if (!o) return
      o.font = `${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`
      if ('letterSpacing' in o && cs.letterSpacing !== 'normal') (o as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing
      const m = o.measureText(label)
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent
      const baseline = pad + (th - (ascent + descent)) / 2 + ascent
      let x = pad
      for (const p of parts) {
        o.fillStyle = p.accent ? '#ff0000' : '#ffffff'
        o.fillText(p.text, x, baseline)
        x += o.measureText(p.text).width
      }
      dots = sampleDots(o.getImageData(0, 0, W, H).data, W, H, stepFor(fontSize), rand)
      const small = fontSize < 48
      r = stepFor(fontSize) * (small ? 0.5 : 0.42)
      rest = small ? 0.82 : 0.6
      if (keepSettled) settleNow(dots)
    }

    function heatFor(d: Dot, t: number): number {
      const band = (weather.band * fontSize) / 100 / W
      let h = 0
      if (sweepStart >= 0) {
        const p = (t - sweepStart) / weather.sweepMs
        if (p <= 1) h = heatAt(d.x / W, sweepPosition(weather.direction, p), band, weather.direction)
      }
      if (pointer) h = Math.max(h, heatAt(d.x / W, pointer.x / W, band * 0.8, 'ltr'))
      if (restAt !== null) h = Math.max(h, heatAt(d.x / W, restAt, band, 'ltr'))
      if (t < flareUntil) h = Math.max(h, Math.sin(((flareUntil - t) / 900) * Math.PI) * 0.85)
      return h
    }

    function draw(t: number, still = false) {
      ctx!.clearRect(0, 0, W, H)
      for (const d of dots) {
        const spark = t < d.liftUntil
        const h = spark ? 1 : heatFor(d, t)
        const shimmer = still ? 1 : 1 - weather.flicker * (0.5 + 0.5 * Math.sin(t * 0.004 + d.phase))
        const base = d.tone ? ACCENT_REST : CREAM
        ctx!.globalAlpha = Math.min(1, (d.tone ? Math.max(0.85, rest) : rest) * shimmer + 0.45 * h)
        ctx!.fillStyle = rgb(mix(base, weather.warmth, Math.min(1, h * 1.2)))
        ctx!.beginPath()
        ctx!.arc(d.x, d.y, r * (1 + 0.45 * h), 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    function schedule(now: number) {
      const [lo, hi] = weather.gapMs
      nextSweep = now + lo + rand() * (hi - lo)
    }

    function frame(now: number) {
      if (cancelled) return
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const t = now - t0
      const speed = stepDots(dots, dt, t, pointer, fontSize * 0.5, fontSize * 0.16)

      if (!arrived && t > 1300) {
        arrived = true
        nextSweep = t + weather.firstSweepMs
      }
      if (arrived && sweepStart < 0 && t >= nextSweep) {
        sweepStart = t
        sweeps += 1
        if (sweeps === 1 && weather.flare) flareUntil = t + 900
        throwSparks(dots, weather.sparks, t + 900, fontSize * 0.28, rand)
      }
      if (sweepStart >= 0 && t - sweepStart > weather.sweepMs) {
        sweepStart = -1
        schedule(t)
      }

      // Full rate while anything moves; about 20 fps for the idle shimmer.
      const busy = !arrived || sweepStart >= 0 || pointer || t < flareUntil || speed > 2
      frameCount += 1
      if (busy || frameCount % 3 === 0) draw(t)
      raf = requestAnimationFrame(frame)
    }

    function start() {
      if (running || reduced || !visible || document.hidden || cancelled) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }

    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect()
      pointer = { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    const onLeave = () => {
      pointer = null
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    let lastWidth = 0
    const resize = new ResizeObserver(() => {
      const w = textEl.offsetWidth
      if (Math.abs(w - lastWidth) < 4) return
      lastWidth = w
      sample(arrived || reduced)
      if (reduced) draw(0, true)
    })
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })

    const ready = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve()
    ready.then(() => {
      if (cancelled) return
      lastWidth = textEl.offsetWidth
      sample(false)
      wrap.classList.add('ember-lit')
      if (reduced) {
        // One still frame, lit by a band resting a third of the way in.
        settleNow(dots)
        restAt = 0.33
        draw(0, true)
        resize.observe(textEl)
        return
      }
      t0 = performance.now()
      resize.observe(textEl)
      seen.observe(wrap)
      wrap.addEventListener('pointermove', onMove)
      wrap.addEventListener('pointerleave', onLeave)
      document.addEventListener('visibilitychange', onVisibility)
      start()
    })

    return () => {
      cancelled = true
      stop()
      resize.disconnect()
      seen.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      wrap.classList.remove('ember-lit')
    }
    // `label` covers changes to the words; parts' accent flags change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, seed])

  return (
    <div ref={wrapRef} className={`ember relative inline-block max-w-full ${className}`}>
      <Tag ref={textRef} id={id} className="ember-text whitespace-nowrap" style={style}>
        {parts.map((p, i) =>
          p.accent ? (
            <span key={i} className={accentClassName}>
              {p.text}
            </span>
          ) : (
            // Bare text, not a span: a trailing space inside its own span is
            // dropped from the accessible name ("The ZeroTheater").
            <Fragment key={i}>{p.text}</Fragment>
          ),
        )}
      </Tag>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute" />
    </div>
  )
}
