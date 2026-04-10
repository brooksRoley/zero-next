import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Reveal from 'src/components/Reveal'
import { supabase } from 'src/lib/supabase'
import useVisitorId from 'src/hooks/useVisitorId'
import useVoiceRecorder from 'src/hooks/useVoiceRecorder'
import useWebSpeechSTT from 'src/hooks/useWebSpeechSTT'

// ── Waveform Visualizer ──────────────────────────────────────────────────────
function WaveformViz({ analyser }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!analyser || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'rgba(8, 31, 21, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = '#ff69b4'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className="w-full h-[60px] rounded-lg bg-forest-900/80"
    />
  )
}

// ── Calendly Popup ───────────────────────────────────────────────────────────
function useCalendlyPopup() {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    if (document.querySelector('script[src*="calendly.com"]')) {
      loaded.current = true
      return
    }
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    script.onload = () => { loaded.current = true }
    document.head.appendChild(script)
  }, [])

  const open = useCallback(() => {
    if (window.Calendly) {
      window.Calendly.initPopupWidget({ url: 'https://calendly.com/brooksroley/' })
    } else {
      window.open('https://calendly.com/brooksroley/', '_blank')
    }
  }, [])

  return open
}

// ── Format timestamp ─────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Intake() {
  const { visitorId, visitorName, setVisitorName } = useVisitorId()
  const recorder = useVoiceRecorder()
  const stt = useWebSpeechSTT()
  const openCalendly = useCalendlyPopup()

  const [name, setName] = useState('')
  const [textMessage, setTextMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [messages, setMessages] = useState([])
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'voice'

  // Sync name from localStorage
  useEffect(() => {
    if (visitorName) setName(visitorName)
  }, [visitorName])

  // Load message thread
  useEffect(() => {
    if (!visitorId || !supabase) return
    fetch(`/api/intake/messages?visitorId=${visitorId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages) setMessages(data.messages) })
      .catch(() => {})
  }, [visitorId, sent])

  // Start/stop STT alongside recorder
  const handleStartRecording = () => {
    recorder.startRecording()
    if (stt.isSupported) stt.startListening()
  }

  const handleStopRecording = () => {
    recorder.stopRecording()
    if (stt.isListening) stt.stopListening()
  }

  // Submit text message
  const sendText = async () => {
    if (!textMessage.trim() || !visitorId) return
    setSending(true)

    if (name && name !== visitorName) setVisitorName(name)

    try {
      const res = await fetch('/api/intake/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          visitorName: name || null,
          type: 'text',
          content: textMessage.trim(),
        }),
      })
      if (res.ok) {
        setTextMessage('')
        setSent((p) => !p)
      }
    } catch {}
    setSending(false)
  }

  // Submit voice message
  const sendVoice = async () => {
    if (!recorder.audioBlob || !visitorId) return
    setSending(true)

    if (name && name !== visitorName) setVisitorName(name)

    let audioUrl = null

    // Upload audio to Supabase Storage
    if (supabase) {
      const filename = `${visitorId}/${Date.now()}.webm`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('intake-audio')
        .upload(filename, recorder.audioBlob, {
          contentType: recorder.audioBlob.type,
          upsert: false,
        })

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage
          .from('intake-audio')
          .getPublicUrl(uploadData.path)
        audioUrl = urlData?.publicUrl || null
      }
    }

    try {
      const res = await fetch('/api/intake/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          visitorName: name || null,
          type: 'voice',
          content: stt.transcript || null,
          audioUrl,
          metadata: {
            duration: recorder.duration,
            sttConfidence: stt.confidence,
            sttSupported: stt.isSupported,
          },
        }),
      })
      if (res.ok) {
        setSent((p) => !p)
      }
    } catch {}
    setSending(false)
  }

  const noDb = !supabase

  return (
    <main className="min-h-screen bg-forest-950 text-white">
      <Head>
        <title>Contact &mdash; Brooks Roley</title>
        <meta name="description" content="Leave Brooks a message — text or voice. Or book a call." />
        <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
      </Head>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-forest-950 to-forest-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,105,180,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(45,106,79,0.35),transparent_55%)]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Leave me a message
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-lg text-forest-200 max-w-xl mx-auto">
              Type something, record a voice note, or just book a call.
              I&apos;ll get back to you.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 md:px-6">

        {/* ── Name (optional) ── */}
        <Reveal>
          <div className="pt-10 pb-4">
            <label className="block text-xs font-semibold uppercase tracking-widest text-forest-400 mb-2">
              Your name <span className="text-forest-600 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should I address you?"
              className="w-full px-4 py-2.5 rounded-lg bg-forest-900/80 border border-forest-700/40 text-white placeholder-forest-600 text-sm focus:outline-none focus:border-candy-500/50 transition-colors"
            />
          </div>
        </Reveal>

        {/* ── Tab Switcher ── */}
        <Reveal delay={100}>
          <div className="flex gap-1 mb-6 bg-forest-900/60 rounded-lg p-1 border border-forest-700/30">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'text'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
            >
              Text Message
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'voice'
                  ? 'bg-forest-800 text-white'
                  : 'text-forest-400 hover:text-forest-200'
              }`}
              disabled={!recorder.isSupported}
              title={!recorder.isSupported ? 'Voice recording not supported in this browser' : ''}
            >
              Voice Note
              {!recorder.isSupported && (
                <span className="ml-1 text-forest-600 text-xs">(unavailable)</span>
              )}
            </button>
          </div>
        </Reveal>

        {/* ── Text Input ── */}
        {activeTab === 'text' && (
          <Reveal delay={150}>
            <div className="space-y-3">
              <textarea
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                placeholder="What's on your mind? Project idea, question, just saying hey — anything works."
                rows={5}
                disabled={noDb}
                className="w-full px-4 py-3 rounded-lg bg-forest-900/80 border border-forest-700/40 text-white placeholder-forest-600 text-sm resize-none focus:outline-none focus:border-candy-500/50 transition-colors disabled:opacity-50"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-forest-600">
                  {noDb ? 'Messaging unavailable — use Calendly below' : ''}
                </span>
                <button
                  onClick={sendText}
                  disabled={!textMessage.trim() || sending || noDb}
                  className="px-5 py-2 rounded-lg bg-candy-500 hover:bg-candy-600 disabled:opacity-40 disabled:hover:bg-candy-500 text-white text-sm font-semibold transition-colors"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── Voice Recorder ── */}
        {activeTab === 'voice' && (
          <Reveal delay={150}>
            <div className="space-y-4">
              {/* Recording controls */}
              <div className="flex flex-col items-center gap-4 py-6 rounded-xl border border-forest-700/40 bg-forest-900/60">
                {recorder.isRecording && (
                  <WaveformViz analyser={recorder.analyser} />
                )}

                <div className="flex items-center gap-4">
                  {!recorder.isRecording && !recorder.audioBlob && (
                    <button
                      onClick={handleStartRecording}
                      disabled={noDb}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-candy-500 hover:bg-candy-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                      Record
                    </button>
                  )}

                  {recorder.isRecording && (
                    <>
                      <div className="flex items-center gap-2 text-candy-400 text-sm">
                        <span className="w-2 h-2 rounded-full bg-candy-500 animate-pulse" />
                        {recorder.duration}s
                      </div>
                      <button
                        onClick={handleStopRecording}
                        className="px-5 py-2.5 rounded-lg bg-forest-700 hover:bg-forest-600 text-white text-sm font-semibold transition-colors"
                      >
                        Stop
                      </button>
                    </>
                  )}

                  {recorder.audioBlob && !recorder.isRecording && (
                    <>
                      <audio src={recorder.audioUrl} controls className="h-10" />
                      <button
                        onClick={handleStartRecording}
                        className="px-4 py-2 rounded-lg border border-forest-700/60 text-forest-300 hover:text-white text-sm transition-colors"
                      >
                        Re-record
                      </button>
                    </>
                  )}
                </div>

                {recorder.error && (
                  <p className="text-sm text-candy-400">{recorder.error}</p>
                )}
              </div>

              {/* Live transcript */}
              {stt.isSupported && (stt.isListening || stt.transcript) && (
                <div className="rounded-lg border border-forest-700/30 bg-forest-900/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-forest-500 mb-1">
                    Transcript {stt.isListening && <span className="text-candy-400 animate-pulse">listening...</span>}
                  </p>
                  <p className="text-sm text-forest-200 min-h-[1.5rem]">
                    {stt.transcript || <span className="text-forest-600 italic">Start talking...</span>}
                  </p>
                </div>
              )}

              {/* Send button */}
              {recorder.audioBlob && !recorder.isRecording && (
                <div className="flex justify-end">
                  <button
                    onClick={sendVoice}
                    disabled={sending || noDb}
                    className="px-5 py-2 rounded-lg bg-candy-500 hover:bg-candy-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                  >
                    {sending ? 'Sending...' : 'Send Voice Note'}
                  </button>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ── Book a Call ── */}
        <Reveal delay={200}>
          <div className="mt-10 py-8 text-center border-t border-forest-800/60">
            <p className="text-forest-400 text-sm mb-3">
              Prefer a live conversation?
            </p>
            <button
              onClick={openCalendly}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-forest-600 hover:border-forest-500 text-forest-200 hover:text-white font-medium text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book a Call
            </button>
          </div>
        </Reveal>

        {/* ── Message Thread ── */}
        {messages.length > 0 && (
          <section className="py-10 border-t border-forest-800/60">
            <Reveal>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-500 mb-4">
                Your messages
              </h2>
            </Reveal>
            <div className="space-y-3">
              {messages.map((msg) => (
                <Reveal key={msg.id} delay={50}>
                  <div
                    className={`rounded-lg p-4 text-sm ${
                      msg.type === 'response'
                        ? 'bg-candy-500/10 border border-candy-500/20 ml-4'
                        : 'bg-forest-900/60 border border-forest-700/30 mr-4'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-forest-400">
                        {msg.type === 'response' ? 'Brooks' : (msg.visitor_name || 'You')}
                      </span>
                      <span className="text-xs text-forest-600">
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                    {msg.content && (
                      <p className="text-forest-200">{msg.content}</p>
                    )}
                    {msg.audio_url && (
                      <audio src={msg.audio_url} controls className="mt-2 h-8 w-full max-w-xs" />
                    )}
                    {msg.type === 'voice' && !msg.content && (
                      <p className="text-forest-500 italic text-xs">Voice note (no transcript)</p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ── Fallback for no DB ── */}
        {noDb && (
          <Reveal>
            <div className="mt-8 p-6 rounded-xl border border-forest-700/30 bg-forest-900/40 text-center">
              <p className="text-forest-300 text-sm mb-3">
                Messaging is currently offline. You can still reach me directly:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={openCalendly}
                  className="px-5 py-2 rounded-lg bg-candy-500 hover:bg-candy-600 text-white text-sm font-semibold transition-colors"
                >
                  Book a Call
                </button>
                <a
                  href="https://www.linkedin.com/in/brooksroley/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 rounded-lg border border-forest-600 text-forest-200 hover:text-white text-sm font-medium transition-colors"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </Reveal>
        )}

        {/* spacing at bottom */}
        <div className="h-16" />
      </div>
    </main>
  )
}
