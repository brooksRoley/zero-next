import { supabase } from 'src/lib/supabase'
import { createRateLimiter } from 'src/lib/rate-limit'

const limiter = createRateLimiter(20, 60 * 60 * 1000) // 20 per hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cap serialized metadata size to keep a bot from stuffing the JSONB column.
const MAX_METADATA_BYTES = 4 * 1024 // 4KB

// Best-effort owner notification for a new intake message. Same pattern as
// api/consulting/leads.ts:notifyNewLead — server-side only, so the owner's
// inbox address never reaches the client. Intake has no visitor email (only
// an anonymous visitorId + optional display name), so there's no reply_to;
// replies happen through the intake thread itself, not email. Never throws —
// a delivery failure must not turn a successfully persisted message into an
// error. No-op until RESEND_API_KEY is set.
async function notifyNewIntakeMessage({ visitorName, type, content, audioUrl }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey.includes('REPLACE')) return

  const who = visitorName || 'Anonymous visitor'
  const lines = [
    `From: ${who}`,
    `Type: ${type}`,
    '',
    type === 'voice'
      ? `Transcript: ${content || '(no transcript captured)'}${audioUrl ? `\nAudio: ${audioUrl}` : ''}`
      : content || '(no content)',
  ]

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Site Intake <onboarding@resend.dev>',
      to: ['brooksroley@gmail.com'],
      subject: `New intake message — ${who}`,
      text: lines.join('\n'),
    }),
  })
}

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

  // Surface the message to the owner's inbox. Awaited so it completes before
  // the serverless function freezes, but wrapped so a delivery failure never
  // turns an already-persisted message into an error response.
  try {
    await notifyNewIntakeMessage({ visitorName: visitorName || null, type, content, audioUrl })
  } catch {
    // Best-effort — the message is already safely persisted.
  }

  return res.status(200).json({ message: data })
}
