import { describe, expect, it } from 'vitest'
import { MAX_LOSS_DAMAGE, MIN_LOSS_DAMAGE, lossDamage } from 'src/lib/bballDamage'

describe('lossDamage (Hardwood HP per lost round)', () => {
  it('scales with the margin: 8 for one point, 2 more per point, capped at 20', () => {
    expect(lossDamage(1, false)).toBe(8)
    expect(lossDamage(2, false)).toBe(10)
    expect(lossDamage(4, false)).toBe(14)
    expect(lossDamage(6, false)).toBe(18)
    expect(lossDamage(7, false)).toBe(MAX_LOSS_DAMAGE)
    expect(lossDamage(99, false)).toBe(MAX_LOSS_DAMAGE)
  })

  it('charges the minimum for an overtime loss or a tie that counts as a loss', () => {
    expect(lossDamage(3, true)).toBe(MIN_LOSS_DAMAGE)
    expect(lossDamage(0, false)).toBe(MIN_LOSS_DAMAGE)
    expect(lossDamage(-4, false)).toBe(MIN_LOSS_DAMAGE)
  })

  it('falls back to the old flat 20 when an older client sends no margin', () => {
    expect(lossDamage(undefined, undefined)).toBe(20)
    expect(lossDamage('5', false)).toBe(20)
    expect(lossDamage(2.5, false)).toBe(20)
  })
})
