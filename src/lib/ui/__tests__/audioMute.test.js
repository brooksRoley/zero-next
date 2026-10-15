// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAudioContext, isMuted, MUTE_KEY, resetAudioForTests, setMuted, subscribeMuted } from 'src/lib/ui/audioContext'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

class FakeContext {
  state = 'running'
  resume = vi.fn(() => Promise.resolve())
  suspend = vi.fn(() => Promise.resolve())
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
  window.AudioContext = FakeContext
  resetAudioForTests()
})

describe('site-wide mute', () => {
  it('starts with sound on', () => {
    expect(isMuted()).toBe(false)
    expect(getAudioContext()).toBeInstanceOf(FakeContext)
  })

  it('silences every game: no context is handed out while muted', () => {
    const ctx = getAudioContext()
    setMuted(true)
    expect(getAudioContext()).toBeNull()
    expect(ctx.suspend).toHaveBeenCalled()
    setMuted(false)
    expect(getAudioContext()).toBe(ctx)
  })

  it('remembers the choice across visits', () => {
    setMuted(true)
    expect(window.localStorage.getItem(MUTE_KEY)).toBe('1')
    resetAudioForTests()
    expect(isMuted()).toBe(true)
  })

  it('tells every toggle on the page when it changes', () => {
    const a = vi.fn()
    const b = vi.fn()
    subscribeMuted(a)
    const unsubscribe = subscribeMuted(b)
    unsubscribe()
    setMuted(true)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })
})
