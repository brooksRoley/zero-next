import { useState, useRef, useCallback } from 'react'

export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const analyserRef = useRef(null)

  const isSupported = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Voice recording is not supported in this browser')
      return
    }

    try {
      setError(null)
      setAudioBlob(null)
      setAudioUrl(null)
      setDuration(0)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up analyser for waveform visualization
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Pick a supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        analyserRef.current = null
      }

      recorder.start(250) // collect chunks every 250ms
      setIsRecording(true)

      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access was denied'
        : 'Could not start recording')
    }
  }, [isSupported])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    audioUrl,
    duration,
    error,
    isSupported,
    analyser: analyserRef.current,
  }
}
