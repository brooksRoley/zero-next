/**
 * /api/surf/conditions: fixed spots only, server-built upstream URLs, a
 * labeled fallback when Open-Meteo fails, and no internals in the response.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from 'src/pages/api/surf/conditions'

function createRes(): any {
  const res: any = { _status: 200, _json: null, _headers: {} as Record<string, string> }
  res.status = (code: number) => ((res._status = code), res)
  res.json = (data: unknown) => ((res._json = data), res)
  res.setHeader = (k: string, v: string) => ((res._headers[k] = v), res)
  return res
}
const req = (spot: unknown, ip = '198.51.100.1'): any => ({
  method: 'GET',
  query: { spot },
  headers: { 'x-forwarded-for': ip },
})

afterEach(() => vi.unstubAllGlobals())

describe('api/surf/conditions', () => {
  it('rejects a spot outside the table without calling upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = createRes()
    await handler(req('https://evil.example/x'), res)
    expect(res._status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a live reading and fetches only Open-Meteo', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('marine')
          ? { current: { swell_wave_height: 2, swell_wave_period: 15 } }
          : { current: { wind_speed_10m: 4, wind_direction_10m: 40 } },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const res = createRes()
    await handler(req('teahupoo', '198.51.100.2'), res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('live')
    expect(res._json.conditions).toEqual({ height: 2.8, period: 15, wind: 4, breakType: 1 })
    for (const [url] of fetchMock.mock.calls) expect(url).toMatch(/^https:\/\/(marine-)?api\.open-meteo\.com\//)
    expect(res._headers['Cache-Control']).toMatch(/s-maxage=1800/)
  })

  it('falls back to the typical day, labeled, with no error detail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })))
    const res = createRes()
    await handler(req('skeleton-bay', '198.51.100.3'), res)
    expect(res._status).toBe(200)
    expect(res._json.source).toBe('typical')
    expect(res._json.reading).toBeNull()
    expect(JSON.stringify(res._json)).not.toMatch(/502|upstream/)
  })
})
