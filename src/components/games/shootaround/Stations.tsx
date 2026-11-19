/**
 * The four puzzle stations of the Shootaround. Each one is a small, self-contained
 * puzzle: the rules and the answer come from src/lib/games/shootaround/puzzles.ts,
 * and the component only asks, checks, and teaches.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { edgeKey, type EdgeKey } from 'src/lib/games/passcut/graph'
import {
  COPIES_FOR_STAR,
  checkCapSpace,
  checkCut,
  copiesAfterBuying,
  countCopies,
  greedyByRating,
  type CapSpace,
  type CutLanes,
  type QuestPlayer,
  type ReadDefense,
  type StarUp,
} from 'src/lib/games/shootaround/puzzles'
import type { Outcome } from 'src/lib/games/shootaround/progress'
import PlayerCard, { useSpecialMove } from 'src/components/players/PlayerCard'
import PlayerSprite from 'src/components/players/PlayerSprite'

export const GOLD = '#FDB927'
export const PURPLE = '#552583'

export type StationProps<P> = {
  puzzle: P
  /** Already finished today: show the answer and the lesson, no more checking. */
  finished: boolean
  /** One check. `correct` false is a miss; the station stays open. */
  onAttempt: (correct: boolean) => void
  onDone: (outcome: Outcome) => void
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const fix2 = (x: number) => x.toFixed(2)

export function Feedback({ tone, children }: { tone: 'good' | 'miss' | 'info'; children: ReactNode }) {
  const color = tone === 'good' ? 'border-emerald-400/60 bg-emerald-400/10' : tone === 'miss' ? 'border-rose-400/60 bg-rose-400/10' : 'border-white/20 bg-white/5'
  return (
    <p role="status" aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed text-white ${color}`}>
      {children}
    </p>
  )
}

export function Lesson({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-[#FDB927]/30 bg-[#FDB927]/[0.06] p-4 text-sm leading-relaxed text-ink-200">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
        {title}
      </h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}

function ShowMe({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 min-h-[44px] rounded-full border border-white/25 px-4 text-sm font-semibold text-ink-200 hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      Show me the answer
    </button>
  )
}

export function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[44px] rounded-full px-5 text-sm font-bold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ background: GOLD }}
    >
      {children}
    </button>
  )
}

// ── Player cards ─────────────────────────────────────────────────

const CARD_FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/** A pickable player card: hover or focus plays the move, a pick plays it too. */
function PickCard({
  player,
  onPick,
  disabled,
  pressed,
  tone,
  star,
  variant,
  aside,
  label,
}: {
  player: QuestPlayer
  onPick: () => void
  disabled: boolean
  pressed: boolean
  tone: 'idle' | 'gold' | 'miss'
  star?: boolean
  variant: 'full' | 'compact'
  aside?: string
  label: string
}) {
  const [play, trigger] = useSpecialMove()
  const border = tone === 'gold' ? 'border-[#FDB927] bg-[#FDB927]/15' : tone === 'miss' ? 'border-rose-400/70 bg-rose-400/10' : 'border-white/15 bg-white/5 hover:border-white/40'
  return (
    <button
      type="button"
      onClick={() => {
        trigger()
        onPick()
      }}
      onPointerEnter={trigger}
      onFocus={trigger}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      className={`rounded-xl border-2 px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-default ${CARD_FOCUS} ${border}`}
    >
      <PlayerCard player={player} play={play} star={star} variant={variant} aside={aside} />
    </button>
  )
}

/** A bench spot: the figure and the name, no stats. Hover plays the move. */
function BenchSpot({ player }: { player: QuestPlayer }) {
  const [play, trigger] = useSpecialMove()
  return (
    <li
      className="flex w-[4.75rem] flex-col items-center rounded-lg border border-white/10 bg-white/5 px-1 pb-1.5 pt-1 text-center"
      onPointerEnter={trigger}
    >
      <PlayerSprite player={player} size={60} play={play} />
      <span className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-white">{player.name}</span>
    </li>
  )
}

// ── Station 1: Star-up ───────────────────────────────────────────

export function StarUpStation({ puzzle, finished, onAttempt, onDone }: StationProps<StarUp>) {
  const [picked, setPicked] = useState<number | null>(finished ? puzzle.answer : null)
  const [misses, setMisses] = useState(0)
  const [open, setOpen] = useState(finished)
  const counts = useMemo(() => [...countCopies(puzzle.bench).values()], [puzzle])

  const choose = (id: number) => {
    if (open) return
    setPicked(id)
    const correct = id === puzzle.answer
    onAttempt(correct)
    if (correct) {
      setOpen(true)
      onDone('solved')
    } else setMisses((m) => m + 1)
  }
  const reveal = () => {
    setPicked(puzzle.answer)
    setOpen(true)
    onDone('shown')
  }
  const missed = picked !== null && picked !== puzzle.answer && !open
  const missCopies = missed && picked !== null ? copiesAfterBuying(puzzle.bench, picked) : 0
  const missName = missed ? puzzle.shop.find((p) => p.id === picked)?.name : ''

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-200">
        In Hardwood, three copies of one player merge into a <strong className="text-white">★★</strong> with 1.8× stats.
        Here&apos;s your bench. <strong className="text-white">Which shop card gives you a ★★?</strong>
      </p>
      <h3 className="mt-4 font-mono text-xs uppercase tracking-widest text-ink-400">Bench</h3>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Bench">
        {puzzle.bench.map((p, i) => (
          <BenchSpot key={i} player={p} />
        ))}
      </ul>
      <h3 className="mt-4 font-mono text-xs uppercase tracking-widest text-ink-400">Shop</h3>
      <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {puzzle.shop.map((p) => {
          const isAnswer = open && p.id === puzzle.answer
          return (
            <PickCard
              key={p.id}
              player={p}
              onPick={() => choose(p.id)}
              disabled={open}
              pressed={picked === p.id}
              tone={isAnswer ? 'gold' : picked === p.id ? 'miss' : 'idle'}
              star={isAnswer}
              variant="compact"
              label={`Buy ${p.name}, ${p.cost} gold`}
            />
          )
        })}
      </div>
      {missed && (
        <Feedback tone="miss">
          Buying {missName} gives you {missCopies} {missCopies === 1 ? 'copy' : 'copies'}, not {COPIES_FOR_STAR}. Count each name on
          the bench once, then check each card against your count.
        </Feedback>
      )}
      {missed && misses >= 1 && <ShowMe onClick={reveal} />}
      {open && (
        <Lesson title="Hash map: count once, look up fast">
          <p>
            Scan the bench once and keep a tally: name → copies. Then each shop card is one lookup: does it already have{' '}
            {COPIES_FOR_STAR - 1}?
          </p>
          <table className="w-full max-w-sm font-mono text-xs">
            <tbody>
              {counts.map(({ player, copies }) => (
                <tr key={player.id} className={player.id === puzzle.answer ? 'text-[#FDB927]' : ''}>
                  <td className="py-0.5 pr-3">{player.name}</td>
                  <td className="py-0.5 text-right">{copies}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Comparing every bench player with every other is about n² checks. The tally is n steps to build and one step per
            lookup. {counts.find((c) => c.copies === 2 && c.player.id !== puzzle.answer)?.player.name} also had two copies, but
            no card in the shop, so a pair is all you get. Hardwood&apos;s copies badge on each shop card keeps this same map for
            you.
          </p>
        </Lesson>
      )}
    </div>
  )
}

// ── Station 2: Cap space ─────────────────────────────────────────

export function CapSpaceStation({ puzzle, finished, onAttempt, onDone }: StationProps<CapSpace>) {
  const best = puzzle.solution
  const [pick, setPick] = useState<number[]>(finished ? best.pick : [])
  const [verdict, setVerdict] = useState<ReturnType<typeof checkCapSpace> | null>(null)
  const [open, setOpen] = useState(finished)
  const spent = pick.reduce((s, i) => s + puzzle.items[i].cost, 0)
  const total = pick.reduce((s, i) => s + puzzle.items[i].value, 0)
  const greedy = useMemo(() => greedyByRating(puzzle.items, puzzle.budget), [puzzle])

  const toggle = (i: number) => {
    if (open) return
    setVerdict(null)
    setPick((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)))
  }
  const sign = () => {
    const v = checkCapSpace(puzzle, pick)
    setVerdict(v)
    onAttempt(v.ok)
    if (v.ok) {
      setOpen(true)
      onDone('solved')
    }
  }
  const reveal = () => {
    setPick(best.pick)
    setVerdict(null)
    setOpen(true)
    onDone('shown')
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-200">
        Your cap is <strong className="text-white">{puzzle.budget}G</strong>, Hardwood&apos;s opening budget. Sign the free agents
        with the <strong className="text-white">highest total rating</strong> without going over. (Rating is the average of
        shooting, speed and defense.)
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {puzzle.items.map((it, i) => {
          const on = pick.includes(i)
          return (
            <PickCard
              key={it.player.id}
              player={it.player}
              onPick={() => toggle(i)}
              disabled={open}
              pressed={on}
              tone={on ? 'gold' : 'idle'}
              variant="full"
              aside={`rating ${it.value}`}
              label={`${on ? 'Release' : 'Sign'} ${it.player.name}, ${it.cost} gold, rating ${it.value}`}
            />
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm text-white">
          <span className={spent > puzzle.budget ? 'text-rose-300' : ''}>
            {spent}/{puzzle.budget}G
          </span>{' '}
          · rating {total}
        </p>
        {!open && (
          <PrimaryButton onClick={sign} disabled={pick.length === 0 || spent > puzzle.budget}>
            Sign them
          </PrimaryButton>
        )}
      </div>
      {spent > puzzle.budget && !open && <Feedback tone="miss">That&apos;s over the cap. Hardwood won&apos;t let you sign past it either.</Feedback>}
      {verdict && !verdict.ok && verdict.reason === 'short' && (
        <Feedback tone="miss">
          A rating of {verdict.value} is legal, but a better roster fits under {puzzle.budget}G. The best-rated players aren&apos;t
          always the best buy: ask what each one costs you in gold you can&apos;t spend elsewhere.
        </Feedback>
      )}
      {verdict && !verdict.ok && <ShowMe onClick={reveal} />}
      {open && (
        <Lesson title="Knapsack: dynamic programming">
          <p>
            The best roster rates <strong className="text-white">{best.value}</strong>.{' '}
            {puzzle.greedyValue < best.value
              ? `Signing the best-rated players first gets only ${puzzle.greedyValue}: ${greedy.map((i) => puzzle.items[i].player.name).join(', ')}.`
              : 'Here signing the best-rated players first happens to work, but it often doesn’t.'}
          </p>
          <p>
            Dynamic programming answers a smaller question first: what&apos;s the best rating for 0G, 1G, 2G… adding one player at
            a time? Each answer reuses the last ones, so six players and 11 budgets take 66 small steps, not all 64 rosters.
          </p>
          <div className="overflow-x-auto">
            <table className="font-mono text-xs">
              <thead>
                <tr className="text-ink-400">
                  <th className="pr-2 text-left font-normal">gold</th>
                  {best.best.map((_, g) => (
                    <th key={g} className="px-1.5 font-normal">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-2 text-ink-400">best</td>
                  {best.best.map((v, g) => (
                    <td key={g} className={`px-1.5 text-center ${g === puzzle.budget ? 'text-[#FDB927]' : 'text-white'}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            In Hardwood, gold you don&apos;t spend earns interest (+1 for every 10G saved, up to +5 a round). That turns each round
            into the same question with one more option: spend now or later.
          </p>
        </Lesson>
      )}
    </div>
  )
}

// ── Station 3: Cut the lanes ─────────────────────────────────────

export function CutLanesStation({ puzzle, finished, onAttempt, onDone }: StationProps<CutLanes>) {
  const minKeys = useMemo(() => new Set(puzzle.minCut.map((e) => edgeKey(e.a, e.b))), [puzzle])
  const [cut, setCut] = useState<Set<EdgeKey>>(() => (finished ? new Set(minKeys) : new Set()))
  const [verdict, setVerdict] = useState<ReturnType<typeof checkCut> | null>(null)
  const [open, setOpen] = useState(finished)
  const { level } = puzzle
  const pos = useMemo(() => new Map(level.nodes.map((n) => [n.id, n])), [level])
  const [from, to] = level.terminals

  const toggle = (k: EdgeKey) => {
    if (open) return
    setVerdict(null)
    setCut((c) => {
      const next = new Set(c)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  const check = () => {
    const v = checkCut(puzzle, cut)
    setVerdict(v)
    onAttempt(v.ok)
    if (v.ok) {
      setOpen(true)
      onDone('solved')
    }
  }
  const reveal = () => {
    setCut(new Set(minKeys))
    setVerdict(null)
    setOpen(true)
    onDone('shown')
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-200">
        From Pass &amp; Cut, <em>{level.title}</em>. You&apos;re on defense. Tap passing lanes to cut them so the ball{' '}
        <strong className="text-white">can&apos;t get from {from} to {to}</strong>, using the{' '}
        <strong className="text-white">fewest cuts possible</strong>.
      </p>
      <svg viewBox="0 0 100 100" className="mx-auto mt-4 block w-full max-w-[22rem] touch-manipulation" role="group" aria-label="Passing lanes">
        <rect x="1" y="1" width="98" height="98" rx="4" fill="#1a1530" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
        <path d="M30 99 V70 H70 V99" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
        <circle cx="50" cy="93" r="2.4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
        {puzzle.edges.map((e) => {
          const k = edgeKey(e.a, e.b)
          const a = pos.get(e.a)!
          const b = pos.get(e.b)!
          const isCut = cut.has(k)
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          return (
            <g key={k}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isCut ? '#fb7185' : 'rgba(255,255,255,0.75)'}
                strokeWidth={1.4}
                strokeDasharray={isCut ? '2 2' : undefined}
              />
              {isCut && (
                <text x={mx} y={my + 1.6} textAnchor="middle" fontSize="5" fill="#fb7185" fontWeight="bold">
                  ✕
                </text>
              )}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={9}
                className={open ? '' : 'cursor-pointer'}
                role="button"
                tabIndex={open ? -1 : 0}
                aria-pressed={isCut}
                aria-label={`Lane ${e.a} to ${e.b}${isCut ? ', cut' : ''}`}
                onClick={() => toggle(k)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    toggle(k)
                  }
                }}
              />
            </g>
          )
        })}
        {level.nodes.map((n) => {
          const terminal = n.id === from || n.id === to
          return (
            <g key={n.id} pointerEvents="none">
              <circle cx={n.x} cy={n.y} r={5.2} fill={terminal ? GOLD : PURPLE} stroke="#0b0a14" strokeWidth={0.8} />
              <text x={n.x} y={n.y + 1.6} textAnchor="middle" fontSize="4.2" fontWeight="bold" fill={terminal ? '#0b0a14' : '#fff'}>
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm text-white">
          {cut.size} {cut.size === 1 ? 'cut' : 'cuts'}
        </p>
        {!open && (
          <PrimaryButton onClick={check} disabled={cut.size === 0}>
            Lock the defense
          </PrimaryButton>
        )}
      </div>
      {verdict && !verdict.ok && verdict.reason === 'open' && (
        <Feedback tone="miss">The ball still gets through. Trace any open path from {from} to {to} and cut one lane on it.</Feedback>
      )}
      {verdict && !verdict.ok && verdict.reason === 'extra' && (
        <Feedback tone="miss">
          That stops them with {verdict.size} cuts, but it can be done with fewer. Look for the narrowest point every path has to
          pass through.
        </Feedback>
      )}
      {verdict && !verdict.ok && <ShowMe onClick={reveal} />}
      {open && (
        <Lesson title="Graph theory: minimum cut">
          <p>
            Players are <strong className="text-white">nodes</strong>, passing lanes are <strong className="text-white">edges</strong>.
            The fewest edges whose removal separates {from} from {to} is the <strong className="text-white">minimum cut</strong>, here{' '}
            {puzzle.minCut.length}.
          </p>
          <p>
            Menger&apos;s theorem says that number equals the most passing routes from {from} to {to} that share no lane. The
            offense needs only one route that survives, so every separate route is one more cut you&apos;re forced to spend. The same
            idea, max-flow equals min-cut, sizes networks and pipelines.
          </p>
          <p>
            In Pass &amp; Cut you take turns: the offense secures a lane, you cut one. A board whose min cut is bigger than the
            moves you get is a board the defense can&apos;t win.
          </p>
        </Lesson>
      )}
    </div>
  )
}

// ── Station 4: Read the defense ──────────────────────────────────

export function ReadDefenseStation({ puzzle, finished, onAttempt, onDone }: StationProps<ReadDefense>) {
  const [picked, setPicked] = useState<number | null>(finished ? puzzle.answer : null)
  const [open, setOpen] = useState(finished)
  const { level, matrix, mix, expected } = puzzle

  const choose = (i: number) => {
    if (open) return
    setPicked(i)
    const correct = i === puzzle.answer
    onAttempt(correct)
    if (correct) {
      setOpen(true)
      onDone('solved')
    }
  }
  const reveal = () => {
    setPicked(puzzle.answer)
    setOpen(true)
    onDone('shown')
  }
  const missed = picked !== null && picked !== puzzle.answer && !open

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-200">
        From Read &amp; React, <em>{level.title}</em>. Each cell is <strong className="text-white">points per trip</strong> for a
        play against a coverage. The scouting report says how often they call each coverage.{' '}
        <strong className="text-white">Which play scores the most on average?</strong>
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[18rem] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="text-left font-mono text-xs font-normal text-ink-400">play ╲ coverage</th>
              {level.schemes.map((s, j) => (
                <th key={s.id} className="rounded-lg bg-[#552583]/40 px-2 py-1.5 text-center font-semibold text-white">
                  {s.label}
                  <span className="block font-mono text-xs font-normal" style={{ color: GOLD }}>
                    {pct(mix[j])} of trips
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {level.plays.map((p, i) => (
              <tr key={p.id}>
                <th scope="row" className="pr-2 text-left font-semibold text-white">
                  {p.label}
                </th>
                {matrix[i].map((v, j) => (
                  <td key={j} className="rounded-lg bg-white/5 px-2 py-1.5 text-center font-mono text-white">
                    {fix2(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {level.plays.map((p, i) => {
          const isAnswer = open && i === puzzle.answer
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={picked === i}
              disabled={open}
              className={`min-h-[44px] rounded-full border-2 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                isAnswer ? 'border-[#FDB927] bg-[#FDB927]/15' : picked === i ? 'border-rose-400/70 bg-rose-400/10' : 'border-white/20 bg-white/5 hover:border-white/50'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      {missed && picked !== null && (
        <Feedback tone="miss">
          Not quite. {level.plays[picked].label} averages {fix2(expected[picked])} points a trip. Weight each cell in its row by how
          often that coverage comes, then add the row up.
        </Feedback>
      )}
      {missed && <ShowMe onClick={reveal} />}
      {open && (
        <Lesson title="Linear algebra: a matrix times a vector">
          <p>
            Write the scouting report as a vector <span className="font-mono text-white">x = ({mix.map(fix2).join(', ')})</span>.
            Each play&apos;s average is its row dotted with x, and doing every row at once is the product A·x:
          </p>
          <ul className="space-y-1 font-mono text-xs">
            {level.plays.map((p, i) => (
              <li key={p.id} className={i === puzzle.answer ? 'text-[#FDB927]' : 'text-ink-200'}>
                {p.label}: {matrix[i].map((v, j) => `${fix2(v)}×${fix2(mix[j])}`).join(' + ')} = {fix2(expected[i])}
              </li>
            ))}
          </ul>
          <p>
            This only works because you know their mix. In Read &amp; React the defense adapts, and the answer is a mix of your own
            that no coverage can punish. In Hardwood you pick an offense and a coverage before every fight: the same matrix, from both
            sides.
          </p>
        </Lesson>
      )}
    </div>
  )
}
