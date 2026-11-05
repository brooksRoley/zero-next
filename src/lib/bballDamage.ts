// HP lost for a Hardwood round, scaled by how much the round was lost by.
// Mirrors hpLoss() in BballTactics client/game/economy.js; keep the two in step.
// A 1-point loss costs 8, each extra point 2 more, capped at 20. A sudden-death
// overtime loss costs the minimum. A missing or invalid margin falls back to the
// old flat 20, so an older client keeps working. The margin comes from the
// client (like `result` already does); the 20 cap bounds what a forged one can do.

export const MIN_LOSS_DAMAGE = 8
export const MAX_LOSS_DAMAGE = 20

export function lossDamage(margin: unknown, overtime: unknown): number {
  if (overtime === true) return MIN_LOSS_DAMAGE
  if (typeof margin !== 'number' || !Number.isInteger(margin)) return MAX_LOSS_DAMAGE
  return Math.min(MAX_LOSS_DAMAGE, MIN_LOSS_DAMAGE + 2 * (Math.max(1, margin) - 1))
}
