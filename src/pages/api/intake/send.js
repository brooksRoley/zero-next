import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'

const limiter = createRateLimiter(20, 60 * 60 * 1000) // 20 per hour

// Cap serialized metadata size to keep a bot from stuffing the JSONB column.
const MAX_METADATA_BYTES = 4 * 1024 // 4KB

// Mirror the same UUID check from messages.js so both endpoints enforce the
// same visitor_id format in the intake_messages table.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  const ip = limiter.getClientIp(req)
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { visitorId, visitorName, type, content, audioUrl, metadata } = req.body

  if (!visitorId) return res.status(400).json({ error: 'visitorId is required' })
  if (typeof visitorId !== 'string' || !UUID_RE.test(visitorId)) {
    return res.status(400).json({ error: 'visitorId must be a valid UUID' })
  }
  if (metadata != null && Buffer.byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES) {
    return res.status(400).json({ error: 'metadata too large' })
  }
  if (!type || !['text', 'voice'].includes(type)) {
    return res.status(400).json({ error: 'type must be "text" or "voice"' })
  }
  if (type === 'text' && !content) {
    return res.status(400).json({ error: 'content is required for text messages' })
  }
  if (type === 'voice' && !audioUrl && !content) {
    return res.status(400).json({ error: 'audioUrl or content is required for voice messages' })
  }

  const { data, error } = await supabase
    .from('intake_messages')
    .insert({
      visitor_id: visitorId,
      visitor_name: visitorName || null,
      type,
      content: content || null,
      audio_url: audioUrl || null,
      metadata: metadata || {},
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: data })
}
