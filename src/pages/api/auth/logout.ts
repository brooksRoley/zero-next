import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Set-Cookie', 'tracker_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
  res.status(200).json({ ok: true })
}
