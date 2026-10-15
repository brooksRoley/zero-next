// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, cleanup } from '@testing-library/react'
import TendPets from 'src/components/games/TendPets'
import { newGarden } from 'src/lib/games/tend/engine'

vi.mock('src/lib/games/tend/sounds', () => ({ tendSounds: { pet: vi.fn() } }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const zs = (c: HTMLElement) => [...c.querySelectorAll('text')].filter((t) => t.textContent === 'z').length

describe('TendPets at night', () => {
  it('a pet that hops toward a new bed goes back to sleep afterwards', () => {
    vi.useFakeTimers()
    const garden = newGarden(100)
    const { container, rerender } = render(
      <svg>
        <TendPets garden={garden} inert={false} asleep />
      </svg>,
    )
    expect(zs(container)).toBe(3)
    rerender(
      <svg>
        <TendPets garden={garden} inert={false} asleep attention={{ cell: [0, 0], n: 1 }} />
      </svg>,
    )
    expect(zs(container)).toBe(2)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(zs(container)).toBe(3)
  })
})
