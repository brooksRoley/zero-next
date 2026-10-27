import { PerennialTree } from 'src/components/games/TendPlants'
import {
  byBranch,
  isPermanent,
  PERENNIAL_COPY,
  perennialStage,
  rungLabels,
  unlockedCount,
  type Perennial,
} from 'src/lib/games/tend/perennials'

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** What one perennial's rungs say, as a plain sentence for its label and tooltip. */
export function rungSummary(p: Perennial): string {
  const labels = rungLabels(p)
  return p.dates
    .map((d, i) => `${labels[i]}: ${d === null ? PERENNIAL_COPY.locked : d === '' ? PERENNIAL_COPY.undated : shortDate(d)}`)
    .join('. ')
}

function Node({ p }: { p: Perennial }) {
  const done = isPermanent(p)
  const summary = rungSummary(p)
  return (
    <li className="w-[88px] text-center" title={summary}>
      <svg viewBox="0 0 48 48" width={72} height={72} className="mx-auto" role="img" aria-label={`${p.name}. ${summary}.`}>
        <PerennialTree stage={perennialStage(p)} />
      </svg>
      <p className="mt-1 text-xs font-medium leading-tight text-ink-100">{p.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-400">
        {done ? PERENNIAL_COPY.permanent : `${unlockedCount(p)} of ${p.dates.length}`}
      </p>
      <p aria-hidden className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-ink-500">
        {p.dates.map((d) => (d === null ? '○' : '●')).join('')}
      </p>
    </li>
  )
}

/** The skill tree as perennials: one row per branch, a tree per skill, growing a stage per rung. */
export default function TendPerennials({ perennials }: { perennials: readonly Perennial[] }) {
  if (!perennials.length) return null
  return (
    <section aria-labelledby="tend-perennials" className="mt-8 rounded-xl border border-ink-800 p-4">
      <h2 id="tend-perennials" className="text-lg font-semibold">
        {PERENNIAL_COPY.title}
      </h2>
      <p className="mt-1 max-w-xl text-sm text-ink-400">{PERENNIAL_COPY.intro}</p>
      <div className="mt-4 space-y-5">
        {byBranch(perennials).map(({ branch, nodes }) => {
          const open = nodes.reduce((n, p) => n + unlockedCount(p), 0)
          const total = nodes.reduce((n, p) => n + p.dates.length, 0)
          return (
            <div key={branch}>
              <h3 className="flex items-baseline gap-2 text-sm font-semibold text-ink-200">
                {branch}
                <span className="font-mono text-xs font-normal text-ink-500">
                  {open} of {total} rungs
                </span>
              </h3>
              <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-3 border-b border-ink-800 pb-3">
                {nodes.map((p) => (
                  <Node key={p.id} p={p} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
