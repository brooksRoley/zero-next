import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

// ── Mock Data ────────────────────────────────────────────────────────────
// Normalized 0-100 scores for simplicity in the physics force calculations
const MOCK_PLAYERS = [
  { name: 'N. Jokic', team: 'DEN', color: '#0E2240', ppg: 26.4, mpg: 34.6, stats: { playmaking: 95, shooting: 85, defense: 60 } },
  { name: 'L. James', team: 'LAL', color: '#552583', ppg: 25.7, mpg: 35.3, stats: { playmaking: 85, shooting: 80, defense: 65 } },
  { name: 'S. Curry', team: 'GSW', color: '#1D428A', ppg: 26.4, mpg: 32.7, stats: { playmaking: 60, shooting: 99, defense: 45 } },
  { name: 'R. Gobert', team: 'MIN', color: '#0C2340', ppg: 14.0, mpg: 34.1, stats: { playmaking: 20, shooting: 20, defense: 95 } },
  { name: 'G. Antetokounmpo', team: 'MIL', color: '#00471B', ppg: 30.4, mpg: 35.2, stats: { playmaking: 70, shooting: 40, defense: 85 } },
  { name: 'L. Doncic', team: 'DAL', color: '#00538C', ppg: 33.9, mpg: 37.5, stats: { playmaking: 98, shooting: 88, defense: 40 } },
  { name: 'S. Gilgeous-Alexander', team: 'OKC', color: '#007AC1', ppg: 30.1, mpg: 34.0, stats: { playmaking: 75, shooting: 85, defense: 75 } },
  { name: 'J. Tatum', team: 'BOS', color: '#007A33', ppg: 26.9, mpg: 35.7, stats: { playmaking: 60, shooting: 85, defense: 80 } },
  { name: 'V. Wembanyama', team: 'SAS', color: '#C4CED4', ppg: 21.4, mpg: 29.7, stats: { playmaking: 45, shooting: 60, defense: 99 } },
  { name: 'T. Haliburton', team: 'IND', color: '#FDBB30', ppg: 20.1, mpg: 32.2, stats: { playmaking: 95, shooting: 85, defense: 30 } },
  { name: 'J. Brunson', team: 'NYK', color: '#F58426', ppg: 28.7, mpg: 35.4, stats: { playmaking: 80, shooting: 85, defense: 35 } },
  { name: 'A. Davis', team: 'LAL', color: '#552583', ppg: 24.7, mpg: 35.5, stats: { playmaking: 40, shooting: 50, defense: 95 } },
  { name: 'D. Sabonis', team: 'SAC', color: '#5A2D81', ppg: 19.4, mpg: 35.7, stats: { playmaking: 85, shooting: 40, defense: 60 } },
  { name: 'A. Edwards', team: 'MIN', color: '#0C2340', ppg: 25.9, mpg: 35.1, stats: { playmaking: 65, shooting: 80, defense: 75 } },
  { name: 'K. Durant', team: 'PHX', color: '#1D1160', ppg: 27.1, mpg: 37.2, stats: { playmaking: 65, shooting: 95, defense: 65 } },
]

const STAT_WELLS = [
  { id: 'playmaking', label: 'Playmaking', x: 200, y: 200, color: '#f59e0b' },
  { id: 'shooting', label: 'Shooting', x: 600, y: 200, color: '#3b82f6' },
  { id: 'defense', label: 'Defense', x: 400, y: 500, color: '#22c55e' },
]

export default function StatGalaxy() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const renderRef = useRef<Matter.Render | null>(null)

  const [activeWell, setActiveWell] = useState<string | null>(null)

  useEffect(() => {
    if (!sceneRef.current) return

    // 1. Setup Engine & World
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 } // Zero global gravity
    })
    const world = engine.world
    engineRef.current = engine

    const width = sceneRef.current.clientWidth
    const height = sceneRef.current.clientHeight

    // 2. Setup Renderer
    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: '#0a0c10',
        pixelRatio: window.devicePixelRatio
      }
    })
    renderRef.current = render

    // 3. Create Walls to keep things on screen
    const wallOptions = { isStatic: true, render: { fillStyle: '#252a36' } }
    Matter.World.add(world, [
      Matter.Bodies.rectangle(width / 2, -25, width, 50, wallOptions),
      Matter.Bodies.rectangle(width / 2, height + 25, width, 50, wallOptions),
      Matter.Bodies.rectangle(-25, height / 2, 50, height, wallOptions),
      Matter.Bodies.rectangle(width + 25, height / 2, 50, height, wallOptions)
    ])

    // 4. Create Player Bodies
    const playerBodies = MOCK_PLAYERS.map(p => {
      // Size = PPG
      const radius = p.ppg * 1.5
      // Mass = MPG (Heavier = slower to pull)
      const mass = p.mpg * 0.1

      const body = Matter.Bodies.circle(
        width / 2 + (Math.random() - 0.5) * 400,
        height / 2 + (Math.random() - 0.5) * 400,
        radius,
        {
          restitution: 0.6, // Bounciness
          frictionAir: 0.04, // "Space" drag
          render: {
            fillStyle: p.color,
            strokeStyle: '#ffffff',
            lineWidth: 2
          },
          plugin: {
            playerData: p // Store data for custom gravity
          }
        }
      )
      Matter.Body.setMass(body, mass)
      return body
    })

    // 5. Create Stat Well Bodies (Kinematic / Draggable)
    const wellBodies = STAT_WELLS.map(w => {
      return Matter.Bodies.circle(w.x, w.y, 40, {
        isStatic: true, // We will move them with mouse, but they don't react to physics
        isSensor: true, // Don't collide with players
        render: {
          fillStyle: w.color,
          strokeStyle: '#ffffff',
          lineWidth: 3
        },
        plugin: {
          wellData: w
        }
      })
    })

    Matter.World.add(world, [...playerBodies, ...wellBodies])

    // 6. Mouse Control
    const mouse = Matter.Mouse.create(render.canvas)
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    })
    Matter.World.add(world, mouseConstraint)
    render.mouse = mouse

    // We want to drag stat wells. Since they are static, MouseConstraint won't move them.
    // Let's make them kinematic so they can be dragged.
    wellBodies.forEach(b => Matter.Body.setStatic(b, false))
    wellBodies.forEach(b => {
      b.frictionAir = 0.5; // High friction so they stay where dropped
      // b.isKinematic = true // doesn't work well with MouseConstraint
    })

    // 7. Custom Gravity Logic
    Matter.Events.on(engine, 'beforeUpdate', () => {
      const wells = wellBodies

      playerBodies.forEach(playerBody => {
        const p = playerBody.plugin.playerData

        // Apply a gentle pull to the center to prevent stragglers
        const dxCenter = (width / 2) - playerBody.position.x
        const dyCenter = (height / 2) - playerBody.position.y
        Matter.Body.applyForce(playerBody, playerBody.position, {
          x: dxCenter * 0.00001 * playerBody.mass,
          y: dyCenter * 0.00001 * playerBody.mass
        })

        // Apply pull from each stat well
        wells.forEach(wellBody => {
          const w = wellBody.plugin.wellData
          const statScore = p.stats[w.id as keyof typeof p.stats]
          
          if (!statScore) return

          const dx = wellBody.position.x - playerBody.position.x
          const dy = wellBody.position.y - playerBody.position.y
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)
          
          if (dist === 0) return

          // Normalize direction
          const forceX = dx / dist
          const forceY = dy / dist

          // Gravity formula: G * (m1 * m2) / r^2
          // We'll use a modified formula: Force proportional to Stat Score.
          // Falloff inversely proportional to distance, but capped to avoid infinite force at center.
          const forceMagnitude = (statScore / 100) * 0.00015 * playerBody.mass

          Matter.Body.applyForce(playerBody, playerBody.position, {
            x: forceX * forceMagnitude,
            y: forceY * forceMagnitude
          })
        })
      })

      // Keep wells from drifting (since they are non-static now so mouse can grab them)
      wells.forEach(w => {
        Matter.Body.setVelocity(w, { x: 0, y: 0 })
      })
    })

    // Custom Rendering loop for Labels
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context
      ctx.font = '12px Outfit, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Player names
      playerBodies.forEach(b => {
        ctx.fillStyle = '#ffffff'
        ctx.fillText(b.plugin.playerData.name.split(' ')[1] || b.plugin.playerData.name, b.position.x, b.position.y)
      })

      // Well names
      ctx.font = 'bold 14px Outfit, sans-serif'
      wellBodies.forEach(b => {
        ctx.fillStyle = '#ffffff'
        ctx.fillText(b.plugin.wellData.label, b.position.x, b.position.y)
      })
    })

    // Run
    Matter.Render.run(render)
    const runner = Matter.Runner.create()
    Matter.Runner.run(runner, engine)

    return () => {
      Matter.Render.stop(render)
      Matter.Runner.stop(runner)
      Matter.Engine.clear(engine)
      if (render.canvas) render.canvas.remove()
    }
  }, [])

  return (
    <main className="h-screen bg-[#0a0c10] text-white font-sans flex flex-col">
      <Head>
        <title>Stat Galaxy | NBA Physics Explorer</title>
      </Head>

      <header className="flex items-center justify-between px-6 py-4 border-b border-[#252a36] bg-[#12151c] z-10">
        <div className="flex items-center gap-4">
          <Link href="/nba" className="text-sm text-[#8b8fa3] hover:text-white transition-colors">
            &larr; Back
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Stat Galaxy <span className="text-[#f97316]">Prototype</span></h1>
            <p className="text-xs text-[#8b8fa3] font-mono mt-0.5">Matter.js Physics Data Explorer</p>
          </div>
        </div>
        <div className="text-xs font-mono text-[#8b8fa3]">
          Drag the Stat Wells to see players cluster by gravity.
        </div>
      </header>

      <div className="flex-1 relative">
        <div ref={sceneRef} className="absolute inset-0 overflow-hidden" />
      </div>
    </main>
  )
}
