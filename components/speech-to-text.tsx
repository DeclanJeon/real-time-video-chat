"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Copy, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SpeechRecognition } from "@/lib/speech-recognition"

interface SpeechToTextProps {
  isActive: boolean
  onToggle: () => void
  onTranscript: (text: string, language: string) => void
}

export function SpeechToText({ isActive, onToggle, onTranscript }: SpeechToTextProps) {
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [language, setLanguage] = useState("ko-KR")
  const [confidence, setConfidence] = useState(0)
  const [history, setHistory] = useState<Array<{ text: string; timestamp: Date; confidence: number }>>([])
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const languages = [
    { code: "ko-KR", name: "한국어" },
    { code: "en-US", name: "English (US)" },
    { code: "ja-JP", name: "日本語" },
    { code: "zh-CN", name: "中文 (简体)" },
    { code: "zh-TW", name: "中文 (繁體)" },
    { code: "es-ES", name: "Español" },
    { code: "fr-FR", name: "Français" },
    { code: "de-DE", name: "Deutsch" },
    { code: "it-IT", name: "Italiano" },
    { code: "pt-BR", name: "Português (Brasil)" },
    { code: "ru-RU", name: "Русский" },
    { code: "ar-SA", name: "العربية" },
    { code: "hi-IN", name: "हिन्दी" },
    { code: "th-TH", name: "ไทย" },
    { code: "vi-VN", name: "Tiếng Việt" },
  ]

  useEffect(() => {
    try {
      const recognition = new SpeechRecognition()

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
            setConfidence(result[0].confidence || 0)

            // Add to history
            const newEntry = {
              text: result[0].transcript.trim(),
              timestamp: new Date(),
              confidence: result[0].confidence || 0,
            }
            setHistory((prev) => [newEntry, ...prev.slice(0, 49)]) // Keep last 50 entries

            // Send to parent component
            onTranscript(result[0].transcript.trim(), language)
          } else {
            interimTranscript += result[0].transcript
          }
        }

        setTranscript(finalTranscript + interimTranscript)
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        if (isActive) {
          // Restart recognition if still active
          setTimeout(() => {
            try {
              recognition.start()
            } catch (error) {
              console.error("Failed to restart recognition:", error)
            }
          }, 100)
        }
      }

      recognitionRef.current = recognition
      setIsSupported(true)
    } catch (error) {
      console.warn("Speech recognition not supported:", error)
      setIsSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [language, isActive, onTranscript])

  useEffect(() => {
    if (!isSupported) return

    if (isActive && !isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error("Failed to start recognition:", error)
      }
    } else if (!isActive && isListening && recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [isActive, isListening, isSupported])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const clearHistory = () => {
    setHistory([])
    setTranscript("")
  }

  if (!isSupported) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Speech recognition is not supported in this browser.</p>
          <p className="text-sm mt-1">Please use Chrome, Edge, or Safari for speech-to-text functionality.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          <span className="font-medium">음성 자막</span>
          {isListening && (
            <Badge variant="secondary" className="animate-pulse">
              듣는 중...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={isActive ? "default" : "outline"} size="sm" onClick={onToggle}>
            {isActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {transcript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">현재 음성:</span>
            <div className="flex items-center gap-2">
              {confidence > 0 && (
                <Badge variant="outline" className="text-xs">
                  신뢰도: {Math.round(confidence * 100)}%
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(transcript)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="p-3 bg-muted rounded-md text-sm">{transcript}</div>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">음성 기록:</span>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {history.slice(0, 5).map((entry, index) => (
              <div key={index} className="flex items-start justify-between p-2 bg-muted/50 rounded text-xs">
                <span className="flex-1">{entry.text}</span>
                <div className="flex items-center gap-1 ml-2">
                  <Badge variant="outline" className="text-xs">
                    {Math.round(entry.confidence * 100)}%
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(entry.text)}>
                    <Copy className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
