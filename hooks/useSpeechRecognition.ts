import { useState, useEffect, useRef, useCallback } from 'react'


interface SpeechRecognitionOptions {
  lang?: string
  onTranscript: (transcript: string, isFinal: boolean) => void
}

export function useSpeechRecognition({ lang = 'en-US', onTranscript }: SpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<any | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang
    
    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interimTranscript += event.results[i][0].transcript
        }
      }
      onTranscript(finalTranscript || interimTranscript, !!finalTranscript)
    }

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (event) => console.error('Speech recognition error:', event.error)

    recognitionRef.current = recognition
  }, [lang, onTranscript])

  const start = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
    }
  }, [isListening])

  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  return { isListening, isSupported, start, stop }
}