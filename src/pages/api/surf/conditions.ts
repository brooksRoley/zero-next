/**
 * GET /api/surf/conditions?spot=pipeline|teahupoo|skeleton-bay
 *
 * Live conditions for BARREL. Reads Open-Meteo's free marine and forecast
 * APIs (no key) for one of three fixed spots and maps them to the game's
 * four numbers (src/lib/barrel/surf.ts). The spot must be one of the fixed
 * ids: the server builds every upstream URL.
 *
 * Cached per spot in memory for 30 minutes and at the edge (s-maxage), so a
 * busy day costs a handful of upstream calls. When Open-Meteo is down or
 * slow, it answers with the spot's typical conditions, labeled `typical`.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createRateLimiter } from 'src/lib/rate-limit'
import {
  conditionsFromReading,
  openMeteoUrls,
  parseOpenMeteo,
  readingIsUsable,
  spotById,
  type ConditionsResponse,
  type SpotId,
} from 'src/lib/barrel/surf'

const limiter = createRateLimiter(60, 10 * 60 * 1000) // 60 req / 10 min / IP
const CACHE_MS = 30 * 60 * 1000
const UPSTREAM_TIMEOUT_MS = 4000

const cache = new Map<SpotId, { at: number; body: ConditionsResponse }>()

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const ip = limiter.getClientIp(req)
  if (limiter.isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  const spot = spotById(req.query.spot)
  if (!spot) return res.status(400).json({ error: 'Unknown spot' })

  const now = Date.now()
  const hit = cache.get(spot.id)
  let body: ConditionsResponse
  if (hit && now - hit.at < CACHE_MS) {
    body = hit.body
  } else {
    try {
      const urls = openMeteoUrls(spot)
      const [marine, weather] = await Promise.all([fetchJson(urls.marine), fetchJson(urls.weather)])
      const reading = parseOpenMeteo(marine, weather)
      if (!readingIsUsable(reading)) throw new Error('reading missing height or period')
      body = {
        spot: spot.id,
        source: 'live',
        conditions: conditionsFromReading(spot, reading),
        reading,
        fetchedAt: new Date(now).toISOString(),
      }
      cache.set(spot.id, { at: now, body })
    } catch (err) {
      console.error('[surf/conditions]', spot.id, err instanceof Error ? err.message : err)
      body = {
        spot: spot.id,
        source: 'typical',
        conditions: spot.typical,
        reading: null,
        fetchedAt: new Date(now).toISOString(),
      }
    }
  }
  res.setHeader(
    'Cache-Control',
    body.source === 'live' ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'public, s-maxage=120',
  )
  return res.status(200).json(body)
}
