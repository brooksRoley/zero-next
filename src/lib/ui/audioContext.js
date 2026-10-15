// One AudioContext for the whole app. Multiple hook instances can share it
// instead of each opening its own — browsers cap context count anyway, and a
// single context guarantees consistent timing across components.
//
// The site-wide mute lives here too, so one switch silences every game: while
// muted, getAudioContext() returns null and every sound helper does nothing.

export const MUTE_KEY = 'site_sound_muted'

let ctx = null
let muted = null
const listeners = new Set()

function readMuted() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted() {
  if (muted === null) muted = readMuted()
  return muted
}

export function setMuted(value) {
  muted = Boolean(value)
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* storage blocked: the choice still holds for this visit */
  }
  // Suspending also cuts off any sound that is still ringing.
  if (ctx) (muted ? ctx.suspend() : ctx.resume()).catch(() => {})
  listeners.forEach((fn) => fn())
}

export function subscribeMuted(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getAudioContext() {
  if (typeof window === 'undefined' || isMuted()) return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') {
    // Browsers suspend until first user gesture. Resuming here is safe —
    // it's a no-op unless a gesture has already unlocked the context.
    ctx.resume().catch(() => {})
  }
  return ctx
}

/** Test hook: forget the context and the cached mute choice. */
export function resetAudioForTests() {
  ctx = null
  muted = null
  listeners.clear()
}
