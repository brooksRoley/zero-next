import { useState, useRef, useCallback } from 'react'

export default function useWebSpeechSTT() {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [confidence, setConfidence] = useState(null)
  const recognitionRef = useRef(null)

  const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

  const isSupported = !!SpeechRecognition

  const startListening = useCallback(() => {
    if (!isSupported) return

    setTranscript('')
    setConfidence(null)

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      let bestConfidence = 0

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
          if (result[0].confidence > bestConfidence) {
            bestConfidence = result[0].confidence
          }
        } else {
          interim += result[0].transcript
        }
      }

      setTranscript(final + interim)
      if (bestConfidence > 0) setConfidence(bestConfidence)
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isSupported, SpeechRecognition])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  return { transcript, isListening, startListening, stopListening, isSupported, confidence }
}
