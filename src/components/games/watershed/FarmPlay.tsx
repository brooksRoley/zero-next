import { useEffect, useState } from 'react'
import {
  averageSize,
  currentPlants,
  FARM_COPY,
  farmCaption,
  VARIETY_COLOR,
  varietiesOf,
  type FarmPlay as Play,
  type Plant,
} from 'src/lib/games/tend/farm'

type Props = {
  play: Play
  onPlant: (saved: number[]) => void
  onRewind: () => void
}

/** One tomato plant: leaves, and a fruit that grows with its size. A blighted plant is brown and bare. */
function Tomato({ plant }: { plant: Plant }) {
  const r = 4.5 + plant.size * 1.4
  return (
    <svg viewBox="0 0 48 56" className="mx-auto block h-14 w-12" aria-hidden overflow="visible">
      <path d="M24 54V22" stroke={plant.blighted ? '#7a6243' : '#5b7f45'} strokeWidth={2} />
      {[
        [17, 34, -30],
        [31, 30, 30],
        [18, 24, -40],
      ].map(([x, y, a]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx={6} ry={3} transform={`rotate(${a} ${x} ${y})`} fill={plant.blighted ? '#8a7356' : '#6ea85e'} stroke="#1d2a24" strokeWidth={0.8} />
      ))}
      {!plant.blighted && (
        <g>
          <circle cx={24} cy={22 - r * 0.2} r={r} fill={VARIETY_COLOR[plant.variety]} stroke="#1d2a24" strokeWidth={1} />
          {plant.variety === 'Striped' && <path d={`M${24 - r * 0.6} ${22 - r * 0.2}h${r * 1.2}`} stroke="#ffd166" strokeWidth={1.2} />}
          <path d={`M21 ${22 - r * 1.15}l3 2 3-2`} fill="none" stroke="#4f7a4a" strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

/** Average fruit size, season by season. */
function Trend({ play }: { play: Play }) {
  const points = [averageSize(play.start), ...play.seasons.map((s) => averageSize(s.after))]
  const W = 280
  const H = 56
  const x = (i: number) => 8 + (i / Math.max(1, points.length - 1)) * (W - 16)
  const y = (v: number) => H - 8 - (v / 9) * (H - 16)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Average fruit size by season">
      <path d={`M8 ${H - 8}H${W - 8}`} stroke="#2a4636" />
      <path d={points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')} fill="none" stroke="#ffd166" strokeWidth={2} strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.4} fill="#ffd166" />
      ))}
    </svg>
  )
}

/** The farm: pick which plants to save seed from, and grow the next season. */
export default function FarmPlay({ play, onPlant, onRewind }: Props) {
  const plants = currentPlants(play)
  const [saved, setSaved] = useState<number[]>([])
  useEffect(() => setSaved([]), [play.seasons.length])

  const last = play.seasons.at(-1)
  const alive = plants.filter((p) => !p.blighted)
  const caption = farmCaption(play)
  const toggle = (id: number) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900/40 p-4 text-sm" aria-labelledby="farm-play">
      <h3 id="farm-play" className="font-semibold text-ink-100">
        Save seed{play.seasons.length ? `: season ${play.seasons.length + 1}` : ''}
      </h3>
      <p className="mt-1 text-ink-300">{FARM_COPY.rule}</p>

      <ul className="mt-3 grid grid-cols-4 gap-2">
        {plants.map((p) => {
          const on = saved.includes(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={p.blighted}
                onClick={() => toggle(p.id)}
                aria-label={p.blighted ? `${p.variety}, lost to blight` : `${p.variety}, fruit size ${p.size}${on ? ', saving seed' : ''}`}
                className={`w-full rounded-lg border p-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 disabled:opacity-60 ${
                  on ? 'border-amber-300 bg-amber-500/15' : 'border-ink-800 hover:border-ink-600'
                }`}
              >
                <Tomato plant={p} />
                <span className="block text-[11px] text-ink-300">{p.blighted ? 'blight' : `${p.variety} · ${p.size}`}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPlant(saved)}
          disabled={alive.length > 0 && saved.length === 0}
          className="rounded-lg bg-ink-200 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300"
        >
          {alive.length === 0 ? 'Ask the seed bank for wild seed' : saved.length ? `Grow next season from ${saved.length} saved` : 'Pick plants to save seed from'}
        </button>
        {last && (
          <button type="button" onClick={onRewind} className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-300 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300">
            Rewind a season
          </button>
        )}
      </div>

      {(caption || last) && (
        <div className="mt-4 rounded-lg border border-ink-800 p-3" aria-live="polite">
          {caption && <p className="font-mono text-xs text-ink-200">{caption}</p>}
          {last?.blight && (
            <p className="mt-1 text-amber-100">
              Blight! It struck the {last.blight} variety: {last.after.filter((p) => p.blighted).length} of {last.after.length} plants lost.
            </p>
          )}
          {last?.restocked && <p className="mt-1 text-ink-300">{FARM_COPY.restocked}</p>}
          {varietiesOf(plants) === 1 && <p className="mt-1 text-amber-200">{FARM_COPY.monoculture}</p>}
          {play.seasons.length > 0 && (
            <div className="mt-2">
              <Trend play={play} />
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-500">
        {FARM_COPY.honest}{' '}
        <a href={FARM_COPY.blightSource.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-300">
          {FARM_COPY.blightSource.label}
        </a>
      </p>
    </section>
  )
}
