// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SoundToggle from 'src/components/SoundToggle'
import { getAudioContext, MUTE_KEY, resetAudioForTests } from 'src/lib/ui/audioContext'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
  resetAudioForTests()
})
afterEach(cleanup)

describe('SoundToggle', () => {
  it('mutes every game at once, and every toggle on the page agrees', () => {
    render(
      <>
        <SoundToggle />
        <SoundToggle />
      </>,
    )
    const [first, second] = screen.getAllByRole('button', { name: 'Mute sound in every game' })
    expect(first.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(first)
    expect(second.getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem(MUTE_KEY)).toBe('1')
    expect(getAudioContext()).toBeNull()

    fireEvent.click(second)
    expect(first.getAttribute('aria-pressed')).toBe('false')
  })
})
