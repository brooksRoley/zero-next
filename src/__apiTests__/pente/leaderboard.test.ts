/**
 * The leaderboard used to return every player's id — the only key to a
 * profile — so anyone could overwrite any player through /api/pente/player.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ROWS = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Ada', elo: 1500, peak_elo: 1550, puzzles_solved: 40 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: '', elo: 900, peak_elo: 900, puzzles_solved: 2 },
]
vi.mock('src/lib/supabase', () => {
  const chain: any = {}
  for (const m of ['select', 'gt', 'order']) chain[m] = () => chain
  chain.limit = () => Promise.resolve({ data: ROWS, error: null })
  return { supabase: { from: () => chain } }
})

function res(): any {
  const r: any = { _status: 200, _json: null, setHeader: () => r }
  r.status = (c: number) => ((r._status = c), r)
  r.json = (d: unknown) => ((r._json = d), r)
  return r
}

describe('/api/pente/leaderboard', () => {
  let handler: any
  beforeEach(async () => {
    handler = (await import('src/pages/api/pente/leaderboard')).default
  })

  it('never returns player ids', async () => {
    const r = res()
    await handler({ method: 'GET', query: {} }, r)
    expect(r._status).toBe(200)
    expect(JSON.stringify(r._json)).not.toContain('aaaaaaaa')
    expect(r._json.leaderboard.every((p: any) => p.is_you === false)).toBe(true)
  })

  it("flags the viewer's own row from ?me=", async () => {
    const r = res()
    await handler({ method: 'GET', query: { me: ROWS[1].id } }, r)
    expect(r._json.leaderboard.map((p: any) => p.is_you)).toEqual([false, true])
  })
})
