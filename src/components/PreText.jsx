import { useEffect, useRef, useCallback } from 'react'

/**
 * PreText — canvas-animated text component.
 *
 * Renders text as a field of particles sampled from the glyph shapes.
 * Suitable for game HUD labels, hints, progress fills, and hero text.
 *
 * Props:
 *   text        string   — text to display
 *   mode        string   — 'flow' | 'pulse' | 'fill'
 *   value       number   — 0–1, used by 'fill' mode (e.g. progress %)
 *   color       string   — particle color (hex or rgb)
 *   accentColor string   — secondary color for fill edge glow
 *   float       boolean  — adds gentle floating CSS animation to container
 *   fontSize    string   — CSS font-size override (e.g. '2rem')
 *   fontWeight  string   — CSS font-weight override (default '700')
 *   className   string
 *   style       object
 *   tag         string   — semantic HTML tag for the hidden a11y element ('h1'–'h6', 'p', 'span')
 */
export default function PreText({
  text = '',
  mode = 'flow',
  value = 0,
  color = '#ff69b4',
  accentColor = '#22d3ee',
  float = false,
  fontSize = null,
  fontWeight = '700',
  className = '',
  style = {},
  tag: Tag = 'span',
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)

  // ─── Build particle mask from glyph pixel data ───────────────────────────
  const buildMask = useCallback((text, font, width, height) => {
    if (!text || width < 1 || height < 1) return []
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const ctx = offscreen.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#fff'
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, width / 2, height / 2)
    const { data } = ctx.getImageData(0, 0, width, height)

    // adaptive step: target ~500–800 particles regardless of size
    const area = width * height
    const step = Math.max(2, Math.round(Math.sqrt(area / 600)))
    const points = []

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        if (data[(y * width + x) * 4 + 3] > 100) {
          points.push({ x: x + (Math.random() - 0.5) * step, y: y + (Math.random() - 0.5) * step, tx: x, ty: y })
        }
      }
    }
    return points
  }, [])

  // ─── Init / resize ────────────────────────────────────────────────────────
  const init = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = container.getBoundingClientRect()
    const w = Math.max(Math.ceil(rect.width), 20)
    const h = Math.max(Math.ceil(rect.height), 20)

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Derive font from container's computed style so it matches the hidden element
    const computed = window.getComputedStyle(container)
    const resolvedSize = fontSize || computed.fontSize
    const resolvedFamily = computed.fontFamily
    const font = `${fontWeight} ${resolvedSize} ${resolvedFamily}`

    const mask = buildMask(text, font, w, h)

    // Assign per-particle randomness once — stable across re-renders
    const particles = mask.map((p, i) => ({
      ...p,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      size: 0.7 + Math.random() * 1.1,
      phase: (i / (mask.length || 1)) * Math.PI * 2 + Math.random() * 0.5,
      speed: 0.3 + Math.random() * 0.7,
    }))

    ctx.clearRect(0, 0, w, h)
    stateRef.current = { ctx, w, h, particles, time: 0 }
  }, [text, fontSize, fontWeight, buildMask])

  // ─── Animation loop ───────────────────────────────────────────────────────
  useEffect(() => {
    init()
    const ro = new ResizeObserver(() => init())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [init])

  useEffect(() => {
    let raf

    function animate() {
      const S = stateRef.current
      if (!S) { raf = requestAnimationFrame(animate); return }
      const { ctx, w, h, particles } = S
      S.time++
      const t = S.time * 0.016

      ctx.clearRect(0, 0, w, h)

      if (mode === 'flow') {
        // Particles orbit their glyph position — calm, living text
        for (const p of particles) {
          const angle = t * p.speed + p.phase
          const radius = 1.2 + Math.sin(t * p.speed * 0.5 + p.phase) * 0.9
          p.x = p.tx + Math.cos(angle) * radius
          p.y = p.ty + Math.sin(angle) * radius
          const alpha = 0.35 + 0.3 * Math.abs(Math.sin(t * p.speed * 0.7 + p.phase))
          ctx.globalAlpha = alpha
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }

      } else if (mode === 'pulse') {
        // Particles breathe in unison — good for hints, alerts, "your turn"
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.8)
        const sizePulse = 0.85 + 0.35 * pulse
        for (const p of particles) {
          // gentle drift toward target while pulsing
          p.x += (p.tx - p.x) * 0.06 + Math.sin(t * p.speed + p.phase) * 0.25
          p.y += (p.ty - p.y) * 0.06 + Math.cos(t * p.speed + p.phase) * 0.25
          ctx.globalAlpha = 0.3 + 0.5 * pulse
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * sizePulse, 0, Math.PI * 2)
          ctx.fill()
        }
        // outer glow halo on peak
        if (pulse > 0.7) {
          ctx.globalAlpha = (pulse - 0.7) * 0.15
          ctx.fillStyle = color
          ctx.fillRect(0, 0, w, h)
        }

      } else if (mode === 'fill') {
        // Particles reveal left-to-right based on value — progress bar as text
        const fillX = latestValue.current * w
        const edgeWidth = Math.max(w * 0.06, 8)

        for (const p of particles) {
          if (p.tx > fillX + edgeWidth) continue

          // drift while filled
          p.x += (p.tx - p.x) * 0.05 + Math.sin(t * p.speed + p.phase) * 0.3
          p.y += (p.ty - p.y) * 0.05 + Math.cos(t * p.speed + p.phase) * 0.3

          // fade in at the leading edge
          const edgeDist = fillX - p.tx
          const edgeAlpha = edgeDist < edgeWidth
            ? Math.max(0, edgeDist / edgeWidth)
            : 1

          // particles near the fill edge glow in accent color
          const isEdge = Math.abs(p.tx - fillX) < edgeWidth
          ctx.globalAlpha = edgeAlpha * (isEdge ? 0.9 : 0.5)
          ctx.fillStyle = isEdge ? accentColor : color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (isEdge ? 1.4 : 1), 0, Math.PI * 2)
          ctx.fill()

          // glow dot at edge
          if (isEdge && edgeAlpha > 0.3) {
            ctx.globalAlpha = edgeAlpha * 0.2
            ctx.fillStyle = accentColor
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [mode, color, accentColor])

  // Keep value current without restarting the animation loop
  const latestValue = useRef(value)
  useEffect(() => { latestValue.current = value }, [value])

  const floatStyle = float ? { animation: 'float 3s ease-in-out infinite' } : {}

  return (
    <div
      ref={containerRef}
      className={`relative inline-block leading-none ${className}`}
      style={{ ...floatStyle, ...style }}
    >
      {/* Hidden element — drives layout sizing and provides accessible text */}
      <Tag
        aria-hidden="false"
        className="invisible select-none pointer-events-none whitespace-nowrap"
        style={{ fontWeight, fontSize: fontSize || undefined }}
      >
        {text}
      </Tag>

      {/* Canvas overlays the hidden text exactly */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-label={text}
        role="img"
      />
    </div>
  )
}
