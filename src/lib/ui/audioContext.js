// One AudioContext for the whole app. Multiple hook instances can share it
// instead of each opening its own — browsers cap context count anyway, and a
// single context guarantees consistent timing across components.
//
// The site-wide mute lives here too, so one switch silences every game: while
// muted, getAudioContext() returns null and every sound helper does nothing.
// Sound starts OFF (2026-11-04): a visitor turns it on with the speaker toggle,
// and the choice is remembered. Hardwood's own sound also starts muted here.

export const MUTE_KEY = 'site_sound_muted'

let ctx = null
let muted = null
const listeners = new Set()

function readMuted() {
  try {
    // Muted unless this browser has turned sound on.
    return typeof window === 'undefined' || window.localStorage.getItem(MUTE_KEY) !== '0'
  } catch {
    return true
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
