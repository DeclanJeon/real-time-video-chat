import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/userConfigStore'

interface MediaConstraints {
  video: boolean | MediaTrackConstraints
  audio: boolean | MediaTrackConstraints
}

interface UseMediaStreamConfig {
  constraints?: MediaConstraints
}

export function useMediaStream({
  constraints = { video: true, audio: true },
}: UseMediaStreamConfig = {}) {
  const {
    localStream, setLocalStream, setMediaLoading, setError, setScreenSharing,
    isScreenSharing,
  } = useAppStore()

  const streamRef = useRef<MediaStream | null>(localStream)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cleanupCallbacksRef = useRef<(() => void)[]>([])

  // Cleanup function for media tracks
  const cleanupStream = useCallback((streamToClean?: MediaStream | null) => {
    const targetStream = streamToClean || streamRef.current
    
    if (targetStream) {
      console.log('🧹 Cleaning up media stream')
      targetStream.getTracks().forEach(track => {
        track.stop()
        console.log(`Stopped ${track.kind} track: ${track.label}`)
      })
    }

    // Run any additional cleanup callbacks
    cleanupCallbacksRef.current.forEach(callback => callback())
    cleanupCallbacksRef.current = []
  }, [])

  // Initialize media stream
  const initializeStream = useCallback(async (customConstraints?: MediaConstraints) => {
    setMediaLoading(true)
    setError(null)

    // Clean up existing stream
    if (streamRef.current) {
      cleanupStream()
    }

    try {
      const finalConstraints = customConstraints || constraints
      console.log('📹 Requesting media with constraints:', finalConstraints)
      
      const newStream = await navigator.mediaDevices.getUserMedia(finalConstraints)
      
      streamRef.current = newStream
      cameraStreamRef.current = newStream // 카메라 스트림 백업
      setLocalStream(newStream)
      
      // Monitor track ended events
      newStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.log(`Track ended: ${track.kind}`)
          // Attempt to restart the track
          restartTrack(track.kind as 'audio' | 'video')
        })
      })

      console.log('✅ Media stream initialized successfully')
      return newStream
    } catch (err) {
      const error = err as Error
      console.error('❌ Failed to initialize media stream:', error)
      setError(error.message) // 에러 메시지를 string으로 전달
      
      // Fallback strategies
      if (error.name === 'NotFoundError') {
        // No camera/microphone found
        return handleNoDevicesFound()
      } else if (error.name === 'NotAllowedError') {
        // Permission denied
        return handlePermissionDenied()
      } else if (error.name === 'OverconstrainedError') {
        // Constraints cannot be satisfied
        return handleOverconstrained()
      }
      
      return null
    } finally {
      setMediaLoading(false)
    }
  }, [constraints, cleanupStream, setLocalStream, setMediaLoading, setError])

  // 화면 공유 시작 함수 추가
  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) return

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // 시스템 오디오 공유 시도
      })

      // 화면 공유 중지 감지 (브라우저의 '중지' 버튼 클릭 시)
      const videoTrack = screenStream.getVideoTracks()[0]
      videoTrack.onended = () => {
        stopScreenShare()
      }

      const oldStream = streamRef.current
      streamRef.current = screenStream
      setLocalStream(screenStream)
      setScreenSharing(true)

      return screenStream
    } catch (error) {
      console.error('Failed to start screen share:', error)
      setError((error as Error).message) // 에러 메시지를 string으로 전달
      return null
    }
  }, [isScreenSharing, setLocalStream, setScreenSharing, setError])

  // 화면 공유 중지 함수 추가
  const stopScreenShare = useCallback(() => {
    if (!isScreenSharing || !cameraStreamRef.current) return

    const oldStream = streamRef.current
    cleanupStream(oldStream) // 현재 화면 공유 스트림 정리

    streamRef.current = cameraStreamRef.current
    setLocalStream(cameraStreamRef.current)
    setScreenSharing(false)
    
    console.log('Screen share stopped, restored camera stream.')
  }, [isScreenSharing, cleanupStream, setLocalStream, setScreenSharing])

  // Fallback: No devices found
  const handleNoDevicesFound = useCallback(async () => {
    console.log('🎤 No devices found, trying audio only...')
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      })
      streamRef.current = audioStream
      setLocalStream(audioStream)
      return audioStream
    } catch {
      console.error('Failed to get even audio stream')
      return null
    }
  }, [setLocalStream])

  // Fallback: Permission denied
  const handlePermissionDenied = useCallback(() => {
    console.error('Permission denied for media devices')
    setError('Camera and microphone access denied. Please check your browser permissions.')
    return null
  }, [setError])

  // Fallback: Overconstrained
  const handleOverconstrained = useCallback(async () => {
    console.log('📉 Constraints too strict, trying with default constraints...')
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      streamRef.current = fallbackStream
      setLocalStream(fallbackStream)
      return fallbackStream
    } catch (err) {
      console.error('Failed with default constraints:', err)
      setError((err as Error).message) // 에러 메시지를 string으로 전달
      return null
    }
  }, [setLocalStream, setError])

  // Replace a specific track
  const replaceTrack = useCallback(async (
    kind: 'audio' | 'video',
    newConstraints?: MediaTrackConstraints | boolean
  ) => {
    if (!streamRef.current) return null

    try {
      const oldTrack = streamRef.current.getTracks().find(t => t.kind === kind)
      if (oldTrack) {
        oldTrack.stop()
        streamRef.current.removeTrack(oldTrack)
      }

      const constraints = {
        [kind]: newConstraints !== undefined ? newConstraints : true
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = newStream.getTracks()[0]
      
      if (newTrack) {
        streamRef.current.addTrack(newTrack)
        console.log(`✅ Replaced ${kind} track`)
        
        // Monitor the new track
        newTrack.addEventListener('ended', () => {
          console.log(`New track ended: ${newTrack.kind}`)
          restartTrack(kind)
        })
      }

      setLocalStream(streamRef.current) // 스트림 업데이트
      return newTrack
    } catch (error) {
      console.error(`Failed to replace ${kind} track:`, error)
      setError((error as Error).message) // 에러 메시지를 string으로 전달
      return null
    }
  }, [setLocalStream, setError])

  // Restart a track that has ended
  const restartTrack = useCallback(async (kind: 'audio' | 'video') => {
    console.log(`🔄 Restarting ${kind} track...`)
    await replaceTrack(kind)
  }, [replaceTrack])

  // Toggle track enabled state
  const toggleTrack = useCallback((kind: 'audio' | 'video', enabled?: boolean) => {
    if (!streamRef.current) return false

    const track = streamRef.current.getTracks().find(t => t.kind === kind)
    if (track) {
      track.enabled = enabled !== undefined ? enabled : !track.enabled
      console.log(`${kind} track ${track.enabled ? 'enabled' : 'disabled'}`)
      setLocalStream(streamRef.current) // 스트림 업데이트
      return track.enabled
    }
    return false
  }, [setLocalStream])

  // Change media device
  const changeDevice = useCallback(async (kind: 'audio' | 'video', deviceId: string) => {
    const constraints = {
      [kind]: { deviceId: { exact: deviceId } }
    }
    
    const newTrack = await replaceTrack(kind, constraints[kind])
    return newTrack
  }, [replaceTrack])

  // Apply constraints to existing track
  const applyConstraints = useCallback(async (
    kind: 'audio' | 'video',
    constraints: MediaTrackConstraints
  ) => {
    if (!streamRef.current) return false

    const track = streamRef.current.getTracks().find(t => t.kind === kind)
    if (track) {
      try {
        await track.applyConstraints(constraints)
        console.log(`✅ Applied constraints to ${kind} track`)
        setLocalStream(streamRef.current) // 스트림 업데이트
        return true
      } catch (error) {
        console.error(`Failed to apply constraints to ${kind} track:`, error)
        setError((error as Error).message) // 에러 메시지를 string으로 전달
        return false
      }
    }
    return false
  }, [setLocalStream, setError])

  // Register cleanup callback
  const registerCleanup = useCallback((callback: () => void) => {
    cleanupCallbacksRef.current.push(callback)
  }, [])

  // 컴포넌트 언마운트 시 카메라 스트림도 정리하도록 수정
  const fullCleanup = useCallback(() => {
    cleanupStream(streamRef.current)
    cleanupStream(cameraStreamRef.current)
    setLocalStream(null)
    setScreenSharing(false)
  }, [cleanupStream, setLocalStream, setScreenSharing])

  // Initialize on mount
  useEffect(() => {
    initializeStream()

    return () => {
      fullCleanup()
    }
  }, [initializeStream, fullCleanup])

  return {
    initializeStream,
    startScreenShare,
    stopScreenShare,
    replaceTrack,
    toggleTrack,
    changeDevice,
    applyConstraints,
    cleanupStream: fullCleanup,
    registerCleanup
  }
}