import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from 'src/lib/motion'
import { fitCanvas } from 'src/lib/ui/canvas'
import { startFrameClock } from 'src/lib/ui/frameClock'

// The home page's backdrop: a few faint ridgelines, the site's terrain motif,
// drifting slowly enough that you notice them only when you stop reading.
// Canvas, decorative (aria-hidden), ~30fps, and a single still frame for
// visitors who ask for reduced motion.

type Props = { dark: boolean }

const LINES = 14
const FRAME_MS = 1000 / 30

// Each ridge is a sum of three slow sine waves with its own phase, so no two
// lines move in step and the field never visibly repeats.
function ridgeY(i: number, x: number, t: number, h: number): number {
  const base = h * (0.18 + (0.72 * i) / (LINES - 1))
  const a = h * 0.018
  return (
    base +
    a * Math.sin(x * 0.0021 + i * 1.7 + t * 0.00011) +
    a * 0.6 * Math.sin(x * 0.0047 + i * 0.9 - t * 0.00007) +
    a * 0.35 * Math.sin(x * 0.0093 + i * 2.3 + t * 0.00017)
  )
}

export default function QuietField({ dark }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const still = prefersReducedMotion()
    const stroke = dark ? 'rgba(222, 217, 206, 0.09)' : 'rgba(16, 27, 43, 0.075)'
    const accent = dark ? 'rgba(205, 163, 95, 0.16)' : 'rgba(161, 116, 47, 0.14)'
    let w = 0
    let h = 0
    let stop = () => {}

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      fitCanvas(canvas, ctx, w, h)
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1
      for (let i = 0; i < LINES; i++) {
        // One brass line a little below the middle, the rest in ink.
        ctx.strokeStyle = i === 9 ? accent : stroke
        ctx.beginPath()
        for (let x = -8; x <= w + 8; x += 8) {
          const y = ridgeY(i, x, t, h)
          if (x === -8) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    resize()
    const onResize = () => {
      resize()
      draw(still ? 0 : performance.now())
    }
    window.addEventListener('resize', onResize)
    if (still) draw(0)
    else stop = startFrameClock((_dt, now) => draw(now), { minFrameMs: FRAME_MS })

    return () => {
      stop()
      window.removeEventListener('resize', onResize)
    }
  }, [dark])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" />
}
