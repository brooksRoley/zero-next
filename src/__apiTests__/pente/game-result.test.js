/**
 * Coverage for the only live DB-write path in the app: POST /api/pente/game-result
 * (Supabase, live since migration 0004 on 2026-07-14, previously untested).
 *
 * The handler reads a module-level supabase client and a module-level rate
 * limiter, so each test resets the module registry and re-mocks both before
 * importing a fresh copy of the handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a supabase stub whose .from().insert().select().single() resolves to
// the given { data, error } shape — the exact chain the handler calls.
function makeSupabase(result) {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(result),
        }),
      }),
    }),
  }
}

async function loadHandler({ supabase = null, rateLimited = false } = {}) {
  vi.resetModules()
  vi.doMock('src/lib/supabase', () => ({ supabase }))
  vi.doMock('src/lib/rate-limit', () => ({
    createRateLimiter: () => ({
      getClientIp: () => '203.0.113.7',
      isRateLimited: () => rateLimited,
    }),
  }))
  const mod = await import('../../pages/api/pente/game-result')
  return mod.default
}

function createRes() {
  const res = { _status: 200, _json: null }
  res.status = (code) => {
    res._status = code
    return res
  }
  res.json = (data) => {
    res._json = data
    return res
  }
  return res
}

const VALID_BODY = {
  player_id: 'p-123',
  opponent_type: 'bot',
  bot_level: 'hard',
  game_mode: 'classic',
  winner: 'p-123',
  elo_before: 1200,
  elo_after: 1216,
  moves: [[7, 7], [8, 8]],
}

describe('POST /api/pente/game-result', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 503 when Supabase is not configured', async () => {
    const handler = await loadHandler({ supabase: null })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(503)
  })

  it('returns 405 for non-POST methods', async () => {
    const handler = await loadHandler({ supabase: makeSupabase({ data: {}, error: null }) })
    const res = createRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res._status).toBe(405)
  })

  it('returns 429 when rate limited', async () => {
    const handler = await loadHandler({
      supabase: makeSupabase({ data: {}, error: null }),
      rateLimited: true,
    })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(429)
  })

  it('returns 400 when player_id is missing', async () => {
    const handler = await loadHandler({ supabase: makeSupabase({ data: {}, error: null }) })
    const res = createRes()
    await handler({ method: 'POST', body: { opponent_type: 'bot' } }, res)
    expect(res._status).toBe(400)
    expect(res._json.error).toMatch(/player_id/)
  })

  it('returns 200 { supported: false } when the table is not provisioned', async () => {
    const handler = await loadHandler({
      supabase: makeSupabase({ data: null, error: { code: '42P01', message: 'relation "game_results" does not exist' } }),
    })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(200)
    expect(res._json).toEqual({ supported: false })
  })

  it('treats a PGRST205 schema-cache miss as unprovisioned (200, not 500)', async () => {
    const handler = await loadHandler({
      supabase: makeSupabase({ data: null, error: { code: 'PGRST205', message: 'Could not find the table in the schema cache' } }),
    })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(200)
    expect(res._json.supported).toBe(false)
  })

  it('returns 500 on other Supabase errors', async () => {
    const handler = await loadHandler({
      supabase: makeSupabase({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(500)
    expect(res._json.error).toMatch(/duplicate key/)
  })

  it('returns 200 { result, supported: true } on a successful insert', async () => {
    const inserted = { id: 'g-1', player_id: 'p-123', winner: 'p-123' }
    const handler = await loadHandler({
      supabase: makeSupabase({ data: inserted, error: null }),
    })
    const res = createRes()
    await handler({ method: 'POST', body: VALID_BODY }, res)
    expect(res._status).toBe(200)
    expect(res._json).toEqual({ result: inserted, supported: true })
  })
})
