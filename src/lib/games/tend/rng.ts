/**
 * A small seeded random number generator (mulberry32), so every random event
 * in Tend's simulations replays exactly from its seed. Tests rely on this.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mix two numbers into a new seed, for "the n-th run from this seed". */
export const mixSeed = (seed: number, n: number) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0
