import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from 'src/lib/motion'
import { fitCanvas } from 'src/lib/ui/canvas'
import { startFrameClock } from 'src/lib/ui/frameClock'
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
    let stop = () => {}
    let w = 0
    let h = 0
    const begin = performance.now()

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      fitCanvas(canvas, ctx, w, h, 1.5)
      drawSky(ctx, w, h, still ? 0 : (performance.now() - begin) / 1000)
    }

    resize()
    window.addEventListener('resize', resize)
    // 30 fps is plenty for a backdrop; the browser pauses it in a hidden tab.
    if (!still) stop = startFrameClock((_dt, now) => drawSky(ctx, w, h, (now - begin) / 1000), { minFrameMs: 33 })
    return () => {
      stop()
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
