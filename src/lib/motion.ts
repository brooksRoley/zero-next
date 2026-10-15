// True when the visitor has asked the OS for less motion. Safe to call during
// SSR or in a browser without matchMedia (returns false: no preference known).
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
