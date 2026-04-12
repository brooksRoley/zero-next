import React, { useRef, useEffect, useCallback } from 'react'
import { BOARD_SIZE, BLACK, WHITE, RED, BLUE, EMPTY, PLAYER_COLORS } from 'src/lib/pente/constants'

/**
 * Canvas overlay that renders physics-based stone animations
 * for puzzle transitions: scatter on solve, drop-in for new puzzle.
 *
 * Sits absolutely over the board; pointer-events: none so clicks pass through.
 */

const GRAVITY = 1800    // px/s²
const BOUNCE = 0.45     // energy retained per bounce
const FRICTION = 0.97   // horizontal drag
const SCATTER_SPEED = 350
const DROP_SPEED = -600  // initial upward velocity for drop-in

const STONE_COLORS = {
  [BLACK]: ['#1a1a1a', '#3a3a3a', '#000'],
  [WHITE]: ['#f5f5f5', '#d4d4d4', '#bbb'],
  [RED]:   ['#dc2626', '#f87171', '#991b1b'],
  [BLUE]:  ['#2563eb', '#60a5fa', '#1e3a8a'],
}

function drawStone(ctx, x, y, r, color) {
  const colors = STONE_COLORS[color] || STONE_COLORS[BLACK]
  const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r)
  grad.addColorStop(0, colors[1])
  grad.addColorStop(0.5, colors[0])
  grad.addColorStop(1, colors[2])
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  // Specular highlight
  ctx.beginPath()
  ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()
}

export default function PuzzleTransition({ boardRef, phase, board, onComplete, eloZone }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])

  const getMetrics = useCallback(() => {
    if (!boardRef?.current) return null
    const rect = boardRef.current.getBoundingClientRect()
    const cellSize = rect.width / BOARD_SIZE
    return { rect, cellSize, stoneR: cellSize * 0.38 }
  }, [boardRef])

  // Collect stone positions from board
  const getStones = useCallback((boardData) => {
    const m = getMetrics()
    if (!m) return []
    const stones = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (boardData[r][c] !== EMPTY) {
          stones.push({
            row: r, col: c, color: boardData[r][c],
            x: m.cellSize * (c + 0.5),
            y: m.cellSize * (r + 0.5),
          })
        }
      }
    }
    return stones
  }, [getMetrics])

  // Scatter: stones fly off in random directions with gravity
  const startScatter = useCallback(() => {
    const m = getMetrics()
    if (!m) return
    const stones = getStones(board)
    // Zone-based intensity: higher zones = more dramatic
    const zoneIntensity = eloZone ? Math.min(2, 0.8 + (eloZone.min || 0) / 1500) : 1
    const speed = SCATTER_SPEED * zoneIntensity

    particlesRef.current = stones.map(s => ({
      x: s.x, y: s.y, color: s.color,
      vx: (Math.random() - 0.5) * speed * 2,
      vy: -Math.random() * speed * 1.5 - 100,
      r: m.stoneR,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 8,
      alpha: 1,
      grounded: false,
    }))
  }, [board, getMetrics, getStones, eloZone])

  // Drop-in: stones fall from above with bounce
  const startDropIn = useCallback(() => {
    const m = getMetrics()
    if (!m) return
    const stones = getStones(board)

    particlesRef.current = stones.map((s, i) => ({
      x: s.x,
      y: -m.stoneR * 2 - Math.random() * m.rect.height * 0.5, // start above canvas
      targetY: s.y,
      color: s.color,
      vx: 0,
      vy: 0,
      r: m.stoneR,
      rotation: 0,
      rotSpeed: 0,
      alpha: 1,
      delay: i * 20 + Math.random() * 80, // stagger drops
      started: false,
      settled: false,
    }))
  }, [board, getMetrics, getStones])

  // Animation loop
  useEffect(() => {
    if (phase === 'idle') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const m = getMetrics()
    if (!m) return

    // Size canvas to board
    const dpr = window.devicePixelRatio || 1
    canvas.width = m.rect.width * dpr
    canvas.height = m.rect.height * dpr
    canvas.style.width = `${m.rect.width}px`
    canvas.style.height = `${m.rect.height}px`
    ctx.scale(dpr, dpr)

    if (phase === 'scatter') startScatter()
    else if (phase === 'dropIn') startDropIn()

    let elapsed = 0
    let lastTime = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05) // cap at 50ms
      lastTime = now
      elapsed += dt

      ctx.clearRect(0, 0, m.rect.width, m.rect.height)
      const particles = particlesRef.current
      let allDone = true

      if (phase === 'scatter') {
        for (const p of particles) {
          p.vy += GRAVITY * dt
          p.vx *= FRICTION
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.rotation += p.rotSpeed * dt

          // Fade after 0.8s
          if (elapsed > 0.8) {
            p.alpha = Math.max(0, p.alpha - dt * 2)
          }
          if (p.alpha > 0.01) allDone = false

          ctx.save()
          ctx.globalAlpha = p.alpha
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          drawStone(ctx, 0, 0, p.r, p.color)
          ctx.restore()
        }
      } else if (phase === 'dropIn') {
        for (const p of particles) {
          if (!p.started) {
            p.delay -= dt * 1000
            if (p.delay <= 0) {
              p.started = true
              p.vy = 0
            } else {
              allDone = false
              continue
            }
          }

          if (!p.settled) {
            p.vy += GRAVITY * dt
            p.y += p.vy * dt

            // Bounce at target position
            if (p.y >= p.targetY) {
              p.y = p.targetY
              if (Math.abs(p.vy) < 30) {
                p.settled = true
                p.y = p.targetY
              } else {
                p.vy = -Math.abs(p.vy) * BOUNCE
              }
            }
            allDone = false
          }

          drawStone(ctx, p.x, p.y, p.r, p.color)
        }
      }

      if (allDone) {
        ctx.clearRect(0, 0, m.rect.width, m.rect.height)
        onComplete?.()
        return
      }

      // Safety timeout: 3s max animation
      if (elapsed > 3) {
        ctx.clearRect(0, 0, m.rect.width, m.rect.height)
        onComplete?.()
        return
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [phase, getMetrics, startScatter, startDropIn, onComplete])

  if (phase === 'idle') return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
