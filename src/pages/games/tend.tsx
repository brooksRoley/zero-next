import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TendBoard from 'src/components/games/TendBoard'
import { PlantIcon } from 'src/components/games/TendPlants'
import TendNav, { SampleBanner } from 'src/components/games/TendNav'
import { trackGame } from 'src/lib/analytics'
import {
  bloomCount,
  checkIn,
  compostSeed,
  grewBetween,
  forecast,
  hasCheckedIn,
  isDormant,
  newGarden,
  placeSeed,
  resolveSeasons,
  unlockNotes,
  type GardenState,
} from 'src/lib/games/tend/engine'
import { almanac, COMPOST_NOTES, SOURCES } from 'src/lib/games/tend/knowledge'
import { PETS } from 'src/lib/games/tend/pets'
import { KIND_FOR_LANE, LANES, orientations, PLANTS, type Cell, type Lane, type PlantKind } from 'src/lib/games/tend/plants'
import { currentPhase, PHASE_LABEL, type Phase } from 'src/lib/games/tend/daylight'
import { browserStorage as storage } from 'src/lib/games/tend/progress'
import { sampleGarden } from 'src/lib/games/tend/sample'
import { tendSounds } from 'src/lib/games/tend/sounds'
import { loadGarden, saveGarden } from 'src/lib/games/tend/storage'
import { dayIndex } from 'src/lib/games/tend/time'
import { TUNING } from 'src/lib/games/tend/tuning'
import { absoluteUrl, route } from 'src/lib/routes'
import { buzz } from 'src/lib/ui/haptics'
import { HAPTIC } from 'src/lib/ui/tactile'

const GAME = 'tend'

/**
 * Outside production, `?day=+3` shifts the game clock so the daily loop and a
 * season can be tried in one sitting. Production always uses the real date.
 */
function currentDay(): number {
  let offset = 0
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('day')
    if (param && /^[+-]?\d+$/.test(param)) offset = Number(param)
  }
  return dayIndex(new Date()) + offset
}

/** Report seasons that resolved between two states (including ones that ran while the player was away). */
function trackNewSeasons(before: GardenState, after: GardenState) {
  for (const season of after.seasons.slice(before.seasons.length)) {
    trackGame('game_end', GAME, { season: season.kind, held: season.held.length, hit: season.hit.length })
  }
}

function Swatch({ kind, size = 18 }: { kind: PlantKind; size?: number }) {
  return <PlantIcon kind={kind} size={size} />
}

function ShapePreview({ shape, kind }: { shape: Cell[]; kind: PlantKind }) {
  const w = Math.max(...shape.map(([x]) => x)) + 1
  const h = Math.max(...shape.map(([, y]) => y)) + 1
  return (
    <svg viewBox={`0 0 ${w * 10} ${h * 10}`} width={w * 10} height={h * 10} aria-hidden>
      {shape.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x * 10 + 1} y={y * 10 + 1} width={8} height={8} rx={2} fill={PLANTS[kind].color} />
      ))}
    </svg>
  )
}

function NoteBody({ kind }: { kind: PlantKind }) {
  const plant = PLANTS[kind]
  return (
    <div>
      <h3 className="mt-1 flex items-center gap-2 font-semibold">
        <Swatch kind={kind} /> {plant.name} <span className="font-normal italic text-forest-400">{plant.latin}</span>
      </h3>
      <p className="mt-1 text-forest-200">{plant.note.body}</p>
      {plant.note.caution && <p className="mt-2 text-amber-200">{plant.note.caution}</p>}
      <a href={plant.note.source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-forest-400 underline underline-offset-2 hover:text-forest-200">
        Calscape: {plant.name}
      </a>
    </div>
  )
}

export default function TendPage() {
  const router = useRouter()
  const sample = router.isReady && router.query.sample === '1'
  const sampleRef = useRef(false)
  const [garden, setGarden] = useState<GardenState | null>(null)
  const [today, setToday] = useState<number | null>(null)
  const [chosen, setChosen] = useState<Lane[]>([])
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)
  const [turn, setTurn] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const [newNote, setNewNote] = useState<PlantKind | null>(null)
  const [compostTip, setCompostTip] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [growth, setGrowth] = useState<{ grew: string[]; bloomed: string[]; n: number } | null>(null)
  const [phase, setPhase] = useState<Phase>('day')
  const [attention, setAttention] = useState<{ cell: Cell; n: number } | null>(null)
  // Sound waits for the player's first action; a bloom found on page load stays quiet.
  const actedRef = useRef(false)
  const gardenRef = useRef<GardenState | null>(null)
  gardenRef.current = garden

  // Load (or start) the garden, and run any seasons that arrived while away.
  // `?sample=1` shows a read-only sample garden instead and leaves storage alone.
  useEffect(() => {
    if (!router.isReady) return
    const day = currentDay()
    sampleRef.current = sample
    setChosen([])
    setSelectedSeed(null)
    setNewNote(null)
    setCompostTip(null)
    // Bed ids repeat between gardens, so one-shot effects must not carry across a switch.
    setFresh(null)
    setGrowth(null)
    setAttention(null)
    setMonth(new Date().getMonth())
    if (sample) {
      setGarden(sampleGarden(day))
      setToday(day)
      return
    }
    const loaded = loadGarden(storage()) ?? newGarden(day)
    const resolved = resolveSeasons(loaded, day)
    trackNewSeasons(loaded, resolved)
    setGarden(resolved)
    setToday(day)
  }, [router.isReady, sample])

  // A tab left open overnight rolls into the new day and its season.
  useEffect(() => {
    setPhase(currentPhase())
    const tick = () => {
      setPhase(currentPhase())
      // The sample is frozen on its fortieth day; only the light changes.
      if (sampleRef.current) return
      const day = currentDay()
      setToday((prev) => (prev === day ? prev : day))
      const g = gardenRef.current
      if (!g) return
      const resolved = resolveSeasons(g, day)
      if (resolved !== g) {
        trackNewSeasons(g, resolved)
        setGarden(resolved)
      }
    }
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    // The sample garden is never written: it would overwrite a real one.
    if (garden) saveGarden(sampleRef.current ? null : storage(), garden)
  }, [garden])

  // A plant's field note unlocks the first time one of its beds blooms.
  useEffect(() => {
    if (!garden || today === null) return
    const next = unlockNotes(garden, today)
    if (next === garden) return
    if (!sampleRef.current) {
      setNewNote(next.notes?.at(-1) ?? null)
      if (actedRef.current) tendSounds.bloom()
    }
    setGarden(next)
  }, [garden, today])

  const seed = garden?.seeds.find((s) => s.id === selectedSeed) ?? garden?.seeds[0] ?? null
  const shapes = useMemo(() => (seed ? orientations(seed.kind) : []), [seed])
  const shape = shapes.length ? shapes[turn % shapes.length] : null

  const submitCheckIn = useCallback(() => {
    if (!garden || today === null) return
    const next = checkIn(garden, today, chosen)
    actedRef.current = true
    tendSounds.checkIn(next.seeds.length - garden.seeds.length)
    buzz(HAPTIC.tap)
    setFresh(null)
    setGrowth((prev) => ({ ...grewBetween(garden, next, today), n: (prev?.n ?? 0) + 1 }))
    setGarden(next)
    setChosen([])
    setSelectedSeed(null)
    setTurn(0)
    trackGame('game_start', GAME, { habits: chosen.length })
  }, [garden, today, chosen])

  const place = useCallback(
    (anchor: Cell) => {
      if (!garden || today === null || !seed || !shape) return
      const next = placeSeed(garden, seed.id, shape, anchor, today)
      if (next === garden) return
      actedRef.current = true
      tendSounds.place(seed.kind)
      buzz(HAPTIC.place)
      const bed = next.beds.at(-1)
      setFresh(bed?.id ?? null)
      if (bed) setAttention((prev) => ({ cell: bed.cells[0], n: (prev?.n ?? 0) + 1 }))
      setGrowth(null)
      setGarden(next)
      setSelectedSeed(null)
      setTurn(0)
    },
    [garden, today, seed, shape],
  )

  const refuse = useCallback(() => {
    tendSounds.refuse()
    buzz(HAPTIC.wrong)
  }, [])

  const rotate = useCallback(() => {
    tendSounds.rotate()
    setTurn((t) => t + 1)
  }, [])

  const compost = useCallback(() => {
    if (!garden || !seed) return
    tendSounds.compost()
    setGarden(compostSeed(garden, seed.id))
    setSelectedSeed(null)
    setTurn(0)
    setCompostTip((i) => (i === null ? 0 : (i + 1) % COMPOST_NOTES.length))
  }, [garden, seed])

  const reset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    const day = currentDay()
    setGarden(newGarden(day))
    setToday(day)
    setConfirmReset(false)
  }, [confirmReset])

  const checkedIn = garden && today !== null ? hasCheckedIn(garden, today) : false
  const firstVisit = !sample && garden !== null && garden.beds.length === 0 && Object.keys(garden.checkins).length === 0
  const coming = garden && today !== null ? forecast(garden, today) : null
  const lastSeason = garden?.seasons.at(-1)
  const recentSeason = lastSeason && today !== null && today - lastSeason.day < 3 ? lastSeason : null
  // A drought day, or any bed still sleeping one off, and the open soil looks dry.
  const parched =
    !!garden && today !== null && (lastSeason?.day === today || garden.beds.some((b) => isDormant(garden, b.id, today)))

  return (
    <main className="min-h-screen bg-forest-950 font-sans text-forest-100">
      <Head>
        <title>Tend | Brooks Roley</title>
        <meta
          name="description"
          content="Tend: a small garden that grows from the habits you actually keep. Check in once a day, fit your seeds onto the grid, and plant for the weather."
        />
        <meta property="og:title" content="Tend | Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="A small garden that grows from the habits you actually keep."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('tend')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
        <TendNav current="garden" sample={sample} />
        {sample && <SampleBanner page="garden" />}
        <header className="mb-8 max-w-2xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-forest-400">A daily garden</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tend</h1>
          <p className="mt-3 text-sm leading-relaxed text-forest-300 sm:text-base">
            Check in once a day. Every habit you kept becomes a seed. Fit the seeds onto the grid, mind the
            neighbours, and plant for the weather.
          </p>
          {!sample && (
            <Link
              href={{ pathname: route('tend').href, query: { sample: '1' } }}
              className={
                firstVisit
                  ? 'mt-4 inline-block rounded-lg border border-forest-400 px-4 py-2 text-sm font-medium text-forest-100 transition-colors hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300'
                  : 'mt-3 inline-block text-sm text-forest-300 underline underline-offset-2 hover:text-white'
              }
            >
              {firstVisit ? 'Peek at a sample garden on day 40 →' : 'Peek at a sample garden'}
            </Link>
          )}
        </header>

        {!garden || today === null ? (
          <p className="text-forest-400">Opening the garden…</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <TendBoard
                garden={garden}
                today={today}
                placing={!sample && seed && shape ? { kind: seed.kind, shape } : null}
                onPlace={place}
                onRotate={rotate}
                onCancel={() => setSelectedSeed(null)}
                onRefuse={refuse}
                fresh={fresh}
                growth={growth}
                attention={attention}
                phase={phase}
                parched={parched}
              />
              <p className="mt-3 font-mono text-xs text-forest-400">
                Day {today - garden.startDay + 1} · {garden.beds.length} beds · {bloomCount(garden, today)} in bloom ·{' '}
                {PHASE_LABEL[phase]}
              </p>
              {month !== null && (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-forest-300">
                  {almanac(month).line}{' '}
                  <a href={almanac(month).source.url} target="_blank" rel="noopener noreferrer" className="text-forest-400 underline underline-offset-2 hover:text-forest-200">
                    Source
                  </a>
                </p>
              )}
            </div>

            <aside className="space-y-6">
              {newNote && (
                <section className="rounded-xl border border-forest-500/60 bg-forest-800/40 p-4 text-sm" aria-live="polite">
                  <p className="font-mono text-xs uppercase tracking-widest text-forest-400">Field note unlocked</p>
                  <NoteBody kind={newNote} />
                  <button type="button" onClick={() => setNewNote(null)} className="mt-3 text-xs text-forest-400 underline-offset-2 hover:text-forest-200 hover:underline">
                    Back to the garden
                  </button>
                </section>
              )}

              {compostTip !== null && (
                <section className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm">
                  <p className="font-mono text-xs uppercase tracking-widest text-amber-300/80">From the compost bin</p>
                  <h2 className="mt-1 font-semibold">{COMPOST_NOTES[compostTip].title}</h2>
                  <p className="mt-1 text-forest-200">{COMPOST_NOTES[compostTip].body}</p>
                  <div className="mt-2 flex gap-4 text-xs">
                    <a href={COMPOST_NOTES[compostTip].source.url} target="_blank" rel="noopener noreferrer" className="text-forest-400 underline underline-offset-2 hover:text-forest-200">
                      {COMPOST_NOTES[compostTip].source.label}
                    </a>
                    <button type="button" onClick={() => setCompostTip(null)} className="text-forest-400 hover:text-forest-200">
                      Close
                    </button>
                  </div>
                </section>
              )}

              {coming && (
                <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                  <h2 className="font-semibold text-amber-200">
                    Drought {coming.inDays === 1 ? 'tomorrow' : `in ${coming.inDays} days`}
                  </h2>
                  <p className="mt-1 text-amber-100/80">
                    Beds not touching a fern will sleep for a few days. Ferns hold water for their neighbours.
                  </p>
                </section>
              )}

              {recentSeason && (
                <section className="rounded-xl border border-forest-700 bg-forest-900/50 p-4 text-sm">
                  <h2 className="font-semibold">
                    {recentSeason.day === today ? 'Drought today' : 'The last drought'}
                  </h2>
                  <p className="mt-1 text-forest-300">
                    {recentSeason.held.length + recentSeason.hit.length === 0
                      ? 'Nothing was planted yet, so nothing was hurt.'
                      : `${recentSeason.held.length} of ${recentSeason.held.length + recentSeason.hit.length} beds held. ${
                          recentSeason.hit.length
                            ? `${recentSeason.hit.length} went to sleep and will wake in a few days.`
                            : 'Nothing went to sleep.'
                        }`}
                  </p>
                </section>
              )}

              {sample ? (
                <section>
                  <h2 className="text-lg font-semibold">Forty days in</h2>
                  <p className="mt-1 text-sm text-forest-400">
                    This gardener checked in on {Object.keys(garden.checkins).length} of {today - garden.startDay + 1} days
                    and weathered {garden.seasons.length} droughts, with ferns keeping most beds awake. Every field note
                    below is collected, and every watershed tier is open.
                  </p>
                </section>
              ) : !checkedIn ? (
                <section>
                  <h2 className="text-lg font-semibold">Today</h2>
                  <p className="mt-1 text-sm text-forest-400">Which did you do? An honest empty day still tends the garden.</p>
                  <ul className="mt-4 space-y-2">
                    {LANES.map((lane) => {
                      const kind = KIND_FOR_LANE[lane]
                      const on = chosen.includes(lane)
                      return (
                        <li key={lane}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setChosen((prev) => (on ? prev.filter((l) => l !== lane) : [...prev, lane]))}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                              on ? 'border-forest-400 bg-forest-800' : 'border-forest-800 hover:border-forest-600'
                            }`}
                          >
                            <Swatch kind={kind} />
                            <span className="flex-1">{PLANTS[kind].habit}</span>
                            <span aria-hidden className="font-mono text-xs text-forest-400">{on ? '✓' : ''}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={submitCheckIn}
                    className="mt-4 w-full rounded-lg bg-forest-200 px-4 py-2.5 text-sm font-semibold text-forest-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950"
                  >
                    {chosen.length ? `Check in: ${chosen.length} seed${chosen.length === 1 ? '' : 's'}` : 'Check in: nothing today'}
                  </button>
                </section>
              ) : garden.seeds.length && seed && shape ? (
                <section>
                  <h2 className="text-lg font-semibold">Seeds to plant</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {garden.seeds.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={s.id === seed.id}
                          aria-label={PLANTS[s.kind].name}
                          onClick={() => {
                            setSelectedSeed(s.id)
                            setTurn(0)
                          }}
                          className={`flex h-14 w-14 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                            s.id === seed.id ? 'border-forest-300 bg-forest-800' : 'border-forest-800 hover:border-forest-600'
                          }`}
                        >
                          <ShapePreview shape={orientations(s.kind)[0]} kind={s.kind} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 rounded-lg border border-forest-800 p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      <Swatch kind={seed.kind} /> {PLANTS[seed.kind].name}
                    </p>
                    <p className="mt-1 text-forest-300">{PLANTS[seed.kind].trait}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={rotate}
                        disabled={shapes.length < 2}
                        className="rounded-md border border-forest-700 px-3 py-1.5 text-xs font-medium hover:bg-forest-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
                      >
                        Rotate (R)
                      </button>
                      <button
                        type="button"
                        onClick={compost}
                        className="rounded-md border border-forest-700 px-3 py-1.5 text-xs font-medium text-forest-300 hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
                      >
                        Compost
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-forest-400">
                    Point at a spot and click to plant. On a phone, tap once to preview and again to plant. A rooted bed
                    never moves.
                  </p>
                </section>
              ) : (
                <section>
                  <h2 className="text-lg font-semibold">All planted</h2>
                  <p className="mt-1 text-sm text-forest-400">
                    The garden grows on every day you check in. A new day starts at {TUNING.rolloverHour}am.
                  </p>
                </section>
              )}

              <details className="rounded-xl border border-forest-800 p-4 text-sm">
                <summary className="cursor-pointer font-medium">
                  Field guide ({garden.notes?.length ?? 0} of {Object.keys(PLANTS).length} collected)
                </summary>
                <p className="mt-2 text-xs text-forest-400">Every note is open to read. A plant&apos;s first bloom adds it to your collection.</p>
                <ul className="mt-3 space-y-4">
                  {(Object.keys(PLANTS) as PlantKind[]).map((kind) => (
                    <li key={kind}>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-forest-500">
                        {garden.notes?.includes(kind) ? 'Collected' : 'Not yet bloomed'}
                      </p>
                      <NoteBody kind={kind} />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-forest-500">
                  Plant facts from Calscape, the California Native Plant Society&apos;s plant database. Composting from{' '}
                  <a href={SOURCES.ucIpmCompost.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-forest-300">UC IPM</a>; labels from{' '}
                  <a href={SOURCES.calrecycleLabels.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-forest-300">CalRecycle</a>.
                </p>
              </details>

              <details className="rounded-xl border border-forest-800 p-4 text-sm">
                <summary className="cursor-pointer font-medium">How the plants work</summary>
                <ul className="mt-3 space-y-2">
                  {(Object.keys(PLANTS) as PlantKind[]).map((kind) => (
                    <li key={kind} className="flex gap-2">
                      <Swatch kind={kind} />
                      <span>
                        <span className="font-medium">{PLANTS[kind].name}.</span>{' '}
                        <span className="text-forest-300">{PLANTS[kind].trait}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-forest-400">
                  Plants grow only on days you check in, and nothing dies while you are away. A drought comes every{' '}
                  {TUNING.seasonEveryDays} days, with {TUNING.forecastDays} days&apos; warning.
                </p>
                <p className="mt-3 text-forest-400">
                  {PETS.map((pet) => pet.habit).join(' ')}
                </p>
                <p className="mt-3 text-forest-400">Your habits are saved in this browser only.</p>
                {!sample && (
                  <button
                    type="button"
                    onClick={reset}
                    onBlur={() => setConfirmReset(false)}
                    className="mt-3 text-xs text-forest-500 underline-offset-2 hover:text-forest-300 hover:underline"
                  >
                    {confirmReset ? 'Click again to erase this garden' : 'Start over'}
                  </button>
                )}
              </details>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}
