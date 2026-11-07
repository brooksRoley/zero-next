// @ts-check
import React, { useEffect, useRef } from 'react'
import { prefersReducedMotion } from 'src/lib/motion'

/**
 * The quiet backdrop behind the Pente board: the home page's terrain, slowed
 * down to sit behind a game.
 *
 * Three things, all on one canvas, in the home hero's palette:
 *  - two large soft lights (mist and brass) that drift on 60–120 second orbits;
 *  - a few raked contour rings around the board, like sand around a stone,
 *    breathing by a few pixels;
 *  - two low terrain bands at the foot of the page (the hero's sine-sum
 *    landscape, at a fraction of its alpha and speed).
 * A placed stone sends one faint ring out from where it landed (the hero's
 * pointer pulse, in mist and brass).
 *
 * Budget: idles at 20 fps (the motion is too slow to need more), runs at
 * display rate only while a ripple is spreading, and stops when the tab is
 * hidden. With prefers-reduced-motion it paints one still frame and only
 * repaints on resize; placed stones send no ripple.
 */
const PALETTE = {
  mist: '#E9E3D6',
  sand: '#DED9CE',
  stone: '#B1ADA8',
  brass: '#966F2F',
  slate: '#2F3C50',
}

const IDLE_FRAME_MS = 50

export default function StillField({ boardRef, rippleCell }) {
  const canvasRef = useRef(null)
  const apiRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 1
    let height = 1
    let frame = 0
    let lastDraw = 0
    let reduced = prefersReducedMotion()
    const pulses = []

    const boardShape = () => {
      const board = boardRef?.current?.getBoundingClientRect()
      const box = canvas.getBoundingClientRect()
      if (!board || !board.width) return { x: width / 2, y: height * 0.55, r: Math.min(width, height) * 0.34 }
      return {
        x: board.left - box.left + board.width / 2,
        y: board.top - box.top + board.height / 2,
        r: Math.max(board.width, board.height) / 2,
      }
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, width, height)
      const span = Math.max(width, height)

      softLight(ctx, width * (0.18 + 0.05 * Math.sin(t * 0.00006)), height * (0.16 + 0.04 * Math.cos(t * 0.00005)), span * 0.5, PALETTE.mist, 0.07)
      softLight(ctx, width * (0.84 + 0.04 * Math.cos(t * 0.00005)), height * (0.28 + 0.05 * Math.sin(t * 0.00007)), span * 0.4, PALETTE.brass, 0.1)

      const { x, y, r } = boardShape()
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const breath = Math.sin(t * 0.00035 + i * 0.9) * 3
        ctx.strokeStyle = withAlpha(PALETTE.sand, 0.07 - i * 0.014)
        ctx.beginPath()
        ctx.ellipse(x, y, r * (1.16 + i * 0.2) + breath, r * (1.08 + i * 0.17) + breath, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      terrain(ctx, width, height, t, { fill: withAlpha(PALETTE.slate, 0.42), stroke: withAlpha(PALETTE.sand, 0.07), baseY: 0.86, amplitude: 14, freq: 0.006, speed: 0.00007 })
      terrain(ctx, width, height, t, { fill: withAlpha(PALETTE.brass, 0.1), stroke: withAlpha(PALETTE.sand, 0.06), baseY: 0.94, amplitude: 9, freq: 0.009, speed: 0.0001 })

      for (const pulse of pulses) {
        ctx.lineWidth = 1
        ctx.strokeStyle = withAlpha(PALETTE.mist, pulse.alpha)
        ctx.beginPath()
        ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = withAlpha(PALETTE.brass, pulse.alpha * 0.6)
        ctx.beginPath()
        ctx.arc(pulse.x, pulse.y, Math.max(0, pulse.radius - 8), 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const loop = (now) => {
      frame = 0
      if (document.hidden || reduced) return
      if (pulses.length || now - lastDraw >= IDLE_FRAME_MS) {
        for (let i = pulses.length - 1; i >= 0; i--) {
          pulses[i].radius += 2.6
          pulses[i].alpha *= 0.965
          if (pulses[i].alpha < 0.008) pulses.splice(i, 1)
        }
        draw(now)
        lastDraw = now
      }
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      if (!frame && !reduced && !document.hidden) frame = requestAnimationFrame(loop)
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, canvas.clientWidth)
      height = Math.max(1, canvas.clientHeight)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(reduced ? 0 : performance.now())
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
      } else {
        start()
      }
    }

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onMotionChange = (event) => {
      reduced = event.matches
      if (reduced) {
        cancelAnimationFrame(frame)
        frame = 0
        pulses.length = 0
        draw(0)
      } else {
        start()
      }
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (boardRef?.current) ro.observe(boardRef.current)
    resize()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    mql?.addEventListener?.('change', onMotionChange)

    apiRef.current = {
      ripple(clientX, clientY) {
        if (reduced) return
        const box = canvas.getBoundingClientRect()
        pulses.push({ x: clientX - box.left, y: clientY - box.top, radius: 10, alpha: 0.22 })
        if (pulses.length > 6) pulses.shift()
        start()
      },
    }

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      mql?.removeEventListener?.('change', onMotionChange)
      apiRef.current = null
    }
  }, [boardRef])

  // A placed stone answers with one ring from the point where it landed.
  useEffect(() => {
    if (!rippleCell || !boardRef?.current) return
    const [row, col] = rippleCell.split('-')
    const cell = boardRef.current.querySelector(`[data-row="${row}"][data-col="${col}"]`)
    if (!cell) return
    const rect = cell.getBoundingClientRect()
    apiRef.current?.ripple(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }, [rippleCell, boardRef])

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
}

function softLight(ctx, x, y, radius, hex, alpha) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
  glow.addColorStop(0, withAlpha(hex, alpha))
  glow.addColorStop(1, withAlpha(hex, 0))
  ctx.fillStyle = glow
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

// The home hero's landscape layer (PhysicsHero drawLandscapeLayer), without the
// pointer terms: two summed sines, filled below and traced along the top.
function terrain(ctx, width, height, t, { fill, stroke, baseY, amplitude, freq, speed }) {
  const yBase = height * baseY
  const at = (x) => yBase + Math.sin(x * freq + t * speed) * amplitude + Math.cos(x * freq * 0.55 + t * speed * 1.7) * amplitude * 0.4
  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let x = 0; x <= width + 24; x += 24) ctx.lineTo(x, at(x))
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.beginPath()
  for (let x = 0; x <= width + 24; x += 24) {
    if (x === 0) ctx.moveTo(x, at(x))
    else ctx.lineTo(x, at(x))
  }
  ctx.strokeStyle = stroke
  ctx.stroke()
}

function withAlpha(hex, alpha) {
  const v = hex.replace('#', '')
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`
}
