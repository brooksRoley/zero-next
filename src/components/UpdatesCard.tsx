import { useEffect, useRef, useState } from 'react'
import { getAnonId, getSessionId, track } from 'src/lib/analytics'

// Off for now (Brooks, 2026-10-23). The tip jar is retired; this short,
// optional sign-up card replaces it. Flip to true when there is something to
// send. Nothing renders until then.
export const UPDATES_CARD_ENABLED = false

const FLAG_KEY = 'updates_card_shown'
const VISIBLE_MS = 12000
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Props = {
  /** Bump once per finished game or solve; the card arms on a change. */
  trigger: number
  /** The page it shows on, recorded with the signup. */
  page: string
}

/**
 * A brief, optional "want a note when something new goes up?" card.
 *
 * - At most once per browser, after a finished game, never on arrival.
 * - Leaves on its own after 12 s unless you're typing in it; "No thanks"
 *   closes it immediately. No second ask.
 * - Posts an `updates_signup` event, which /api/events adds to the
 *   email_signups list under source "updates".
 */
export default function UpdatesCard({ trigger, page }: Props) {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTrigger = useRef(0)

  const hideIn = (ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), ms)
  }

  useEffect(() => {
    if (!UPDATES_CARD_ENABLED || !trigger || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return
      localStorage.setItem(FLAG_KEY, '1')
    } catch {
      // Storage blocked: show once for this visit.
    }
    setVisible(true)
    track('cta_impression', { page, metadata: { location: 'updates_card' } })
    hideIn(VISIBLE_MS)
  }, [trigger, page])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!UPDATES_CARD_ENABLED || !visible) return null

  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim()) || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: getSessionId(),
          anon_id: getAnonId(),
          page,
          event_type: 'updates_signup',
          metadata: { email: email.trim() },
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('done')
      hideIn(3000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
    >
      <div
        onFocus={() => timer.current && clearTimeout(timer.current)}
        className="pointer-events-auto w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur"
      >
        {status === 'done' ? (
          <p className="text-sm text-ink-200">Thanks. That&apos;s all.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <p className="text-sm text-ink-200">
              Want a short note when something new goes up?
            </p>
            <div className="flex gap-2">
              <label htmlFor="updates-email" className="sr-only">Email</label>
              <input
                id="updates-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-sm text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="rounded-md bg-ink-700 px-3 py-1 text-sm text-ink-50 hover:bg-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
              >
                Sign up
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>{status === 'error' ? 'That didn’t go through. Try again?' : 'Only when there’s something new.'}</span>
              <button
                type="button"
                onClick={close}
                className="hover:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
              >
                No thanks
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
