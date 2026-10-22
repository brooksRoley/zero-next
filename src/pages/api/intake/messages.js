import { sql } from 'src/lib/db'
import { ensureIntakeSchema } from 'src/lib/intakeSchema'
import { createRateLimiter } from 'src/lib/rate-limit'

// Deliberately looser than send.js's 20/hr: this is the read side of the same
// thread, and the client (src/pages/intake.jsx) refetches on mount and again
// after every send. A visitor who sends the full 20 messages legitimately
// triggers ~21 reads, so copying 20/hr here would throttle real usage. 60/hr
// leaves room for page reloads while still bounding scripted abuse.
const limiter = createRateLimiter(60, 60 * 60 * 1000) // 60 per hour

// visitorId is the only thing standing between one visitor's thread and
// another's, so it must be a strict UUID (unguessable, and a typed column).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Checked before input validation, matching send.js — a client burning the
  // budget on malformed requests should still be throttled.
  const ip = limiter.getClientIp(req)
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { visitorId } = req.query
  if (!visitorId) return res.status(400).json({ error: 'visitorId is required' })
  if (typeof visitorId !== 'string' || !UUID_RE.test(visitorId)) {
    return res.status(400).json({ error: 'visitorId must be a valid UUID' })
  }

  // The visitor's own messages plus replies to them. visitorId is a bound
  // parameter here, so no filter string is built from user input.
  try {
    await ensureIntakeSchema()
    const messages = await sql`
      SELECT * FROM intake_messages
      WHERE visitor_id = ${visitorId}
         OR parent_id IN (SELECT id FROM intake_messages WHERE visitor_id = ${visitorId})
      ORDER BY created_at ASC
    `
    return res.status(200).json({ messages })
  } catch (err) {
    console.error('intake messages failed', err)
    return res.status(500).json({ error: 'Could not load messages.' })
  }
}
