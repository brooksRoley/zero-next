// @vitest-environment jsdom
import React, { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import useGoPlayerProfile from 'src/hooks/useGoPlayerProfile'

// A plain in-memory Storage: this jsdom build does not provide a usable localStorage.
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const attemptPosts = (fetchMock) =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/go/puzzle-attempts')

describe('useGoPlayerProfile.recordAttempt', () => {
  let fetchMock

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    // The sync effect sees a 404 (new player) and pushes the profile up.
    fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // React runs state updaters twice under StrictMode. The attempt insert used to
  // live inside one, so every Go puzzle attempt was written to Supabase twice.
  it('posts one attempt per call under StrictMode', async () => {
    const { result } = renderHook(() => useGoPlayerProfile(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.ready).toBe(true))

    let outcome
    act(() => {
      outcome = result.current.recordAttempt({
        puzzleId: 'capture-pair', puzzleRating: 1050, solved: true, usedHint: false, solveTimeMs: 4000,
      })
    })

    expect(attemptPosts(fetchMock)).toHaveLength(1)
    const body = JSON.parse(attemptPosts(fetchMock)[0][1].body)
    expect(body).toMatchObject({ puzzle_id: 'capture-pair', solved: true, elo_before: 1000 })
    expect(outcome.eloAfter).toBeGreaterThan(1000)
    expect(body.elo_after).toBe(outcome.eloAfter)
    expect(result.current.goElo).toBe(outcome.eloAfter)
    expect(result.current.solved.has('capture-pair')).toBe(true)
  })

  it('takes the shared player id and uploads the local profile under it', async () => {
    const pente = '11111111-1111-4111-8111-111111111111'
    localStorage.setItem('pente_player_id', pente)
    localStorage.setItem('go.profile.v2', JSON.stringify({
      playerId: '22222222-2222-4222-8222-222222222222', goElo: 1234, peakElo: 1300, solved: ['capture-pair'],
    }))

    const { result } = renderHook(() => useGoPlayerProfile(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.synced).toBe(true))

    expect(result.current.playerId).toBe(pente)
    expect(result.current.goElo).toBe(1234)
    const upload = fetchMock.mock.calls.find(([url, init]) => url === '/api/go/player' && init?.method === 'POST')
    expect(JSON.parse(upload[1].body)).toMatchObject({ id: pente })
  })

  it('chains two attempts made before a re-render', async () => {
    const { result } = renderHook(() => useGoPlayerProfile(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.ready).toBe(true))

    let first, second
    act(() => {
      first = result.current.recordAttempt({ puzzleId: 'a', puzzleRating: 1050, solved: true })
      second = result.current.recordAttempt({ puzzleId: 'b', puzzleRating: 1050, solved: true })
    })

    expect(attemptPosts(fetchMock)).toHaveLength(2)
    expect(second.eloBefore).toBe(first.eloAfter)
    expect(result.current.goElo).toBe(second.eloAfter)
  })
})
