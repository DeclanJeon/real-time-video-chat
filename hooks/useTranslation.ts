import { useState, useCallback } from 'react'

// 실제 API 대신 사용하는 Mock 함수
async function mockTranslateAPI(text: string, targetLang: string): Promise<string> {
  if (!text) return ""
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200)) // 네트워크 지연 시뮬레이션
  return `[${targetLang.toUpperCase()}] ${text}`
}

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translate = useCallback(async (text: string, targetLang: string) => {
    setIsTranslating(true)
    setError(null)
    try {
      const translatedText = await mockTranslateAPI(text, targetLang)
      return translatedText
    } catch (err) {
      setError('Translation failed.')
      console.error(err)
      return null
    } finally {
      setIsTranslating(false)
    }
  }, [])

  return { translate, isTranslating, error }
}