// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  JOURNAL_KEY, emptyJournal, loadJournal, noteGameEvent, parseJournal, recordGameEvent, saveJournal, touch,
} from 'src/lib/playJournal'
import { trackGame } from 'src/lib/analytics'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const T0 = new Date('2026-10-20T18:00:00Z')
const T1 = new Date('2026-10-22T09:30:00Z')

describe('recordGameEvent', () => {
  it('counts plays, results, puzzles and stages per game', () => {
    let j = emptyJournal(T0)
    j = recordGameEvent(j, 'game_start', 'nanu-pika-td', { level: 1 }, T0)
    j = recordGameEvent(j, 'game_end', 'nanu-pika-td', { level: 1, result: 'win', score: 900 }, T1)
    j = recordGameEvent(j, 'puzzle_solved', 'go', { puzzle_id: 'capture-pair' }, T0)
    j = recordGameEvent(j, 'puzzle_failed', 'go', { puzzle_id: 'capture-edge' }, T0)
    j = recordGameEvent(j, 'tutorial_stage_complete', 'tend-watershed', { stage: 2 }, T0)
    expect(j.games['nanu-pika-td']).toMatchObject({ plays: 1, wins: 1, losses: 0, lastPlayed: T1.toISOString() })
    expect(j.games['nanu-pika-td'].last).toEqual({ event: 'game_end', at: T1.toISOString(), meta: { level: 1, result: 'win', score: 900 } })
    expect(j.games.go).toMatchObject({ solved: 1, failed: 1 })
    expect(j.games['tend-watershed'].stages).toBe(1)
    expect(j.lastActive).toBe(T0.toISOString())
  })

  it('keeps only short scalar metadata', () => {
    const j = recordGameEvent(emptyJournal(T0), 'game_end', 'pente', {
      result: 'loss', moves: [[1, 2]], note: 'x'.repeat(200), nested: { a: 1 }, game: 'pente', ok: true,
    }, T0)
    expect(j.games.pente.last?.meta).toEqual({ result: 'loss', ok: true })
  })

  it('touch moves the clock without inventing play', () => {
    const j = touch(emptyJournal(T0), T1)
    expect(j.lastActive).toBe(T1.toISOString())
    expect(j.games).toEqual({})
  })
})

describe('storage', () => {
  it('round-trips, and a malformed save reads as no journal', () => {
    const storage = memoryStorage()
    const j = recordGameEvent(emptyJournal(T0), 'game_start', 'go', {}, T0)
    saveJournal(storage, j)
    expect(loadJournal(storage)).toEqual(j)
    storage.setItem(JOURNAL_KEY, '{nope')
    expect(loadJournal(storage)).toBeNull()
    expect(parseJournal({ version: 2 })).toBeNull()
  })

  it('drops a corrupted game entry and keeps the rest', () => {
    const good = recordGameEvent(emptyJournal(T0), 'game_start', 'go', {}, T0)
    const parsed = parseJournal({ ...good, games: { ...good.games, broken: { plays: -1 } } })
    expect(Object.keys(parsed!.games)).toEqual(['go'])
  })
})

describe('trackGame writes the journal', () => {
  let storage: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', memoryStorage())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('every shared game event lands in the journal as well as analytics', () => {
    trackGame('game_start', 'read-and-react', { level: 'pick-your-poison' })
    trackGame('game_end', 'read-and-react', { level: 'pick-your-poison', result: 'win' })
    const j = loadJournal(storage)!
    expect(j.games['read-and-react']).toMatchObject({ plays: 1, wins: 1 })
  })

  it('noteGameEvent is a no-op without storage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => noteGameEvent('game_start', 'go', {})).not.toThrow()
  })
})
