import { supabase } from 'src/lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabase) return res.status(503).json({ error: 'Database not configured' })

  const { visitorId, visitorName, type, content, audioUrl, metadata } = req.body

  if (!visitorId) return res.status(400).json({ error: 'visitorId is required' })
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
