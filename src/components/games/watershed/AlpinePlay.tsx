import { useEffect, useState } from 'react'
import {
  ALPINE,
  ALPINE_COPY,
  COAT_COLOR,
  COAT_NAME,
  COATS,
  currentPikas,
  HEAT_LABEL,
  HEATS,
  readRun,
  runCaption,
  share,
  total,
  type AlpinePlay as Play,
  type AlpineRun,
  type Coat,
  type Heat,
  type Pikas,
} from 'src/lib/games/tend/alpine'

type Props = {
  play: Play
  onRun: (heat: Heat) => void
  onRewind: () => void
  onRestart: () => void
}

/** The herd, one small pika per animal, coloured by coat. */
function Herd({ pikas }: { pikas: Pikas }) {
  const animals = COATS.flatMap((c) => Array.from({ length: pikas[c] }, () => c))
  return (
    <svg viewBox="0 0 288 52" className="block h-auto w-full" role="img" aria-label={`${total(pikas)} pikas: ${COATS.filter((c) => pikas[c]).map((c) => `${pikas[c]} ${COAT_NAME[c].toLowerCase()}`).join(', ')}`}>
      {Array.from({ length: ALPINE.maxSize }, (_, i) => {
        const coat = animals[i]
        const x = 12 + (i % 12) * 23.5
        const y = i < 12 ? 14 : 38
        return coat ? (
          <g key={i}>
            <circle cx={x - 5} cy={y - 7} r={3.4} fill={COAT_COLOR[coat]} stroke="#1d2a24" strokeWidth={0.8} />
            <circle cx={x + 5} cy={y - 7} r={3.4} fill={COAT_COLOR[coat]} stroke="#1d2a24" strokeWidth={0.8} />
            <ellipse cx={x} cy={y} rx={8.5} ry={7.5} fill={COAT_COLOR[coat]} stroke="#1d2a24" strokeWidth={0.9} />
            <circle cx={x - 2.6} cy={y - 1} r={0.9} fill="#1d2a24" />
            <circle cx={x + 2.6} cy={y - 1} r={0.9} fill="#1d2a24" />
          </g>
        ) : (
          <ellipse key={i} cx={x} cy={y} rx={8.5} ry={7.5} fill="none" stroke="#2a4636" strokeDasharray="2 3" />
        )
      })}
    </svg>
  )
}

/** Each coat's share of the herd across the last run, stacked to 100%. */
function Shares({ run }: { run: AlpineRun }) {
  const W = 280
  const H = 70
  const x = (g: number) => 8 + (g / ALPINE.generations) * (W - 16)
  let below = run.history.map(() => 0)
  const bands = COATS.filter((c) => run.history.some((p) => p[c] > 0)).map((c) => {
    const lower = below
    const upper = run.history.map((p, g) => lower[g] + share(p, c))
    below = upper
    const top = upper.map((v, g) => `${g ? 'L' : 'M'}${x(g).toFixed(1)} ${(4 + (1 - v) * (H - 14)).toFixed(1)}`).join('')
    const bottom = lower
      .map((v, g) => [g, v] as const)
      .reverse()
      .map(([g, v]) => `L${x(g).toFixed(1)} ${(4 + (1 - v) * (H - 14)).toFixed(1)}`)
      .join('')
    return <path key={c} d={`${top}${bottom}Z`} fill={COAT_COLOR[c]} opacity={0.85} />
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Each coat's share of the pikas over the last 20 generations">
      {bands}
      <text x={8} y={H - 1} fontSize={8} fill="#8fa89a">gen 0</text>
      <text x={W - 8} y={H - 1} fontSize={8} fill="#8fa89a" textAnchor="end">gen {ALPINE.generations}</text>
    </svg>
  )
}

/**
 * The alpine tier's pikas: set the summer, run twenty generations, and watch
 * which coats spread. New coats arrive by chance; the player only sets the heat.
 */
export default function AlpinePlay({ play, onRun, onRewind, onRestart }: Props) {
  const [heat, setHeat] = useState<Heat>(play.heat)
  useEffect(() => setHeat(play.heat), [play.heat, play.runs.length])

  const pikas = currentPikas(play)
  const last = play.runs.at(-1)
  const read = last ? readRun(last) : null
  const event = read?.lost ? ALPINE_COPY.lost : read?.declined ? ALPINE_COPY.declined : read?.spread ? ALPINE_COPY.spread : null
  const present = COATS.filter((c: Coat) => pikas[c] > 0)

  return (
    <section className="rounded-xl border border-forest-700 bg-forest-900/40 p-4 text-sm" aria-labelledby="alpine-play">
      <h3 id="alpine-play" className="font-semibold text-forest-100">
        Watch the pikas{play.runs.length ? `: generation ${play.runs.length * ALPINE.generations}` : ''}
      </h3>
      <p className="mt-1 text-forest-300">{ALPINE_COPY.rule}</p>

      <div className="mt-3">
        <Herd pikas={pikas} />
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-forest-300">
          {present.map((c) => (
            <li key={c} className="flex items-center gap-1">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COAT_COLOR[c] }} />
              {COAT_NAME[c]} {Math.round(share(pikas, c) * 100)}%
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs text-forest-300">This summer</legend>
        <div role="radiogroup" aria-label="Summer heat" className="mt-1.5 grid grid-cols-5 gap-1">
          {HEATS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={heat === h}
              onClick={() => setHeat(h)}
              className={`rounded-md border px-1 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                heat === h ? 'border-forest-300 bg-forest-200 font-medium text-forest-950' : 'border-forest-700 text-forest-300 hover:bg-forest-800'
              }`}
            >
              {HEAT_LABEL[h]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onRun(heat)}
          disabled={total(pikas) === 0}
          className="rounded-lg bg-forest-200 px-4 py-2 text-sm font-semibold text-forest-950 transition-colors hover:bg-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
        >
          Run {ALPINE.generations} generations
        </button>
        {last && (
          <button type="button" onClick={onRewind} className="rounded-lg border border-forest-700 px-3 py-2 text-xs text-forest-300 hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300">
            Rewind
          </button>
        )}
        {total(pikas) < 6 && (
          <button type="button" onClick={onRestart} className="rounded-lg border border-forest-700 px-3 py-2 text-xs text-forest-300 hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300">
            Start a new slope
          </button>
        )}
      </div>

      {last && (
        <div className="mt-4 rounded-lg border border-forest-800 p-3" aria-live="polite">
          <p className="font-mono text-xs text-forest-200">{runCaption(last)}</p>
          {event && <p className="mt-1 text-sm text-forest-100">{event}</p>}
          <div className="mt-2">
            <Shares run={last} />
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-forest-500">
        {ALPINE_COPY.honest}{' '}
        <a href={ALPINE_COPY.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-forest-300">
          {ALPINE_COPY.source.label}
        </a>
      </p>
    </section>
  )
}
