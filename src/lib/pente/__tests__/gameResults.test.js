/**
 * Coverage for logGameResult — the fire-and-forget client helper that posts a
 * completed game to /api/pente/game-result. It must never throw and must no-op
 * when there's no player_id or no browser environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logGameResult } from '../gameResults'

describe('logGameResult', () => {
  const hadWindow = 'window' in globalThis

  beforeEach(() => {
    globalThis.window = {}
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.fetch
    if (!hadWindow) delete globalThis.window
  })

  it('does not call fetch when player_id is missing', () => {
    logGameResult({ opponent_type: 'bot' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('does not call fetch when payload is undefined', () => {
    logGameResult(undefined)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('POSTs the payload to the game-result endpoint when valid', () => {
    logGameResult({ player_id: 'p-1', winner: 'p-1' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/api/pente/game-result')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toMatchObject({ player_id: 'p-1', winner: 'p-1' })
  })

  it('never throws even if fetch itself throws synchronously', () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('network down')
    })
    expect(() => logGameResult({ player_id: 'p-1' })).not.toThrow()
  })

  it('does not throw when window is undefined (SSR guard)', () => {
    delete globalThis.window
    expect(() => logGameResult({ player_id: 'p-1' })).not.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
