/** A short vibration on phones that support it; silently nothing elsewhere. Strengths live in HAPTIC (tactile.js). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    /* unsupported */
  }
}
