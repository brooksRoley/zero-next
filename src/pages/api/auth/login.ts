import type { NextApiRequest, NextApiResponse } from 'next'
import { createRateLimiter } from 'src/lib/rate-limit'

// Admin login is a high-value brute-force target: throttle password guesses
// to 5 attempts per 15 minutes per IP so ADMIN_PASSWORD can't be enumerated.
const limiter = createRateLimiter(5, 15 * 60 * 1000)

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = limiter.getClientIp(req)
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  }

  const { password } = req.body
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const token = process.env.ADMIN_SESSION_TOKEN
  if (!token) return res.status(500).json({ error: 'Server misconfigured' })

  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
  res.setHeader(
    'Set-Cookie',
    `tracker_session=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax; ${secure}`
  )
  res.status(200).json({ ok: true })
}
