// One AudioContext for the whole app. Multiple hook instances can share it
// instead of each opening its own — browsers cap context count anyway, and a
// single context guarantees consistent timing across components.

let ctx = null

export function getAudioContext() {
  if (typeof window === 'undefined') return null
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
