import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { track, trackGame } from 'src/lib/analytics'
import {
  ARM_REACH,
  COURT_H,
  COURT_W,
  CORNER_BREAK_Y,
  HOOP,
  THREE_ARC,
  gradeSpot,
  type GradeResult,
  type Vec,
} from 'src/lib/moments/geometry'
import { MOMENTS } from 'src/lib/moments/moments'
import { absoluteUrl } from 'src/lib/routes'

/**
 * Playoff Moments — "the frozen second."
 * Famous playoff plays frozen one beat before they happen, replayed as court
 * shape-and-speed puzzles: your legs are a disk (speed × time), every
 * defender's reach is a disk, and the puzzle is the geometry between them.
 */

const S = 10 // px per foot
const px = (x: number) => x * S
const py = (y: number) => (COURT_H - y) * S

const GOLD = '#FDB927'
const GRADE_COLOR: Record<string, string> = {
  A: GOLD,
  B: '#6abf82',
  C: '#ff8cc2',
  D: '#94a3b8',
}

function threeArcPoints(): string {
  const start = Math.atan2(CORNER_BREAK_Y - HOOP.y, -22.08)
  const end = Math.atan2(CORNER_BREAK_Y - HOOP.y, 22.08)
  const pts: string[] = []
  for (let i = 0; i <= 48; i++) {
    const a = start + ((end - start) * i) / 48
    pts.push(`${px(HOOP.x + THREE_ARC * Math.cos(a))},${py(HOOP.y + THREE_ARC * Math.sin(a))}`)
  }
  return pts.join(' ')
}

// Court lines: bright enough to read the floor at a glance on the dark stage.
const LINE = '#4a6b5d'
const ARC_POINTS = threeArcPoints()

function Court({
  children,
  onPick,
  spotlight,
}: {
  children: React.ReactNode
  onPick?: (p: Vec) => void
  /** Where the stage light falls: the frozen protagonist (the house's one accent). */
  spotlight?: Vec
}) {
  return (
    <svg
      viewBox={`0 0 ${COURT_W * S} ${COURT_H * S}`}
      className="block w-full touch-manipulation rounded-lg"
      role="img"
      aria-label="Offensive half court"
      onClick={(e) => {
        if (!onPick) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * COURT_W
        const y = COURT_H - ((e.clientY - rect.top) / rect.height) * COURT_H
        onPick({ x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 })
      }}
      style={{ background: '#071410', cursor: onPick ? 'crosshair' : 'default' }}
    >
      <defs>
        {/* Dark hardwood: 2-foot planks, two tones, barely there — a floor, not a texture demo. */}
        <pattern id="mo-planks" width={4 * S} height={COURT_H * S} patternUnits="userSpaceOnUse">
          <rect width={2 * S} height={COURT_H * S} fill="#0a1a13" />
          <rect x={2 * S} width={2 * S} height={COURT_H * S} fill="#0c1e16" />
          <line x1={0} y1={0} x2={0} y2={COURT_H * S} stroke="#050e0a" strokeWidth={1} />
        </pattern>
        <radialGradient id="mo-light" r="0.5">
          <stop offset="0%" stopColor={GOLD} stopOpacity={0.22} />
          <stop offset="60%" stopColor={GOLD} stopOpacity={0.05} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </radialGradient>
        <filter id="mo-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>
      <rect width={COURT_W * S} height={COURT_H * S} fill="url(#mo-planks)" />
      {spotlight && (
        <circle cx={px(spotlight.x)} cy={py(spotlight.y)} r={16 * S} fill="url(#mo-light)" pointerEvents="none" />
      )}
      {/* boundary + half-court line */}
      <rect x={1} y={1} width={COURT_W * S - 2} height={COURT_H * S - 2} fill="none" stroke={LINE} strokeWidth={2} />
      {/* paint */}
      <rect x={px(17)} y={py(19)} width={px(16)} height={19 * S} fill="#0f2a1f" fillOpacity={0.7} stroke={LINE} strokeWidth={2} />
      <circle cx={px(25)} cy={py(19)} r={6 * S} fill="none" stroke={LINE} strokeWidth={2} />
      {/* backboard + rim */}
      <line x1={px(22)} y1={py(4)} x2={px(28)} y2={py(4)} stroke="#c8d6cf" strokeWidth={3} strokeLinecap="round" />
      <path
        d={`M ${px(HOOP.x - 0.75)} ${py(HOOP.y)} l ${0.25 * S} ${0.9 * S} h ${S} l ${0.25 * S} ${-0.9 * S}`}
        fill="none" stroke="#c8d6cf" strokeOpacity={0.35} strokeWidth={1}
      />
      <circle cx={px(HOOP.x)} cy={py(HOOP.y)} r={0.75 * S} fill="none" stroke="#e8792b" strokeWidth={3} />
      {/* three-point line */}
      <line x1={px(2.92)} y1={py(0)} x2={px(2.92)} y2={py(CORNER_BREAK_Y)} stroke={LINE} strokeWidth={2} />
      <line x1={px(47.08)} y1={py(0)} x2={px(47.08)} y2={py(CORNER_BREAK_Y)} stroke={LINE} strokeWidth={2} />
      <polyline points={ARC_POINTS} fill="none" stroke={LINE} strokeWidth={2} />
      {children}
    </svg>
  )
}

function ActorDot({
  pos,
  name,
  fill,
  dim,
  star,
}: {
  pos: Vec
  name: string
  fill: string
  dim?: boolean
  /** The protagonist: a soft halo that breathes (stills under reduced motion). */
  star?: boolean
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  return (
    <g opacity={dim ? 0.7 : 1}>
      {star && (
        <circle
          cx={px(pos.x)}
          cy={py(pos.y)}
          r={21}
          fill="none"
          stroke={fill}
          strokeWidth={2}
          className="motion-safe:animate-pulse"
          opacity={0.5}
        />
      )}
      <circle cx={px(pos.x)} cy={py(pos.y)} r={14} fill={fill} stroke="#04120c" strokeWidth={2} filter="url(#mo-shadow)" />
      <text
        x={px(pos.x)}
        y={py(pos.y) + 4}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
        fill="#04120c"
        fontWeight={800}
      >
        {initials}
      </text>
      <title>{name}</title>
    </g>
  )
}

export default function PlayoffMoments() {
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<Vec | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [grades, setGrades] = useState<string[]>([])

  const moment = MOMENTS[idx]
  const finished = grades.length >= MOMENTS.length
  const aiming = !result && !finished

  const takeShot = () => {
    if (!chosen || result) return
    const r = gradeSpot(chosen, moment)
    setResult(r)
    setGrades((g) => [...g, r.grade])
    track('moment_attempt', {
      page: '/games/moments',
      metadata: { moment: moment.id, grade: r.grade, historicalMatch: r.historicalMatch },
    })
    // An A or B is a read the coach would accept; C and D are misses.
    trackGame(r.grade === 'A' || r.grade === 'B' ? 'puzzle_solved' : 'puzzle_failed', 'moments', {
      puzzle_id: moment.id,
      grade: r.grade,
    })
  }

  const next = () => {
    setChosen(null)
    setResult(null)
    if (idx < MOMENTS.length - 1) setIdx(idx + 1)
  }

  const replay = () => {
    setIdx(0)
    setChosen(null)
    setResult(null)
    setGrades([])
  }

  const reachR = moment.protagonist.speed * moment.timeLeft * S

  return (
    <main className="min-h-screen bg-ink-950 text-white font-sans">
      <Head>
        <title>Playoff Moments | Brooks Roley</title>
        <meta
          name="description"
          content="Famous NBA playoff plays frozen one beat before they happen, replayed as court shape-and-speed puzzles. Your legs against their closing speed — click the spot."
        />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content="Playoff Moments — Brooks Roley" key="og:title" />
        <meta
          property="og:description"
          content="Famous NBA playoff plays frozen one beat before they happen, replayed as court shape-and-speed puzzles. Click the spot history found."
          key="og:description"
        />
        <meta property="og:url" content={absoluteUrl('moments')} key="og:url" />
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
        <header className="mb-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-[#FDB927]/80">
            The frozen second
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Playoff <span className="text-[#FDB927]">Moments</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300">
            Five famous playoff plays, frozen one beat before they happen. You get the
            protagonist&apos;s legs — speed times seconds — against the defense&apos;s closing
            speed. Click the spot. The geometry grades you; history gets the last word.
          </p>
        </header>

        {/* progress */}
        <div className="mb-4 flex items-center gap-2 font-mono text-xs text-ink-400">
          {MOMENTS.map((m, i) => (
            <span
              key={m.id}
              className="flex h-6 w-6 items-center justify-center rounded-full border"
              style={{
                borderColor: grades[i] ? GRADE_COLOR[grades[i]] : i === idx && !finished ? GOLD : '#2b3f37',
                color: grades[i] ? GRADE_COLOR[grades[i]] : '#5a6f66',
              }}
            >
              {grades[i] ?? i + 1}
            </span>
          ))}
        </div>

        {!finished && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <Court onPick={aiming ? setChosen : undefined} spotlight={moment.protagonist.pos}>
                {/* reveal: defender reach disks + protagonist reach */}
                {result && (
                  <g>
                    {moment.defenders.map((d) => (
                      <circle
                        key={d.name}
                        cx={px(d.pos.x)}
                        cy={py(d.pos.y)}
                        r={(d.speed * moment.defenderTime + ARM_REACH) * S}
                        fill="#b91c5e"
                        opacity={0.12}
                        stroke="#b91c5e"
                        strokeOpacity={0.35}
                        strokeDasharray="3 4"
                      />
                    ))}
                  </g>
                )}
                {aiming && (
                  <circle
                    cx={px(moment.protagonist.pos.x)}
                    cy={py(moment.protagonist.pos.y)}
                    r={reachR}
                    fill={GOLD}
                    opacity={0.05}
                    stroke={GOLD}
                    strokeOpacity={0.4}
                    strokeDasharray="4 5"
                  />
                )}

                {moment.teammates.map((t) => (
                  <ActorDot key={t.name} pos={t.pos} name={t.name} fill="#40916c" dim />
                ))}
                {moment.defenders.map((d) => (
                  <ActorDot key={d.name} pos={d.pos} name={d.name} fill="#94a3b8" />
                ))}
                <ActorDot pos={moment.protagonist.pos} name={moment.protagonist.name} fill={GOLD} star />

                {/* reveal: best spot / deny target and history */}
                {result && (
                  <g>
                    <circle
                      cx={px(result.best.x)}
                      cy={py(result.best.y)}
                      r={9}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={2.5}
                    />
                    <text x={px(result.best.x)} y={py(result.best.y) - 14} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={GOLD}>
                      {moment.kind === 'deny' ? 'the ball’s future' : 'geometry’s answer'}
                    </text>
                    <circle
                      cx={px(moment.historicalSpot.x)}
                      cy={py(moment.historicalSpot.y)}
                      r={6}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeDasharray="2 3"
                    />
                    <text x={px(moment.historicalSpot.x)} y={py(moment.historicalSpot.y) + 20} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#c8d6cf">
                      history
                    </text>
                  </g>
                )}

                {chosen && (
                  <g>
                    <circle
                      cx={px(chosen.x)}
                      cy={py(chosen.y)}
                      r={8}
                      fill={result ? GRADE_COLOR[result.grade] : GOLD}
                      opacity={0.9}
                    />
                    <circle cx={px(chosen.x)} cy={py(chosen.y)} r={13} fill="none" stroke={result ? GRADE_COLOR[result.grade] : GOLD} strokeWidth={1.5} opacity={0.6} />
                  </g>
                )}
              </Court>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
                {aiming
                  ? chosen
                    ? 'Spot marked — take the shot, or click again to move it'
                    : 'Click the court to pick your spot'
                  : 'Red disks: where a defender’s hand arrives in time'}
              </p>
            </div>

            <aside className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#FDB927]/80">
                  {moment.series}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{moment.title}</h2>
                <p className="font-mono text-xs text-ink-400">
                  {moment.date} · {moment.clock}
                </p>
              </div>

              {!result ? (
                <>
                  <p className="text-sm leading-relaxed text-ink-300">{moment.story}</p>
                  <p className="border-l-2 border-[#FDB927]/50 pl-3 text-sm font-medium leading-relaxed text-ink-100">
                    {moment.question}
                  </p>
                  <button
                    onClick={takeShot}
                    disabled={!chosen}
                    className="rounded-full border border-[#FDB927]/60 bg-[#FDB927]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#FDB927] transition-colors enabled:hover:bg-[#FDB927]/20 disabled:opacity-40"
                  >
                    {moment.kind === 'deny' ? 'Make the run' : 'Take the shot'}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold" style={{ color: GRADE_COLOR[result.grade] }}>
                      {result.grade}
                    </span>
                    {result.historicalMatch && (
                      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#FDB927]">
                        That’s the spot history chose
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-200">{result.lesson}</p>
                  <p className="border-l-2 border-ink-700 pl-3 text-sm italic leading-relaxed text-ink-400">
                    {moment.epilogue}
                  </p>
                  <button
                    onClick={next}
                    className="rounded-full border border-[#FDB927]/60 bg-[#FDB927]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#FDB927] transition-colors hover:bg-[#FDB927]/20"
                  >
                    {idx < MOMENTS.length - 1 ? 'Next moment' : 'Final whistle'}
                  </button>
                </>
              )}
            </aside>
          </div>
        )}

        {finished && (
          <div className="rounded-xl border border-ink-800/60 bg-ink-900/40 p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#FDB927]/80">Box score</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {grades.map((g, i) => (
                <span key={i} className="text-3xl font-bold" style={{ color: GRADE_COLOR[g] }}>
                  {g}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink-300">
              Five frozen seconds, five reads. Twice in this repertory the geometry and
              history disagree — Fisher and Kawhi both took shots the floor graded a C
              and made them anyway. The lesson cuts both ways: learn the shape, and
              respect the players who beat it.
            </p>
            <button
              onClick={replay}
              className="mt-6 rounded-full border border-[#FDB927]/60 bg-[#FDB927]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#FDB927] transition-colors hover:bg-[#FDB927]/20"
            >
              Run it back
            </button>
          </div>
        )}

        {/* the frame */}
        <footer className="mt-10 flex flex-col gap-2 border-t border-ink-800/50 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-relaxed text-ink-500">
            Positions are reconstructions from broadcast footage — close enough to teach
            the geometry, not survey data. Part of{' '}
            <Link href="/theater" className="text-ink-300 underline decoration-ink-700 hover:text-ink-100">
              The Zero Theater
            </Link>
            , Act II.
          </p>
        </footer>
      </div>
    </main>
  )
}
