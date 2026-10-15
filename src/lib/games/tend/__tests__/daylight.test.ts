import { describe, it, expect } from 'vitest'
import { currentPhase, phaseAt, phaseOf } from 'src/lib/games/tend/daylight'

describe('the garden clock', () => {
  it.each([
    [0, 'night'],
    [4.9, 'night'],
    [5, 'dawn'],
    [7.4, 'dawn'],
    [12, 'day'],
    [17.5, 'golden'],
    [19.4, 'golden'],
    [19.5, 'night'],
    [23.99, 'night'],
  ])('%s:00 is %s', (hour, phase) => {
    expect(phaseAt(hour as number)).toBe(phase)
  })

  it('reads local time from a date', () => {
    expect(phaseOf(new Date(2026, 9, 15, 21, 30))).toBe('night')
    expect(phaseOf(new Date(2026, 9, 15, 6, 15))).toBe('dawn')
  })

  it('lets ?hour= set the clock outside production', () => {
    expect(currentPhase('?hour=21')).toBe('night')
    expect(currentPhase('?hour=nope')).toBe(phaseOf(new Date()))
  })
})
