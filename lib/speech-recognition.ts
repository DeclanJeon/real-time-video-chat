declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

export class SpeechRecognition extends EventTarget {
  continuous = false
  interimResults = false
  lang = "en-US"
  maxAlternatives = 1

  private recognition: any
  private isListening = false

  constructor() {
    super()

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      throw new Error("Speech recognition not supported in this browser")
    }

    this.recognition = new SpeechRecognition()
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.recognition.onstart = () => {
      this.isListening = true
      this.dispatchEvent(new Event("start"))
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.dispatchEvent(new Event("end"))
    }

    this.recognition.onresult = (event: any) => {
      const speechEvent = new CustomEvent("result", { detail: event }) as any
      speechEvent.results = event.results
      speechEvent.resultIndex = event.resultIndex
      this.dispatchEvent(speechEvent)
    }

    this.recognition.onerror = (event: any) => {
      const errorEvent = new CustomEvent("error", { detail: event }) as any
      errorEvent.error = event.error
      errorEvent.message = event.message
      this.dispatchEvent(errorEvent)
    }
  }

  start() {
    if (!this.isListening) {
      this.recognition.continuous = this.continuous
      this.recognition.interimResults = this.interimResults
      this.recognition.lang = this.lang
      this.recognition.maxAlternatives = this.maxAlternatives
      this.recognition.start()
    }
  }

  stop() {
    if (this.isListening) {
      this.recognition.stop()
    }
  }

  abort() {
    this.recognition.abort()
  }

  // Event handler properties for compatibility
  set onstart(handler: ((event: Event) => void) | null) {
    if (handler) {
      this.addEventListener("start", handler)
    }
  }

  set onend(handler: ((event: Event) => void) | null) {
    if (handler) {
      this.addEventListener("end", handler)
    }
  }

  set onresult(handler: ((event: SpeechRecognitionEvent) => void) | null) {
    if (handler) {
      this.addEventListener("result", handler as EventListener)
    }
  }

  set onerror(handler: ((event: SpeechRecognitionErrorEvent) => void) | null) {
    if (handler) {
      this.addEventListener("error", handler as EventListener)
    }
  }
}

export default SpeechRecognition
