// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const track = vi.fn()
vi.mock('src/lib/analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

import { getPlayerId, PLAYER_ID_KEY, LEGACY_PENTE_ID_KEY, GO_PROFILE_KEY } from 'src/lib/playerId'

// A plain in-memory Storage: this jsdom build does not provide a usable localStorage.
function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const PENTE = '11111111-1111-4111-8111-111111111111'
const GO = '22222222-2222-4222-8222-222222222222'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('getPlayerId', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    track.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('mints one id for a new visitor and keeps returning it', () => {
    const id = getPlayerId()
    expect(id).toMatch(UUID)
    expect(getPlayerId()).toBe(id)
    expect(localStorage.getItem(PLAYER_ID_KEY)).toBe(id)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('identity_link', { metadata: { kind: 'player', player_id: id } })
  })

  it('adopts an existing Pente id so the players row is kept', () => {
    localStorage.setItem(LEGACY_PENTE_ID_KEY, PENTE)
    expect(getPlayerId()).toBe(PENTE)
  })

  it('adopts a Go-only id, stripping the old go- prefix', () => {
    localStorage.setItem(GO_PROFILE_KEY, JSON.stringify({ playerId: `go-${GO}` }))
    expect(getPlayerId()).toBe(GO)
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('prefers Pente over Go and records the Go id it replaces', () => {
    localStorage.setItem(LEGACY_PENTE_ID_KEY, PENTE)
    localStorage.setItem(GO_PROFILE_KEY, JSON.stringify({ playerId: GO }))
    expect(getPlayerId()).toBe(PENTE)
    expect(track).toHaveBeenCalledWith('identity_link', {
      metadata: { kind: 'player_merge', player_id: PENTE, previous_id: GO, game: 'go' },
    })
  })

  it('ignores ids that are not uuids', () => {
    localStorage.setItem(LEGACY_PENTE_ID_KEY, 'not-a-uuid')
    localStorage.setItem(GO_PROFILE_KEY, '{broken json')
    const id = getPlayerId()
    expect(id).toMatch(UUID)
    expect(id).not.toBe('not-a-uuid')
  })

  it('still returns a stable id when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    const id = getPlayerId()
    expect(id).toMatch(UUID)
    expect(getPlayerId()).toBe(id)
  })
})
