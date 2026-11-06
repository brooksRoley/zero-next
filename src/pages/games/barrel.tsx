import Head from 'next/head'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { createGameTracker, trackGame } from 'src/lib/analytics'
import { KEY, loadBarrel, type BarrelModule, type BarrelSnapshot } from 'src/lib/barrel/module'
import { readBest, waveEndMetadata, waveTrackerState, writeBest } from 'src/lib/barrel/session'
import { SPOTS, clampConditions, type ConditionsResponse, type GameConditions, type SpotId } from 'src/lib/barrel/surf'
import { absoluteUrl } from 'src/lib/routes'

const SLUG = 'barrel'
const CANVAS_ID = 'barrel-canvas'
const POLL_MS = 120

type Status = 'loading' | 'running' | 'no-webgl' | 'failed'
type Source = 'live' | 'typical' | 'custom'

type Pad = { label: string; hint: string; key: number }
const PADS: Pad[] = [
  { label: '◀', hint: 'Lean / paddle left', key: KEY.left },
  { label: '▶', hint: 'Lean / paddle right', key: KEY.right },
  { label: 'S', hint: 'Pump · hands down', key: KEY.down },
  { label: 'W', hint: 'Carve up · stand', key: KEY.up },
  { label: '␣', hint: 'Crouch · next wave', key: KEY.space },
]

const fmtWind = (w: number) => `${Math.abs(w).toFixed(1)} m/s ${w >= 0 ? 'offshore' : 'onshore'}`

export default function BarrelPage() {
  const moduleRef = useRef<BarrelModule | null>(null)
  const touchRef = useRef(0)
  const trackerRef = useRef(createGameTracker(SLUG, (event, game, metadata) => trackGame(event, game, metadata)))
  const [status, setStatus] = useState<Status>('loading')
  const [spot, setSpot] = useState<SpotId>('pipeline')
  const [source, setSource] = useState<Source>('typical')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [conditions, setConditions] = useState<GameConditions>(SPOTS[0].typical)
  const [best, setBest] = useState(0)
  const [snap, setSnap] = useState<BarrelSnapshot | null>(null)
  // The poll and the fetch read the latest spot and source without re-subscribing.
  const sourceRef = useRef<Source>(source)
  const spotRef = useRef<SpotId>(spot)
  useEffect(() => {
    sourceRef.current = source
    spotRef.current = spot
  }, [source, spot])

  // Push conditions into the game through the function the module put on window.
  const apply = useCallback((c: GameConditions) => {
    const clean = clampConditions(c)
    setConditions(clean)
    const set = window.SetGlobalSurfConditions ?? moduleRef.current?.SetGlobalSurfConditions
    set?.(clean.height, clean.period, clean.wind, clean.breakType)
  }, [])

  // Load the module and start the loop in the canvas.
  useEffect(() => {
    let cancelled = false
    const saved = readBest()
    setBest(saved)
    loadBarrel()
      .then((m) => {
        if (cancelled) return
        moduleRef.current = m
        if (!m.start(`#${CANVAS_ID}`, saved)) {
          setStatus('no-webgl')
          return
        }
        setStatus('running')
        document.getElementById(CANVAS_ID)?.focus({ preventScroll: true })
      })
      .catch((err) => {
        console.error('[barrel]', err)
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      moduleRef.current?.stop()
      moduleRef.current = null
    }
  }, [])

  // Live conditions for the chosen spot (unless the sliders have taken over).
  useEffect(() => {
    if (status !== 'running') return
    const chosen = SPOTS.find((s) => s.id === spot) ?? SPOTS[0]
    apply(chosen.typical)
    setSource('typical')
    setFetchedAt(null)
    const controller = new AbortController()
    fetch(`/api/surf/conditions?spot=${chosen.id}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ConditionsResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        if (sourceRef.current === 'custom' || body.spot !== spotRef.current) return
        apply(body.conditions)
        setSource(body.source)
        setFetchedAt(body.source === 'live' ? body.fetchedAt : null)
      })
      .catch(() => {
        /* the typical day already applied is the fallback */
      })
    return () => controller.abort()
  }, [spot, status, apply])

  // Read the game for the panel and the shared events.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      const m = moduleRef.current
      if (!m) return
      const s = m.getSnapshot()
      setSnap(s)
      trackerRef.current.update(waveTrackerState(s), {
        start: () => ({ spot: spotRef.current, source: sourceRef.current }),
        end: () => waveEndMetadata(s, spotRef.current, sourceRef.current),
      })
      const b = Math.floor(m.getBest())
      if (b > readBest()) writeBest(b)
      setBest((prev) => (b > prev ? b : prev))
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [status])

  const setTouch = (key: number, down: boolean) => {
    touchRef.current = down ? touchRef.current | key : touchRef.current & ~key
    moduleRef.current?.setTouchKeys(touchRef.current)
  }
  const padDown = (key: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setTouch(key, true)
    try {
      // Keep the press while the finger slides off the button.
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not every pointer can be captured; the press still counts */
    }
  }
  const padUp = (key: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setTouch(key, false)
  }

  const slide = (field: 'height' | 'period' | 'wind') => (e: ChangeEvent<HTMLInputElement>) => {
    sourceRef.current = 'custom'
    setSource('custom')
    apply({ ...conditions, [field]: Number(e.target.value) })
  }

  const chosen = SPOTS.find((s) => s.id === spot) ?? SPOTS[0]
  const sourceLine =
    source === 'live'
      ? `Live from Open-Meteo${fetchedAt ? `, ${new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
      : source === 'custom'
        ? 'Your conditions'
        : 'A typical good day (no live reading yet)'

  return (
    <>
      <Head>
        <title>BARREL | Brooks Roley</title>
        <meta
          name="description"
          content="BARREL: a 2D surfing game in C++ and WebAssembly. Box2D physics, a Gerstner wave whose lip folds into a real tube, and live surf conditions."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="BARREL — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="Paddle in, pop up on the crest, and ride the tube. C++20, Box2D and WebGL2 compiled to WebAssembly."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('barrel')} key="og:url" />
      </Head>
      <main className="min-h-screen bg-ink-950 text-ink-100">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-ink-50 sm:text-4xl">BARREL</h1>
              <p className="mt-1 hidden max-w-2xl text-sm text-ink-300 sm:block">
                Paddle into the wave, pop up as it lifts you, then pump and carve to stay in the tube until you
                can kick out over the back.
              </p>
            </div>
            <p className="font-mono text-sm text-brass-300">Best {best.toLocaleString('en-US')}</p>
          </header>

          <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-[#0d2138]">
            <canvas
              id={CANVAS_ID}
              tabIndex={0}
              aria-label="BARREL game. A and D paddle or lean, S then W to pop up, W carves up, S pumps, Space crouches."
              className="block aspect-[3/4] max-h-[66vh] w-full touch-none outline-none sm:aspect-video"
            />
            {status !== 'running' && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-ink-200">
                {status === 'loading' && <p className="font-mono text-sm">Waxing the board…</p>}
                {status === 'no-webgl' && (
                  <p className="max-w-sm text-sm">
                    BARREL draws with WebGL2, which this browser has turned off or does not support.
                  </p>
                )}
                {status === 'failed' && <p className="max-w-sm text-sm">The game could not load. Try reloading the page.</p>}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2 sm:hidden" aria-label="Touch controls">
            {PADS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-label={p.hint}
                onPointerDown={padDown(p.key)}
                onPointerUp={padUp(p.key)}
                onPointerCancel={padUp(p.key)}
                onContextMenu={(e) => e.preventDefault()}
                className="select-none rounded-md border border-ink-600 bg-ink-800 py-4 font-mono text-lg text-ink-100 active:bg-ink-600"
              >
                {p.label}
              </button>
            ))}
          </div>

          <section className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-400">The break</h2>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Surf spot">
                {SPOTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={spot === s.id}
                    onClick={() => {
                      sourceRef.current = 'typical'
                      spotRef.current = s.id
                      setSource('typical')
                      setSpot(s.id)
                    }}
                    className={`rounded-md border px-3 py-2 font-mono text-sm ${
                      spot === s.id
                        ? 'border-brass-400 bg-brass-400/10 text-brass-200'
                        : 'border-ink-600 text-ink-200 hover:border-ink-400'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-300">{chosen.blurb}</p>
              <p className="mt-2 font-mono text-xs text-ink-400" aria-live="polite">
                {sourceLine}: {conditions.height.toFixed(1)} m face, {conditions.period.toFixed(0)} s,{' '}
                {fmtWind(conditions.wind)}
              </p>
            </div>
            <div className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">Or set your own</h2>
              <label className="block text-sm text-ink-200">
                Face height {conditions.height.toFixed(1)} m
                <input type="range" min={1} max={6} step={0.1} value={conditions.height} onChange={slide('height')} className="mt-1 w-full accent-brass-400" />
              </label>
              <label className="block text-sm text-ink-200">
                Period {conditions.period.toFixed(0)} s
                <input type="range" min={5} max={22} step={1} value={conditions.period} onChange={slide('period')} className="mt-1 w-full accent-brass-400" />
              </label>
              <label className="block text-sm text-ink-200">
                Wind {fmtWind(conditions.wind)}
                <input type="range" min={-15} max={15} step={0.5} value={conditions.wind} onChange={slide('wind')} className="mt-1 w-full accent-brass-400" />
              </label>
            </div>
          </section>

          <section className="mt-8 grid gap-6 text-sm text-ink-300 md:grid-cols-3">
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-400">How to surf it</h2>
              <ol className="list-decimal space-y-1 pl-5">
                <li>A / D paddle. Wait for the swell.</li>
                <li>When it lifts you, press S, then W.</li>
                <li>S pumps down the face, W carves back up, Space crouches under the lip.</li>
                <li>Climb over the back with W to kick out and bank the score.</li>
              </ol>
            </div>
            <div className="md:col-span-2">
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-400">Under the hood</h2>
              <p>
                The game loop, the physics and the drawing run in a C++20 module compiled to WebAssembly. The
                wave is a Gerstner profile whose lip folds forward on an exponential curve, rebuilt into a Box2D
                chain every 1/60 s from fixed pools, so it allocates nothing once warm. The board planes on
                quadratic lift, and its drag spikes when the rail bites into a carve. The conditions panel calls{' '}
                <code className="font-mono text-ink-200">window.SetGlobalSurfConditions</code>, a C++ function
                exposed through Emscripten bindings.
              </p>
              {snap && (
                <p className="mt-2 font-mono text-xs text-ink-500">
                  {snap.chainCount} chain vertices · wave {snap.waveSpeed.toFixed(1)} m/s · rides {snap.rides}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
