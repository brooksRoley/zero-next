import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HardwoodStation from 'src/components/games/shootaround/HardwoodStation'
import {
  CapSpaceStation,
  CutLanesStation,
  GOLD,
  PrimaryButton,
  ReadDefenseStation,
  StarUpStation,
} from 'src/components/games/shootaround/Stations'
import { trackGame } from 'src/lib/analytics'
import { STATIONS, dailySet, questRoster, type QuestPlayer, type StationId } from 'src/lib/games/shootaround/puzzles'
import {
  dayKey,
  dayRecord,
  daysComplete,
  emptySave,
  isComplete,
  loadSave,
  markDone,
  nextStation,
  setHardwoodBaseline,
  streak,
  writeSave,
  type Outcome,
  type QuestSave,
} from 'src/lib/games/shootaround/progress'
import { absoluteUrl, route } from 'src/lib/routes'

const SLUG = 'shootaround'
// Hardwood's own roster, served with the game from public/hardwood.
const ROSTER_URL = '/hardwood/engine_roster.json'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const STATION_GAMES: Record<string, string> = {
  Hardwood: route('hardwood').href,
  'Pass & Cut': route('passAndCut').href,
  'Read & React': route('readAndReact').href,
}

export default function ShootaroundPage() {
  const [day, setDay] = useState<string | null>(null)
  const [save, setSave] = useState<QuestSave>(emptySave)
  const [roster, setRoster] = useState<QuestPlayer[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // The station on screen; null follows the first unfinished one.
  const [view, setView] = useState<StationId | null>(null)
  const saveRef = useRef(save)
  const startedRef = useRef(false)

  useEffect(() => {
    setDay(dayKey(new Date()))
    const loaded = loadSave(storage())
    saveRef.current = loaded
    setSave(loaded)
    let live = true
    fetch(ROSTER_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => {
        if (!live) return
        const players = questRoster(raw)
        if (players.length >= 8) setRoster(players)
        else setLoadFailed(true)
      })
      .catch(() => live && setLoadFailed(true))
    return () => {
      live = false
    }
  }, [])

  const puzzles = useMemo(() => (day && roster ? dailySet(day, roster) : null), [day, roster])
  const rec = day ? dayRecord(save, day) : null

  const commit = useCallback((next: QuestSave) => {
    saveRef.current = next
    setSave(next)
    writeSave(storage(), next)
  }, [])

  const onAttempt = useCallback(
    (station: StationId, correct: boolean) => {
      if (!day) return
      const today = dayRecord(saveRef.current, day)
      if (!startedRef.current && Object.keys(today.done).length === 0) {
        startedRef.current = true
        trackGame('game_start', SLUG, { day })
      }
      trackGame(correct ? 'puzzle_solved' : 'puzzle_failed', SLUG, { station, day })
    },
    [day],
  )

  const onDone = useCallback(
    (station: StationId, outcome: Outcome) => {
      if (!day) return
      const before = dayRecord(saveRef.current, day)
      if (before.done[station] === 'solved') return
      const next = markDone(saveRef.current, day, station, outcome)
      commit(next)
      setView(station) // keep the lesson on screen until the player moves on
      const after = dayRecord(next, day)
      if (!isComplete(before) && isComplete(after)) {
        const shown = Object.values(after.done).filter((o) => o === 'shown').length
        trackGame('game_end', SLUG, { result: 'win', day, shown, streak: streak(next, day) })
      }
    },
    [day, commit],
  )

  const onBaseline = useCallback(
    (fights: number) => {
      if (day) commit(setHardwoodBaseline(saveRef.current, day, fights))
    },
    [day, commit],
  )

  const upNext = rec ? nextStation(rec) : 'starUp'
  const current: StationId | null = view ?? upNext
  const info = STATIONS.find((s) => s.id === current) ?? null
  const doneCount = rec ? Object.keys(rec.done).length : 0
  const dayDone = rec ? isComplete(rec) : false
  const runStreak = day ? streak(save, day) : 0
  const unlocked = (id: StationId) => {
    if (!rec) return id === 'starUp'
    const idx = STATIONS.findIndex((s) => s.id === id)
    return STATIONS.slice(0, idx).every((s) => rec.done[s.id])
  }
  const nextAfterView = view && rec ? nextStation(rec) : null

  const station = (id: StationId) => {
    if (!puzzles || !rec || !day) return null
    const finished = Boolean(rec.done[id])
    const key = `${day}-${id}`
    const attempt = (ok: boolean) => onAttempt(id, ok)
    const done = (o: Outcome) => onDone(id, o)
    switch (id) {
      case 'starUp':
        return <StarUpStation key={key} puzzle={puzzles.starUp} finished={finished} onAttempt={attempt} onDone={done} />
      case 'capSpace':
        return <CapSpaceStation key={key} puzzle={puzzles.capSpace} finished={finished} onAttempt={attempt} onDone={done} />
      case 'cutLanes':
        return <CutLanesStation key={key} puzzle={puzzles.cutLanes} finished={finished} onAttempt={attempt} onDone={done} />
      case 'readD':
        return <ReadDefenseStation key={key} puzzle={puzzles.readD} finished={finished} onAttempt={attempt} onDone={done} />
      case 'hardwood':
        return <HardwoodStation key={key} rec={rec} finished={finished} onBaseline={onBaseline} onDone={done} />
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 font-sans text-white">
      <Head>
        <title>Shootaround | Brooks Roley</title>
        <meta
          name="description"
          content="Shootaround: a daily quest of five short stations. Puzzles from Hardwood, Pass & Cut and Read & React teach hash maps, dynamic programming, minimum cuts and matrix multiplication, then you play a round of Hardwood."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Shootaround — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="Five stations a day: four puzzles that teach a computer-science or math idea, then a real round of Hardwood."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('shootaround')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
        <header>
          <p className="font-mono text-xs uppercase tracking-widest" style={{ color: GOLD }}>
            Daily quest
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Shootaround</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300 sm:text-base">
            Five stations a day, about ten minutes. Four puzzles borrow a rule from a game on this site and teach the idea underneath
            it: a data structure, an algorithm, graph theory, linear algebra. The fifth is a real round of Hardwood, where all four
            show up at once. New boards every midnight.
          </p>
          <dl className="mt-5 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              ['Today', `${doneCount}/${STATIONS.length}`],
              ['Streak', `${runStreak} ${runStreak === 1 ? 'day' : 'days'}`],
              ['Days done', String(daysComplete(save))],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                <dt className="font-mono text-[11px] uppercase tracking-widest text-ink-400">{k}</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <nav aria-label="Stations" className="mt-6">
          <ol className="grid grid-cols-5 gap-1.5">
            {STATIONS.map((s, i) => {
              const outcome = rec?.done[s.id]
              const open = unlocked(s.id)
              const here = current === s.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => setView(s.id === upNext ? null : s.id)}
                    aria-current={here ? 'step' : undefined}
                    className={`flex h-full min-h-[64px] w-full flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${
                      here ? 'border-[#FDB927] bg-[#FDB927]/10' : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <span className="font-mono text-xs" style={{ color: outcome ? GOLD : undefined }}>
                      {outcome === 'solved' ? '✓' : outcome === 'shown' ? '◐' : i + 1}
                    </span>
                    <span className="mt-0.5 text-[11px] font-semibold leading-tight sm:text-xs">{s.title}</span>
                    <span className="hidden text-[10px] leading-tight text-ink-400 sm:block">{s.track}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6" aria-live="polite">
          {loadFailed && (
            <p className="text-sm text-ink-200">
              The Hardwood roster didn&apos;t load, so today&apos;s stations can&apos;t be built. Try reloading the page.
            </p>
          )}
          {!loadFailed && !puzzles && <p className="text-sm text-ink-300">Setting up today&apos;s stations…</p>}

          {puzzles && current === null && dayDone && (
            <div>
              <h2 className="text-xl font-bold">Today&apos;s shootaround is done</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                {runStreak > 1 ? `That’s ${runStreak} days in a row. ` : ''}New boards at midnight. Tap any station above to look at
                its answer again.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {STATIONS.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span>
                      {s.title} <span className="text-ink-400">· {s.concept}</span>
                    </span>
                    <span className="font-mono text-xs" style={{ color: GOLD }}>
                      {rec?.done[s.id] === 'solved' ? 'solved' : 'shown'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-ink-300">
                Want more of one idea? Play the full games:{' '}
                <Link href={route('passAndCut').href} className="underline underline-offset-2 hover:text-white">
                  Pass &amp; Cut
                </Link>
                ,{' '}
                <Link href={route('readAndReact').href} className="underline underline-offset-2 hover:text-white">
                  Read &amp; React
                </Link>
                ,{' '}
                <Link href={route('hardwood').href} className="underline underline-offset-2 hover:text-white">
                  Hardwood
                </Link>
                .
              </p>
            </div>
          )}

          {puzzles && current && info && (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{info.title}</h2>
                <p className="font-mono text-xs uppercase tracking-widest text-ink-400">
                  {info.track} ·{' '}
                  <Link href={STATION_GAMES[info.game]} className="underline underline-offset-2 hover:text-white">
                    {info.game}
                  </Link>
                </p>
              </div>
              <div className="mt-4">{station(current)}</div>
              {view && rec?.done[view] && (
                <div className="mt-6 flex justify-end">
                  <PrimaryButton onClick={() => setView(null)}>
                    {nextAfterView
                      ? `Next: ${STATIONS.find((s) => s.id === nextAfterView)?.title} →`
                      : dayDone
                        ? 'See today’s summary →'
                        : 'Back to today →'}
                  </PrimaryButton>
                </div>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs leading-relaxed text-ink-500">
          Your progress stays in this browser. Everyone gets the same boards on the same day.
        </p>
      </div>
    </main>
  )
}
