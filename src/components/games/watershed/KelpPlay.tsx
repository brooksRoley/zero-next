import { useEffect, useRef, useState } from 'react'
import {
  currentForest,
  KELP_COPY,
  leverage,
  MAX_NUDGES,
  NOTCH_LABEL,
  NOTCHES,
  ripple,
  rippleCaption,
  runYear,
  shown,
  SPECIES,
  SPECIES_NAME,
  type Kelp,
  type KelpPlay as Play,
  type Protection,
  type Species,
} from 'src/lib/games/tend/kelp'
import type { SpriteId } from 'src/lib/games/tend/watershed'
import { Sprite } from './Sprites'

const SPRITE: Record<Species, SpriteId> = { otters: 'otter', urchins: 'urchin', kelp: 'kelp' }
const MONTH_MS = 250

type Props = {
  play: Play
  /** The sample: nudges never run out, and nothing is saved. */
  unlimited: boolean
  still: boolean
  onRun: (to: Protection) => void
  onRewind: () => void
}

/** A row of up to nine small sprites: the population as you can count it. */
function Row({ species, value }: { species: Species; value: number }) {
  const n = shown(value)
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-ink-300">{SPECIES_NAME[species]}</span>
      <svg viewBox="0 0 270 30" className="h-7 w-full max-w-[270px]" role="img" aria-label={`${SPECIES_NAME[species]}: ${n} of 9`}>
        {Array.from({ length: 9 }, (_, i) => (
          <svg key={i} x={i * 30} y={0} width={30} height={30} viewBox="0 0 40 40" overflow="visible" opacity={i < n ? 1 : 0.12}>
            <Sprite id={SPRITE[species]} />
          </svg>
        ))}
      </svg>
      <span className="w-4 shrink-0 text-right font-mono text-xs text-ink-300">{n}</span>
    </div>
  )
}

/** Kelp across the year just run, with the year you didn't change dashed behind it. */
function YearLine({ actual, ghost }: { actual: Kelp[]; ghost: Kelp[] }) {
  const x = (i: number) => 8 + (i / 12) * 264
  const y = (v: number) => 52 - (v / 9) * 44
  const line = (months: Kelp[]) => months.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m.kelp).toFixed(1)}`).join('')
  return (
    <svg viewBox="0 0 280 60" className="block h-auto w-full" role="img" aria-label="Kelp through the year, against the year you didn't change">
      <path d={`M8 52H272`} stroke="#2a4636" />
      <path d={line(ghost)} fill="none" stroke="#8fa89a" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
      <path d={line(actual)} fill="none" stroke="#6ea85e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <text x={8} y={59} fontSize={8} fill="#8fa89a">Jan</text>
      <text x={272} y={59} fontSize={8} fill="#8fa89a" textAnchor="end">Dec</text>
    </svg>
  )
}

/**
 * The kelp forest you can play: one lever, a year at a time. Each year shows
 * the chain reaction against the year you didn't change, and how far the
 * whole forest moved for the otters you moved.
 */
export default function KelpPlay({ play, unlimited, still, onRun, onRewind }: Props) {
  const [setting, setSetting] = useState<Protection>(play.protection)
  // While a year plays out: the months, and how far through them we are.
  const [playing, setPlaying] = useState<{ months: Kelp[]; at: number } | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => setSetting(play.protection), [play.protection, play.years.length])
  useEffect(() => () => void (timer.current && window.clearInterval(timer.current)), [])

  const forest = currentForest(play)
  const last = play.years.at(-1)
  const shownForest = playing ? playing.months[playing.at] : forest
  const changed = setting !== play.protection
  const blocked = changed && !unlimited && play.nudges < 1

  const run = () => {
    if (blocked || playing) return
    const months = runYear(forest, setting)
    onRun(setting)
    if (still) return
    setPlaying({ months, at: 0 })
    timer.current = window.setInterval(() => {
      setPlaying((p) => {
        if (!p || p.at >= p.months.length - 1) {
          if (timer.current) window.clearInterval(timer.current)
          return null
        }
        return { ...p, at: p.at + 1 }
      })
    }, MONTH_MS)
  }

  const r = last ? ripple(last.end, last.ghost) : null
  const score = r ? leverage(r) : null
  const state = forest.barren ? KELP_COPY.barren : last?.start.barren ? KELP_COPY.recovered : KELP_COPY.forest

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900/40 p-4 text-sm" aria-labelledby="kelp-play">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="kelp-play" className="font-semibold text-ink-100">
          Play the forest{play.years.length ? `: year ${play.years.length}` : ''}
        </h3>
        <p className="font-mono text-xs text-ink-400" aria-label={unlimited ? 'Unlimited nudges in the sample' : `${play.nudges} of ${MAX_NUDGES} nudges`}>
          {unlimited ? 'nudges: free' : `${'●'.repeat(play.nudges)}${'○'.repeat(MAX_NUDGES - play.nudges)} nudges`}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {SPECIES.map((s) => (
          <Row key={s} species={s} value={shownForest[s]} />
        ))}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs text-ink-300">Otter protection</legend>
        <div role="radiogroup" aria-label="Otter protection" className="mt-1.5 grid grid-cols-5 gap-1">
          {NOTCHES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={setting === n}
              disabled={!!playing}
              onClick={() => setSetting(n)}
              className={`rounded-md border px-1 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 ${
                setting === n ? 'border-ink-300 bg-ink-200 font-medium text-ink-950' : 'border-ink-700 text-ink-300 hover:bg-ink-800'
              }`}
            >
              {NOTCH_LABEL[n]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={blocked || !!playing}
          className="rounded-lg bg-ink-200 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
        >
          {playing ? `Month ${playing.at} of 12…` : changed && !unlimited ? 'Run a year (spends a nudge)' : 'Run a year'}
        </button>
        {last && !playing && (
          <button
            type="button"
            onClick={onRewind}
            className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-300 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
          >
            Rewind a year
          </button>
        )}
      </div>
      {blocked && (
        <p className="mt-2 text-xs text-amber-200">
          No nudges left. Each garden check-in earns one (you can hold {MAX_NUDGES}). Running the year unchanged is always free.
        </p>
      )}

      {last && !playing && r && score && (
        <div className="mt-4 rounded-lg border border-ink-800 p-3" aria-live="polite">
          <p className="font-mono text-xs text-ink-200">{rippleCaption(r)}</p>
          {last.protection === last.from ? (
            <p className="mt-1 text-xs text-ink-400">Same lever as last year, so no change against the ghost year.</p>
          ) : score.moved > 0 ? (
            <p className="mt-1 text-sm font-semibold text-ink-100">
              You moved {score.moved}. The forest moved {score.forest}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-100">
              The otters barely moved this year, but the forest moved {score.forest}.
            </p>
          )}
          <div className="mt-2">
            <YearLine actual={runYear(last.start, last.protection)} ghost={runYear(last.start, last.from)} />
            <p className="text-[11px] text-ink-500">{KELP_COPY.ghost}</p>
          </div>
        </div>
      )}

      <p className={`mt-3 leading-relaxed ${forest.barren ? 'text-amber-100' : 'text-ink-300'}`}>{state}</p>
      <p className="mt-2 text-[11px] text-ink-500">
        {KELP_COPY.honest}{' '}
        <a href={KELP_COPY.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-300">
          {KELP_COPY.source.label}
        </a>
      </p>
    </section>
  )
}
