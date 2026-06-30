import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from 'src/lib/analytics'

const FLAG_KEY = 'pente_tip_shown'
const VISIBLE_MS = 5000

/**
 * One-shot "keep the puzzles free" tip banner shown after a successful solve.
 *
 * - Auto-dismisses after 5s, and is manually dismissable.
 * - Appears at most once per browser (guarded by the `pente_tip_shown`
 *   localStorage flag), so it nudges without nagging.
 * - Fires `cta_impression` when it shows and `cta_click` when the funding link
 *   is followed, both tagged with `location` so the funnel is measurable.
 *
 * `trigger` is a monotonically increasing counter — bump it once per solve to
 * arm the banner. The localStorage flag keeps it a single lifetime show even as
 * the counter keeps climbing.
 */
export default function PostSolveTip({
  trigger,
  page = '/posts/pente-puzzles',
  location = 'pente_post_solve_tip',
  label = 'Enjoying the puzzles? Keep them free →',
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const lastTrigger = useRef(0)

  useEffect(() => {
    if (!trigger || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return
      localStorage.setItem(FLAG_KEY, '1')
    } catch {
      // Storage blocked (private mode) — still show once this mount.
    }
    setVisible(true)
    track('cta_impression', { page, metadata: { location } })
    timerRef.current = setTimeout(() => setVisible(false), VISIBLE_MS)
  }, [trigger, page, location])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!visible) return null

  const dismiss = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-candy-500/30 bg-forest-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur">
        <Link
          href="/funding"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('cta_click', { page, metadata: { location } })}
          className="text-sm font-medium text-candy-300 hover:text-candy-200 transition-colors"
        >
          {label}
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-forest-500 hover:text-forest-300 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
