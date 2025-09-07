"use client"

import { useEffect, useState, useRef } from "react"

interface AudioVisualizerProps {
  stream: MediaStream | null
  isEnabled: boolean
  showLabel?: boolean
}

export function AudioVisualizer({ stream, isEnabled, showLabel = true }: AudioVisualizerProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [peakLevel, setPeakLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream || !isEnabled) {
      setAudioLevel(0)
      setPeakLevel(0)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      return
    }

    const initializeAudioAnalysis = async () => {
      try {
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.8

        const microphone = audioContext.createMediaStreamSource(stream)
        microphone.connect(analyser)
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let peakDecay = 0

        const updateAudioLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray)

            // Calculate RMS (Root Mean Square) for more accurate level detection
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i] * dataArray[i]
            }
            const rms = Math.sqrt(sum / dataArray.length)
            const level = Math.min(100, (rms / 128) * 100)

            setAudioLevel(level)

            // Peak detection with decay
            if (level > peakDecay) {
              peakDecay = level
              setPeakLevel(level)
            } else {
              peakDecay = Math.max(0, peakDecay - 2) // Decay rate
              setPeakLevel(peakDecay)
            }
          }
          animationRef.current = requestAnimationFrame(updateAudioLevel)
        }

        updateAudioLevel()
      } catch (error) {
        console.error("Error initializing audio analysis:", error)
      }
    }

    initializeAudioAnalysis()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream, isEnabled])

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Audio Level</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{Math.round(audioLevel)}%</span>
            {audioLevel > 70 && (
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" title="High audio level" />
            )}
          </div>
        </div>
      )}
      <div className="audio-visualizer relative">
        {/* Main audio level */}
        <div
          className="audio-level"
          style={{
            width: `${audioLevel}%`,
            backgroundColor: audioLevel > 80 ? "#ea580c" : audioLevel > 50 ? "#f97316" : "#10b981",
          }}
        />
        {/* Peak indicator */}
        {peakLevel > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/80 transition-all duration-100"
            style={{ left: `${peakLevel}%` }}
          />
        )}
      </div>
    </div>
  )
}
