import { sql } from 'src/lib/db'
import { ensureIntakeSchema } from 'src/lib/intakeSchema'
import { createRateLimiter } from 'src/lib/rate-limit'

const limiter = createRateLimiter(20, 60 * 60 * 1000) // 20 per hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cap serialized metadata size to keep a bot from stuffing the JSONB column.
const MAX_METADATA_BYTES = 4 * 1024 // 4KB
const MAX_CONTENT_CHARS = 5000
const MAX_NAME_CHARS = 80

// A voice note's URL lands in the owner's inbox as a link, so only accept one
// pointing at this site's own Supabase Storage — never an arbitrary URL.
function isOwnStorageUrl(url) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return typeof url === 'string' && !!base && url.startsWith(`${base}/storage/v1/object/public/intake-audio/`)
}

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
  if (content != null && (typeof content !== 'string' || content.length > MAX_CONTENT_CHARS)) {
    return res.status(400).json({ error: `content must be text of at most ${MAX_CONTENT_CHARS} characters` })
  }
  if (visitorName != null && (typeof visitorName !== 'string' || visitorName.length > MAX_NAME_CHARS)) {
    return res.status(400).json({ error: `visitorName must be at most ${MAX_NAME_CHARS} characters` })
  }
  if (audioUrl != null && !isOwnStorageUrl(audioUrl)) {
    return res.status(400).json({ error: 'audioUrl is not a recognised upload' })
  }
  if (type === 'voice' && !audioUrl && !content) {
    return res.status(400).json({ error: 'audioUrl or content is required for voice messages' })
  }

  let message
  try {
    await ensureIntakeSchema()
    const rows = await sql`
      INSERT INTO intake_messages (visitor_id, visitor_name, type, content, audio_url, metadata)
      VALUES (${visitorId}, ${visitorName || null}, ${type}, ${content || null}, ${audioUrl || null}, ${JSON.stringify(metadata || {})})
      RETURNING *
    `
    message = rows[0]
  } catch (err) {
    console.error('intake send failed', err)
    return res.status(500).json({ error: 'Could not save your message. Please try again.' })
  }

  // Surface the message to the owner's inbox. Awaited so it completes before
  // the serverless function freezes, but wrapped so a delivery failure never
  // turns an already-persisted message into an error response.
  try {
    await notifyNewIntakeMessage({ visitorName: visitorName || null, type, content, audioUrl })
  } catch {
    // Best-effort — the message is already safely persisted.
  }

  return res.status(200).json({ message })
}
