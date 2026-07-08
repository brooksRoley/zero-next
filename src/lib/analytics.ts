/**
 * First-party analytics client. Single source of truth for the session id and
 * the POST to /api/events, shared by _app.tsx (global page_view), the consulting
 * funnel, and the games. Before this existed the session-id + fetch logic was
 * copy-pasted in three places with the same `br_session_id` key.
 *
 * Page views are fired globally from _app.tsx — do NOT call track('page_view')
 * from individual pages or you'll double-count every view.
 */

const SESSION_ID_KEY = 'br_session_id'
const ANON_ID_KEY = 'br_anon_id'

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Stable per-tab id, persisted in sessionStorage. Null when storage is blocked
 *  (private mode) or during SSR — the event still records, just unattributed. */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = newId()
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** Durable anonymous visitor id, persisted in localStorage — survives across
 *  tabs and return visits, unlike the per-tab session id. Used to stitch
 *  sessions together and to opportunistically join to players.id / leads.email
 *  when either is created. Null when storage is blocked or during SSR. */
export function getAnonId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = localStorage.getItem(ANON_ID_KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(ANON_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

type TrackOptions = {
  /** Logical page for this event. Defaults to the current pathname. */
  page?: string
  metadata?: Record<string, unknown>
  /** Use sendBeacon (survives the page unload that follows external nav like
   *  Calendly). Falls back to fetch+keepalive. Off by default. */
  beacon?: boolean
}

/** Fire a first-party analytics event. Best-effort: never throws, never blocks
 *  navigation. No-op during SSR. */
export function track(eventType: string, options: TrackOptions = {}): void {
  if (typeof window === 'undefined') return
  const { page, metadata = {}, beacon = false } = options
  const body = JSON.stringify({
    session_id: getSessionId(),
    anon_id: getAnonId(),
    page: page ?? window.location.pathname,
    event_type: eventType,
    metadata,
  })

  if (beacon) {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
        return
      }
    } catch {
      /* fall through to fetch */
    }
  }

  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics must never break the page */
  })
}
