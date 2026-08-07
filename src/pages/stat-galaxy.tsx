import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import SupportCta from 'src/components/SupportCta'

// ── Team color palette (keyed by NBA team_id) ──────────────────────────
const TEAM_COLORS: Record<number, string> = {
  1610612737: '#E03A3E', // ATL
  1610612738: '#007A33', // BOS
  1610612751: '#000000', // BKN
  1610612766: '#1D1160', // CHA
  1610612741: '#CE1141', // CHI
  1610612739: '#860038', // CLE
  1610612742: '#00538C', // DAL
  1610612743: '#0E2240', // DEN
  1610612765: '#C8102E', // DET
  1610612744: '#1D428A', // GSW
  1610612745: '#CE1141', // HOU
  1610612754: '#FDBB30', // IND
  1610612746: '#C8102E', // LAC
  1610612747: '#552583', // LAL
  1610612763: '#5D76A9', // MEM
  1610612748: '#98002E', // MIA
  1610612749: '#00471B', // MIL
  1610612750: '#0C2340', // MIN
  1610612740: '#0C2340', // NOP
  1610612752: '#F58426', // NYK
  1610612760: '#007AC1', // OKC
  1610612753: '#0077C0', // ORL
  1610612755: '#006BB6', // PHI
  1610612756: '#1D1160', // PHX
  1610612757: '#E03A3E', // POR
  1610612758: '#5A2D81', // SAC
  1610612759: '#C4CED4', // SAS
  1610612761: '#CE1141', // TOR
  1610612762: '#002B5C', // UTA
  1610612764: '#002B5C', // WAS
}

// API payload shape from /api/nba/players (see src/pages/api/nba/players/index.ts)
type ApiPlayer = {
  id: number
  name: string
  team_id: number
  pos: string
  ppg: number
  rpg: number
  apg: number
}

type PhysicsPlayer = {
  name: string
  color: string
  ppg: number
  mpg: number
  stats: { playmaking: number; shooting: number; defense: number }
}

// Take top-N players by PPG and derive physics-ready node format.
// The API returns ppg/rpg/apg only — derive 0–100 stat axes from those.
function toPhysicsNodes(rows: ApiPlayer[], limit = 20): PhysicsPlayer[] {
  const sorted = [...rows].sort((a, b) => b.ppg - a.ppg).slice(0, limit)
  return sorted.map((r) => {
    const parts = r.name.trim().split(/\s+/)
    const short = parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : r.name
    return {
      name: short,
      color: TEAM_COLORS[r.team_id] ?? '#415557',
      ppg: r.ppg,
      mpg: 32, // API doesn't expose minutes; constant keeps masses comparable
      stats: {
        playmaking: Math.min(100, Math.round(r.apg * 10)),
        shooting: Math.min(100, Math.round(r.ppg * 3)),
        defense: Math.min(100, Math.round(r.rpg * 7)),
      },
    }
  })
}

const STAT_WELLS = [
  { id: 'playmaking', label: 'Playmaking', x: 200, y: 200, color: '#f59e0b' },
  { id: 'shooting', label: 'Shooting', x: 600, y: 200, color: '#3b82f6' },
  { id: 'defense', label: 'Defense', x: 400, y: 500, color: '#22c55e' },
]

export default function StatGalaxy() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const renderRef = useRef<Matter.Render | null>(null)

  const [players, setPlayers] = useState<PhysicsPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/nba/players')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ data: ApiPlayer[] }>
      })
      .then((json) => {
        if (cancelled) return
        setPlayers(toPhysicsNodes(json.data))
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load players')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return
    if (players.length === 0) return

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
    const playerBodies = players.map(p => {
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
  }, [players])

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
        <div className="flex flex-col items-end gap-1 text-xs font-mono text-[#8b8fa3]">
          <span className="hidden sm:inline">Drag the Stat Wells to see players cluster by gravity.</span>
          <SupportCta
            page="/stat-galaxy"
            location="stat_galaxy_tip"
            label="Support development →"
            className="text-[#f97316] hover:text-[#fb923c] transition-colors"
          />
        </div>
      </header>

      <div className="flex-1 relative">
        <div ref={sceneRef} className="absolute inset-0 overflow-hidden" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c10]/80 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-[#f97316] border-t-transparent animate-spin" />
              <p className="text-xs font-mono text-[#8b8fa3] tracking-widest uppercase">
                Loading live NBA player data…
              </p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c10]/80 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-sm text-red-400 font-mono mb-1">Couldn&apos;t load players</p>
              <p className="text-xs text-[#8b8fa3] font-mono">{error}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
