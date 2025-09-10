"use client"
import { useState, useEffect } from 'react'
import { Languages, Mic, MicOff, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useTranslation } from '@/hooks/useTranslation'

interface RealtimeCaptionProps {
  onCaptionGenerated: (captionData: any) => void
}

export function RealtimeCaption({ onCaptionGenerated }: RealtimeCaptionProps) {
  const [isActive, setIsActive] = useState(false)
  const [sourceLang, setSourceLang] = useState('en-US')
  const [targetLang, setTargetLang] = useState('ko')
  const [myTranscript, setMyTranscript] = useState('')
  const [translatedTranscript, setTranslatedTranscript] = useState('')
  const { translate } = useTranslation()

  const handleTranscript = async (transcript: string, isFinal: boolean) => {
    setMyTranscript(transcript)
    
    // 번역 및 전송
    const translated = await translate(transcript, targetLang)
    if (translated) {
      setTranslatedTranscript(translated)
    }

    // DataChannel로 전송
    onCaptionGenerated({
      type: 'caption',
      payload: {
        source: transcript,
        translated: translated,
        sourceLang,
        targetLang,
        isFinal,
      }
    })
  }

  const { isListening, isSupported, start, stop } = useSpeechRecognition({
    lang: sourceLang,
    onTranscript: handleTranscript,
  })

  useEffect(() => {
    if (isActive) {
      start()
    } else {
      stop()
    }
  }, [isActive, start, stop])

  if (!isSupported) return <p className="text-xs text-destructive">Speech recognition not supported.</p>

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/50 p-2 rounded-lg text-white text-center w-3/4 max-w-3xl z-20">
      <div className="flex justify-center items-center gap-4 mb-2">
        <Button size="sm" variant={isActive ? 'secondary' : 'outline'} onClick={() => setIsActive(p => !p)}>
          {isActive ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
          {isActive ? 'Caption Off' : 'Caption On'}
        </Button>
        {/* 언어 설정 UI (생략) */}
      </div>
      <p className="text-lg font-semibold">{myTranscript}</p>
      <p className="text-sm text-gray-300">{translatedTranscript}</p>
    </div>
  )
}