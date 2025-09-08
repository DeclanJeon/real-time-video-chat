"use client"

import { useEffect, useState, useRef, useCallback } from "react"

interface AudioVisualizerProps {
  stream: MediaStream | null
  isEnabled: boolean
  showLabel?: boolean
}

export function AudioVisualizer({ stream, isEnabled, showLabel = true }: AudioVisualizerProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [peakLevel, setPeakLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const peakDecayRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch (e) {
        // Source already disconnected
      }
      sourceRef.current = null
    }
    
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch (e) {
        // Analyser already disconnected
      }
      analyserRef.current = null
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error)
      audioContextRef.current = null
    }
    
    setAudioLevel(0)
    setPeakLevel(0)
    peakDecayRef.current = 0
  }, [])

  useEffect(() => {
    if (!stream || !isEnabled) {
      cleanup()
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      cleanup()
      return
    }

    const initializeAudioAnalysis = async () => {
      try {
        // Clean up any existing context
        cleanup()

        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256 // Reduced for better performance
        analyser.smoothingTimeConstant = 0.85
        analyser.minDecibels = -90
        analyser.maxDecibels = -10

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        
        sourceRef.current = source
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const updateAudioLevel = () => {
          if (!analyserRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
            return
          }

          analyserRef.current.getByteFrequencyData(dataArray)

          // Calculate weighted average focusing on voice frequencies (300Hz - 3.4kHz)
          const voiceFreqStart = Math.floor((300 / (audioContextRef.current.sampleRate / 2)) * dataArray.length)
          const voiceFreqEnd = Math.floor((3400 / (audioContextRef.current.sampleRate / 2)) * dataArray.length)
          
          let sum = 0
          let count = 0
          for (let i = voiceFreqStart; i < voiceFreqEnd && i < dataArray.length; i++) {
            sum += dataArray[i]
            count++
          }
          
          const average = count > 0 ? sum / count : 0
          const level = Math.min(100, (average / 255) * 100 * 2) // Amplify for better visibility

          setAudioLevel(level)

          // Peak detection with smoother decay
          if (level > peakDecayRef.current) {
            peakDecayRef.current = level
            setPeakLevel(level)
          } else {
            peakDecayRef.current = Math.max(0, peakDecayRef.current - 1.5)
            setPeakLevel(peakDecayRef.current)
          }

          animationRef.current = requestAnimationFrame(updateAudioLevel)
        }

        updateAudioLevel()
      } catch (error) {
        console.error("Error initializing audio analysis:", error)
        cleanup()
      }
    }

    initializeAudioAnalysis()

    return cleanup
  }, [stream, isEnabled, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

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
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        {/* Main audio level */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-100 ease-out rounded-full"
          style={{
            width: `${audioLevel}%`,
            backgroundColor: audioLevel > 80 ? "#ea580c" : audioLevel > 50 ? "#f97316" : "#10b981",
          }}
        />
        {/* Peak indicator */}
        {peakLevel > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 transition-all duration-100"
            style={{ left: `${peakLevel}%` }}
          />
        )}
      </div>
    </div>
  )
}
