import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store/userConfigStore'
import Peer, { Instance as SimplePeer } from 'simple-peer'

interface WebRTCConfig {
  iceServers: RTCIceServer[]
  roomId: string
  userId: string
  localStream: MediaStream | undefined
  onData: (data: any) => void; // Add onData callback
}

export function useWebRTC({
  iceServers,
  roomId,
  userId,
  localStream,
  onData, // Destructure onData
}: WebRTCConfig) {
  const {
    setRemoteStream,
    setWebRTCConnectionState,
    setError,
    addMessage,
  } = useAppStore()

  const peerRef = useRef<SimplePeer | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const bufferedMessagesRef = useRef<Array<{ type: 'text' | 'file' | 'caption'; content: string }>>([])
  const MAX_RECONNECT_ATTEMPTS = 5

  // Peer 연결 생성
  const createPeerConnection = useCallback((initiator: boolean = false) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      config: {
        iceServers,
      },
      stream: localStream,
    })

    // 시그널 데이터 생성 시
    peer.on('signal', (data) => {
      console.log('📡 Signal data:', data)
      // 시그널링 서버로 전송하는 로직 추가 필요
    })

    // 연결 성공
    peer.on('connect', () => {
      console.log('✅ Peer connected')
      setWebRTCConnectionState('connected')
      reconnectAttemptsRef.current = 0
      sendBufferedMessages()
    })

    // 원격 스트림 수신
    peer.on('stream', (stream) => {
      console.log('📹 Received remote stream')
      setRemoteStream(stream)
    })

    // 데이터 수신
    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString())
        console.log('📨 Received message:', message)
        
        if (message.type === 'text') {
          addMessage(JSON.parse(message.content))
        } else { // Handle other data types, including file chunks
          onData(data); // Pass raw data to the onData callback
        }
      } catch (error) {
        console.error('Error parsing message or processing data:', error)
      }
    })

    // 에러 처리
    peer.on('error', (err) => {
      console.error('❌ Peer error:', err)
      setError(err.message)
      handleReconnect()
    })

    // 연결 종료
    peer.on('close', () => {
      console.log('❌ Peer closed')
      setWebRTCConnectionState('closed')
    })

    peerRef.current = peer
    return peer
  }, [iceServers, localStream, setRemoteStream, setWebRTCConnectionState, setError, addMessage, onData])

  // 재연결 처리
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current++
      setTimeout(() => {
        console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}`)
        cleanup()
        createPeerConnection()
      }, 1000 * reconnectAttemptsRef.current)
    } else {
      setError('Maximum reconnection attempts reached')
    }
  }, [createPeerConnection, setError])

  // 시그널 처리
  const handleSignal = useCallback((signal: any) => {
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.signal(signal)
    }
  }, [])

  // 데이터 전송
  const sendData = useCallback((type: 'text' | 'file' | 'caption', content: string): boolean => {
    const peer = peerRef.current
    
    if (!peer || peer.destroyed || !peer.connected) {
      console.warn('📡 Peer not connected, buffering message')
      bufferedMessagesRef.current.push({ type, content })
      return false
    }

    try {
      const message = JSON.stringify({ type, content })
      peer.send(message)
      console.log(`📨 Sent ${type} message`)
      return true
    } catch (error) {
      console.error('Failed to send message:', error)
      bufferedMessagesRef.current.push({ type, content })
      return false
    }
  }, [])

  // 버퍼링된 메시지 전송
  const sendBufferedMessages = useCallback(() => {
    const peer = peerRef.current
    if (!peer || !peer.connected || bufferedMessagesRef.current.length === 0) {
      return
    }

    const messages = [...bufferedMessagesRef.current]
    bufferedMessagesRef.current = []

    messages.forEach(message => {
      try {
        peer.send(JSON.stringify(message))
        console.log(`📨 Sent buffered ${message.type} message`)
      } catch (error) {
        console.error('Failed to send buffered message:', error)
        bufferedMessagesRef.current.push(message)
      }
    })
  }, [])

  // 스트림 업데이트
  const updateStream = useCallback((newStream: MediaStream) => {
    const peer = peerRef.current
    if (peer && !peer.destroyed) {
      peer.addStream(newStream)
      console.log('✅ Stream updated')
    }
  }, [])

  // 트랙 교체
  const replaceTrack = useCallback((oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => {
    const peer = peerRef.current
    if (peer && !peer.destroyed) {
      peer.replaceTrack(oldTrack, newTrack, localStream!)
      console.log(`✅ Replaced ${newTrack.kind} track`)
    }
  }, [localStream])

  // 정리
  const cleanup = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }
    setWebRTCConnectionState('closed')
    reconnectAttemptsRef.current = 0
    bufferedMessagesRef.current = []
  }, [setWebRTCConnectionState])

  // 초기화
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    peerConnection: peerRef.current,
    connectionState: peerRef.current?.connected ? 'connected' : 'disconnected',
    createPeerConnection,
    handleSignal,
    sendData,
    updateStream,
    replaceTrack,
    cleanup,
  }
}