"use client"
// translation-panel.tsx

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Languages, ArrowRightLeft, Copy, Volume2, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TranslationPanelProps {
  isActive: boolean
  onToggle: () => void
  inputText?: string
  onTranslation: (original: string, translated: string, fromLang: string, toLang: string) => void
}

export function TranslationPanel({ isActive, onToggle, inputText, onTranslation }: TranslationPanelProps) {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLang, setSourceLang] = useState("auto")
  const [targetLang, setTargetLang] = useState("en")
  const [isTranslating, setIsTranslating] = useState(false)
  const [history, setHistory] = useState<
    Array<{
      original: string
      translated: string
      fromLang: string
      toLang: string
      timestamp: Date
    }>
  >([])

  const languages = [
    { code: "auto", name: "자동 감지" },
    { code: "ko", name: "한국어" },
    { code: "en", name: "English" },
    { code: "ja", name: "日本語" },
    { code: "zh", name: "中文" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "it", name: "Italiano" },
    { code: "pt", name: "Português" },
    { code: "ru", name: "Русский" },
    { code: "ar", name: "العربية" },
    { code: "hi", name: "हिन्दी" },
    { code: "th", name: "ไทย" },
    { code: "vi", name: "Tiếng Việt" },
  ]

  // Mock translation function (in real app, use Google Translate API or similar)
  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    setIsTranslating(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock translation logic (replace with actual API)
    const mockTranslations: Record<string, Record<string, string>> = {
      안녕하세요: { en: "Hello", ja: "こんにちは", zh: "你好" },
      감사합니다: { en: "Thank you", ja: "ありがとうございます", zh: "谢谢" },
      Hello: { ko: "안녕하세요", ja: "こんにちは", zh: "你好" },
      "Thank you": { ko: "감사합니다", ja: "ありがとうございます", zh: "谢谢" },
      こんにちは: { ko: "안녕하세요", en: "Hello", zh: "你好" },
      你好: { ko: "안녕하세요", en: "Hello", ja: "こんにちは" },
    }

    const result = mockTranslations[text]?.[to] || `[${to.toUpperCase()}] ${text}`
    setIsTranslating(false)
    return result
  }

  useEffect(() => {
    if (inputText && inputText !== sourceText) {
      setSourceText(inputText)
      if (isActive) {
        handleTranslate(inputText)
      }
    }
  }, [inputText, isActive])

  const handleTranslate = async (textToTranslate?: string) => {
    const text = textToTranslate || sourceText
    if (!text.trim()) return

    try {
      const translated = await translateText(text, sourceLang, targetLang)
      setTranslatedText(translated)

      const newEntry = {
        original: text,
        translated,
        fromLang: sourceLang,
        toLang: targetLang,
        timestamp: new Date(),
      }

      setHistory((prev) => [newEntry, ...prev.slice(0, 19)]) // Keep last 20 entries
      onTranslation(text, translated, sourceLang, targetLang)
    } catch (error) {
      console.error("Translation error:", error)
    }
  }

  const swapLanguages = () => {
    if (sourceLang === "auto") return

    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const speakText = (text: string, lang: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === "auto" ? "ko-KR" : `${lang}-${lang.toUpperCase()}`
      speechSynthesis.speak(utterance)
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          <span className="font-medium">음성 번역</span>
          {isActive && <Badge variant="secondary">활성화됨</Badge>}
        </div>
        <Button variant={isActive ? "default" : "outline"} size="sm" onClick={onToggle}>
          {isActive ? "비활성화" : "활성화"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Select value={sourceLang} onValueChange={setSourceLang}>
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => speakText(sourceText, sourceLang)}
                disabled={!sourceText}
              >
                <Volume2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(sourceText)} disabled={!sourceText}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Textarea
            placeholder="번역할 텍스트를 입력하세요..."
            value={sourceText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSourceText(e.target.value)}
            className="min-h-24"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages
                  .filter((lang) => lang.code !== "auto")
                  .map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => speakText(translatedText, targetLang)}
                disabled={!translatedText}
              >
                <Volume2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(translatedText)}
                disabled={!translatedText}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="min-h-24 p-3 bg-muted rounded-md text-sm">
            {isTranslating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                번역 중...
              </div>
            ) : (
              translatedText || "번역 결과가 여기에 표시됩니다"
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={swapLanguages} disabled={sourceLang === "auto"}>
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
        <Button onClick={() => handleTranslate()} disabled={!sourceText.trim() || isTranslating}>
          {isTranslating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              번역 중...
            </>
          ) : (
            "번역하기"
          )}
        </Button>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">번역 기록:</span>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {history.slice(0, 3).map((entry, index) => (
              <div key={index} className="p-2 bg-muted/50 rounded text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{entry.original}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(entry.original)}>
                    <Copy className="h-2 w-2" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{entry.translated}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(entry.translated)}>
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
