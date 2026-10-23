import React from 'react'
import Link from 'next/link'
import { INTERVAL_DAYS } from 'src/lib/review'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "Due for review": puzzles you missed, brought back on a spaced schedule
 * (src/lib/review.ts). Renders nothing when nothing is in review, so a new
 * player's page is unchanged. Each item either links (`href`) or calls `onOpen`.
 *
 * @param {{
 *   items: { id: string, title: string, detail?: string, href?: string, onOpen?: () => void }[],
 *   nextDueAt: number | null,
 *   now: number,
 * }} props
 */
export default function ReviewLane({ items, nextDueAt, now }) {
  if (items.length === 0 && nextDueAt === null) return null

  const schedule = INTERVAL_DAYS.join(', ')
  if (items.length === 0) {
    const days = Math.max(1, Math.ceil((nextDueAt - now) / DAY_MS))
    return (
      <p className="mb-5 text-xs text-ink-400">
        Review is clear. The next missed puzzle comes back in {days} day{days === 1 ? '' : 's'}.
      </p>
    )
  }

  const itemClass =
    'flex w-full items-center justify-between gap-3 rounded-lg border border-ink-700/60 bg-ink-950/40 px-3 py-2 text-left transition-colors hover:border-brass-400/50'

  return (
    <section aria-label="Due for review" className="mb-6 rounded-xl border border-brass-400/30 bg-ink-900/60 p-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Due for review</h2>
        <span className="font-mono text-[11px] text-brass-300">{items.length} ready</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        Puzzles you missed come back after {schedule} days. Solve one when it&rsquo;s due and it waits longer
        next time; miss it and it starts over.
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const body = (
            <>
              <span className="text-sm text-ink-100">{item.title}</span>
              {item.detail && <span className="shrink-0 font-mono text-[11px] text-ink-500">{item.detail}</span>}
            </>
          )
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className={itemClass}>{body}</Link>
              ) : (
                <button type="button" onClick={item.onOpen} className={itemClass}>{body}</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
