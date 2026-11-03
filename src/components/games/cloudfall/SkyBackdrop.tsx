import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from 'src/lib/motion'
import { drawSky } from './paint'

/**
 * The sky behind Cloudfall: a gradient, drifting clouds, and three layers of
 * rounded hills moving at different speeds. Drawn at 30fps, paused when the tab
 * is hidden, and drawn once (still) when the visitor asks for less motion.
 */
export default function SkyBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = prefersReducedMotion()
    let raf = 0
    let last = 0
    let w = 0
    let h = 0
    const begin = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSky(ctx, w, h, still ? 0 : (performance.now() - begin) / 1000)
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden || now - last < 33) return
      last = now
      drawSky(ctx, w, h, (now - begin) / 1000)
    }

    resize()
    window.addEventListener('resize', resize)
    if (!still) raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ background: 'linear-gradient(#4cc3f5, #a9e9ff 55%, #fff3cf)' }}
    />
  )
}
