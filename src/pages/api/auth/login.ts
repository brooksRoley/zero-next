import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

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
