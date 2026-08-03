import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'

// Deliberately looser than send.js's 20/hr: this is the read side of the same
// thread, and the client (src/pages/intake.jsx) refetches on mount and again
// after every send. A visitor who sends the full 20 messages legitimately
// triggers ~21 reads, so copying 20/hr here would throttle real usage. 60/hr
// leaves room for page reloads while still bounding scripted abuse.
const limiter = createRateLimiter(60, 60 * 60 * 1000) // 60 per hour

// visitorId is interpolated into a PostgREST .or() filter below, so it must be a
// strict UUID. Without this, a crafted value (e.g. "x,parent_id.gt.0") could
// inject filter clauses and read other visitors' messages (IDOR).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

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

  // Fetch visitor's messages and any responses to them
  const { data: visitorMessages, error: err1 } = await supabase
    .from('intake_messages')
    .select('id')
    .eq('visitor_id', visitorId)

  if (err1) return res.status(500).json({ error: err1.message })

  const messageIds = visitorMessages.map((m) => m.id)

  // No prior messages means no possible replies — skip the .or() entirely to
  // avoid an empty parent_id.in.() filter that PostgREST may reject or mishandle.
  if (messageIds.length === 0) {
    return res.status(200).json({ messages: [] })
  }

  const { data, error } = await supabase
    .from('intake_messages')
    .select('*')
    .or(`visitor_id.eq.${visitorId},parent_id.in.(${messageIds.join(',')})`)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ messages: data })
}
