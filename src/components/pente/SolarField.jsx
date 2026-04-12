import React, { useEffect, useRef } from 'react'

/**
 * Ambient background layer behind the Pente surfaces. A slow-orbiting radial
 * gradient (deep violet → orange-amber) plus a pair of counter-rotating
 * highlight rings. All motion happens on canvas via RAF — zero React renders,
 * zero layout thrash, zero reflow inside the board.
 *
 * The loop is paused when the page is hidden (battery) and when prefers-
 * reduced-motion is set (accessibility). In the reduced-motion case the field
 * still paints once so the color wash is visible — only the orbit stops.
 */
export default function SolarField({
  className = '',
  intensity = 1,      // 0..1 — scales alpha; 1 is full strength
  accentHex,          // optional zone accent that shifts the core hue
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = mql.matches

    const draw = (t) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      const elapsed = (t - startRef.current) / 1000
      // 18s orbit — slow enough to stay subliminal, fast enough to notice on dwell
      const angle = (elapsed / 18) * Math.PI * 2
      const cx = w / 2 + Math.cos(angle) * (w * 0.18)
      const cy = h / 2 + Math.sin(angle) * (h * 0.22)

      // Core radial wash: violet inner → amber mid → near-black outer.
      const r = Math.max(w, h) * 0.85
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      const coreHex = accentHex || '#ff7a29'
      core.addColorStop(0, hexWithAlpha(coreHex, 0.28 * intensity))
      core.addColorStop(0.25, hexWithAlpha('#6b21a8', 0.22 * intensity))
      core.addColorStop(0.6, hexWithAlpha('#1e1b4b', 0.18 * intensity))
      core.addColorStop(1, 'rgba(5,8,15,0)')
      ctx.fillStyle = core
      ctx.fillRect(0, 0, w, h)

      // Counter-rotating amber ring — highlights the "gravitational" feel.
      const ringAlpha = (0.08 + 0.04 * Math.sin(elapsed * 0.7)) * intensity
      ctx.strokeStyle = hexWithAlpha('#fbbf24', ringAlpha)
      ctx.lineWidth = 1
      ctx.beginPath()
      const ringR = Math.min(w, h) * 0.42
      const rx = w / 2 - Math.cos(angle * 0.6) * (w * 0.05)
      const ry = h / 2 - Math.sin(angle * 0.6) * (h * 0.05)
      ctx.ellipse(rx, ry, ringR, ringR * 0.86, angle * 0.4, 0, Math.PI * 2)
      ctx.stroke()

      // Inner candy ring — tighter, faster pulse.
      const innerAlpha = (0.10 + 0.05 * Math.sin(elapsed * 1.1 + 1.3)) * intensity
      ctx.strokeStyle = hexWithAlpha('#ff69b4', innerAlpha)
      ctx.beginPath()
      const innerR = Math.min(w, h) * 0.24
      ctx.ellipse(w / 2, h / 2, innerR, innerR * 1.04, -angle * 0.8, 0, Math.PI * 2)
      ctx.stroke()

      if (!reduceMotion) rafRef.current = requestAnimationFrame(draw)
    }

    const start = () => {
      startRef.current = performance.now()
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }
    const stop = () => cancelAnimationFrame(rafRef.current)

    // Always paint once so the wash is visible.
    draw(performance.now())
    if (!reduceMotion) start()

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (!reduceMotion) start()
    }
    const onMotionChange = (e) => {
      reduceMotion = e.matches
      if (reduceMotion) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    mql.addEventListener?.('change', onMotionChange)

    return () => {
      stop()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      mql.removeEventListener?.('change', onMotionChange)
    }
  }, [intensity, accentHex])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
    />
  )
}

function hexWithAlpha(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
