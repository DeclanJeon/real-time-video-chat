import { useCallback, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import { useAppStore } from '@/store/userConfigStore'

interface SignalingConfig {
  serverUrl: string
  roomId: string
  userId: string
  nickname: string
}

export function useSignaling({
  serverUrl,
  roomId,
  userId,
  nickname,
}: SignalingConfig) {
  const {
    setSignalingConnected, setError,
    setWebRTCConnectionState, // WebRTC 연결 상태를 signaling 훅에서 직접 업데이트
    setRemoteStream, // 원격 스트림도 signaling 훅에서 직접 업데이트
    addMessage, // 채팅 메시지 추가
  } = useAppStore()

  const pcRef = useRef<RTCPeerConnection | null>(null) // RTCPeerConnection 인스턴스 참조 (useWebRTC와 공유)

  const socketRef = useRef<Socket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const MAX_RECONNECT_ATTEMPTS = 10
  const INITIAL_RECONNECT_DELAY = 1000
  const MAX_RECONNECT_DELAY = 30000

  // Exponential backoff for reconnection
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    )
    return delay + Math.random() * 1000 // Add jitter
  }, [])

  // Heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping', { timestamp: Date.now() })
      }
    }, 30000) // Send heartbeat every 30 seconds
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Connect to signaling server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    console.log('🔌 Connecting to signaling server...')
    
    const socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: false, // We'll handle reconnection manually
      timeout: 10000,
      query: {
        roomId,
        userId,
        nickname
      }
    })

    socket.on('connect', () => {
      console.log('✅ Connected to signaling server')
      setSignalingConnected(true)
      reconnectAttemptsRef.current = 0
      startHeartbeat()
      
      // Join room after connection
      socket.emit('join-room', { roomId, userId, nickname })
    })

    socket.on('disconnect', (reason) => {
      console.log(`❌ Disconnected: ${reason}`)
      setSignalingConnected(false)
      stopHeartbeat()
      
      // Auto-reconnect unless explicitly disconnected
      if (reason !== 'io client disconnect') {
        handleReconnect()
      }
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
      setError(`Connection failed: ${error.message}`)
      handleReconnect()
    })

    // Heartbeat response
    socket.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp
      console.log(`💓 Heartbeat latency: ${latency}ms`)
    })

    // WebRTC signaling events
    socket.on('user-joined', (data: { socketId: string, isPolite: boolean }) => {
      console.log('New user joined:', data.socketId)
      // 여기서 useWebRTC의 handleNegotiationNeeded를 호출해야 하지만,
      // useSignaling은 useWebRTC를 직접 import하지 않으므로,
      // video-chat.tsx에서 이 이벤트를 받아서 처리하도록 유지합니다.
      // 또는 useAppStore를 통해 상태를 업데이트하고 video-chat.tsx에서 이를 감지하도록 할 수 있습니다.
    })
    socket.on('user-left', (data: { userId: string, socketId: string }) => {
      console.log('User left:', data.socketId)
      setRemoteStream(null) // 원격 스트림 제거
      setWebRTCConnectionState('disconnected') // WebRTC 연결 상태 업데이트
    })
    socket.on('offer', (data: { senderSocketId: string, offer: RTCSessionDescriptionInit, polite: boolean }) => {
      // useWebRTC의 handleOffer를 호출해야 하지만, useSignaling은 useWebRTC를 직접 import하지 않으므로,
      // video-chat.tsx에서 이 이벤트를 받아서 처리하도록 유지합니다.
    })
    socket.on('answer', (data: { answer: RTCSessionDescriptionInit }) => {
      // useWebRTC의 handleAnswer를 호출해야 하지만, useSignaling은 useWebRTC를 직접 import하지 않으므로,
      // video-chat.tsx에서 이 이벤트를 받아서 처리하도록 유지합니다.
    })
    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit }) => {
      // useWebRTC의 handleIceCandidate를 호출해야 하지만, useSignaling은 useWebRTC를 직접 import하지 않으므로,
      // video-chat.tsx에서 이 이벤트를 받아서 처리하도록 유지합니다.
    })

    // Error handling
    socket.on('error', (error: any) => {
      console.error('Socket error:', error)
      setError(error.message || 'Unknown socket error')
    })

    // 파일 전송 관련 이벤트
    socket.on('file-transfer-signal', (data: any) => {
      console.log('File transfer signal received:', data);
      // 이 시그널은 useWebRTC에서 처리될 것이므로, 여기서는 단순히 로깅만 합니다.
      // 실제 파일 데이터는 WebRTC DataChannel을 통해 전송됩니다.
    });

    socketRef.current = socket
  }, [serverUrl, roomId, userId, nickname, setSignalingConnected, setError, startHeartbeat, stopHeartbeat, setRemoteStream, setWebRTCConnectionState, addMessage])

  // Reconnection logic with exponential backoff
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached')
      setError('Failed to reconnect to server')
      return
    }

    const delay = getReconnectDelay()
    reconnectAttemptsRef.current++
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
    
    setTimeout(() => {
      if (!socketRef.current?.connected) {
        connect()
      }
    }, delay)
  }, [connect, getReconnectDelay, setError])

  // Send signaling message
  const sendSignal = useCallback((type: string, data: any) => {
    if (!socketRef.current?.connected) {
      console.error('Cannot send signal: not connected')
      return false
    }

    socketRef.current.emit(type, data)
    return true
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    stopHeartbeat()
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setSignalingConnected(false)
  }, [stopHeartbeat, setSignalingConnected])

  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect]) // Only run once on mount

  return {
    socket: socketRef.current,
    sendSignal,
    disconnect,
    reconnect: connect
  }
}