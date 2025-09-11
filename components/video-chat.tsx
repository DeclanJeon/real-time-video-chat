"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import io, { Socket } from "socket.io-client"
import Peer from "simple-peer"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  FileUp,
  Subtitles,
  Languages,
  Maximize,
  Minimize,
  PictureInPicture,
  Monitor,
  MonitorOff,
  Play,
} from "lucide-react"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { VolumeControl } from "@/components/volume-control"
import { VideoControls } from "@/components/video-controls"
import { ResizablePanel } from "@/components/resizable-panel"
import { ChatPanel } from "@/components/chat-panel"

interface VideoChatProps {
  roomId: string
  userId: string
  nickname: string
  onLeaveRoom: () => void
}

interface RoomUser {
  userId: string
  nickname: string
  socketId: string
}

// ICE servers configuration
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" }
]

export function VideoChat({ roomId, userId, nickname, onLeaveRoom }: VideoChatProps) {
  // State management
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showFileShare, setShowFileShare] = useState(false)
  const [isSubtitlesEnabled, setIsSubtitlesEnabled] = useState(false)
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [volume, setVolume] = useState(50)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiPEnabled, setIsPiPEnabled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "failed">("connecting")
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [audioInputLevel, setAudioInputLevel] = useState(0)
  const [audioOutputLevel, setAudioOutputLevel] = useState(0)
  const [showSubtitles, setShowSubtitles] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [currentTranslation, setCurrentTranslation] = useState("")
  const [localVideoPlaying, setLocalVideoPlaying] = useState(false)
 const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
 const [subtitleHistory, setSubtitleHistory] = useState<
    Array<{
      text: string
      translation?: string
      timestamp: Date
      speaker: string
    }>
  >([])
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const peerRef = useRef<Peer.Instance | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController>(new AbortController())
  const localStreamRef = useRef<MediaStream | null>(null)
  const targetSocketIdRef = useRef<string | null>(null)
  const mySocketIdRef = useRef<string | undefined>(undefined)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([])

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...")
    
    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Destroy peer connection
    if (peerRef.current) {
      try {
        peerRef.current.destroy()
      } catch (e) {
        console.error("Error destroying peer:", e)
      }
      peerRef.current = null
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      localStreamRef.current = null
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setLocalStream(null)
    setRemoteStream(null)
    setConnectionStatus("disconnected")
  }, [])

  // Initialize media stream with error recovery
  const initializeMediaStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)
      
      // Set video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      return stream
    } catch (error) {
      console.error("Error accessing media devices:", error)
      setConnectionError("Failed to access camera/microphone")
      
      // Try audio-only fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        localStreamRef.current = audioStream
        setLocalStream(audioStream)
        setIsVideoEnabled(false)
        return audioStream
      } catch (audioError) {
        console.error("Failed to get audio stream:", audioError)
        setConnectionError("Failed to access any media devices")
        return null
      }
    }
  }, [])

  // Create peer connection with proper error handling
  const createPeerConnection = useCallback((initiator: boolean, targetSocketId: string): Peer.Instance | null => {
    if (!localStreamRef.current) {
      console.error("No local stream available")
      return null
    }

    try {
      const peer = new Peer({
        initiator,
        trickle: true,
        stream: localStreamRef.current,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10
        }
      })

      // Handle signaling
      peer.on('signal', (data: Peer.SignalData) => {
        if (!socketRef.current) return

        if (data.type === 'offer') {
          socketRef.current.emit('offer', {
            targetSocketId,
            offer: data
          })
        } else if (data.type === 'answer') {
          socketRef.current.emit('answer', {
            targetSocketId,
            answer: data
          })
        } else if (data.type === 'candidate' && data.candidate) {
          socketRef.current.emit('ice-candidate', {
            targetSocketId,
            candidate: data.candidate
          })
        }
      })

      // Handle incoming stream
      peer.on('stream', (stream: MediaStream) => {
        console.log('Received remote stream')
        setRemoteStream(stream)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      })

      // Connection established
      peer.on('connect', () => {
        console.log('Peer connection established')
        setConnectionStatus("connected")
        setConnectionError(null)
        
        // Process queued ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift()
          if (candidate) {
            peer.signal({ type: 'candidate', candidate } as any)
          }
        }
      })

      // Handle errors
      peer.on('error', (err: Error) => {
        console.error('Peer error:', err)
        setConnectionError(err.message)
        setConnectionStatus("failed")
        
        // Attempt reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect...")
          initializeConnection()
        }, 3000)
      })

      // Connection closed
      peer.on('close', () => {
        console.log('Peer connection closed')
        setConnectionStatus("disconnected")
        setRemoteStream(null)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
      })

      return peer
    } catch (error) {
      console.error("Error creating peer connection:", error)
      setConnectionError("Failed to create peer connection")
      return null
    }
  }, [])

  // Initialize connection
  const initializeConnection = useCallback(() => {
    if (!socketRef.current) {
      console.error("Socket not connected")
      return
    }

    socketRef.current.emit('get-room-users', roomId, (users: RoomUser[]) => {
      const otherUsers = users.filter(u => u.socketId !== socketRef.current?.id)
      
      if (otherUsers.length === 0) {
        console.log("Waiting for other user...")
        return
      }

      const targetUser = otherUsers[0]
      
      // Clean up existing peer if any
      if (peerRef.current) {
        peerRef.current.destroy()
      }

      // Create new peer connection
      peerRef.current = createPeerConnection(true, targetUser.socketId)
    })
  }, [roomId, createPeerConnection])

  // Main initialization effect
  useEffect(() => {
    isMountedRef.current = true
    let mounted = true

    const init = async () => {
      // Get media stream first
      const stream = await initializeMediaStream()
      if (!stream || !mounted) return

      // Connect to signaling server
      const socket = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      socketRef.current = socket

      // Socket event handlers
      socket.on('connect', () => {
        console.log('Connected to signaling server')
        mySocketIdRef.current = socket.id
        socket.emit('join-room', { roomId, userId, nickname })
      })

      socket.on('existing-users', (users: RoomUser[]) => {
        console.log('Existing users:', users)
        if (mounted) {
          setTimeout(initializeConnection, 500)
        }
      })

      socket.on('user-joined', (data: any) => {
        console.log('User joined:', data)
        if (mounted && !peerRef.current) {
          setTimeout(initializeConnection, 500)
        }
      })

      socket.on('offer', (data: { senderSocketId: string; offer: Peer.SignalData }) => {
        if (!mounted) return
        
        console.log('Received offer')
        
        // Clean up existing peer
        if (peerRef.current) {
          peerRef.current.destroy()
        }

        // Create answer peer
        peerRef.current = createPeerConnection(false, data.senderSocketId)
        if (peerRef.current) {
          peerRef.current.signal(data.offer)
        }
      })

      socket.on('answer', (data: { senderSocketId: string; answer: Peer.SignalData }) => {
        if (!mounted || !peerRef.current) return
        
        console.log('Received answer')
        peerRef.current.signal(data.answer)
      })

      socket.on('ice-candidate', (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
        if (!mounted) return
        
        if (peerRef.current) {
          peerRef.current.signal({ type: 'candidate', candidate: data.candidate } as any)
        } else {
          // Queue ICE candidates if peer not ready
          iceCandidatesQueue.current.push(data.candidate)
        }
      })

      socket.on('user-left', (data: any) => {
        console.log('User left:', data)
        if (peerRef.current) {
          peerRef.current.destroy()
          peerRef.current = null
        }
        setRemoteStream(null)
        setConnectionStatus("disconnected")
      })

      socket.on('disconnect', () => {
        console.log('Disconnected from signaling server')
        setConnectionStatus("disconnected")
      })

      socket.on('reconnect', () => {
        console.log('Reconnected to signaling server')
        socket.emit('join-room', { roomId, userId, nickname })
      })
    }

    init()

    return () => {
      mounted = false
      isMountedRef.current = false
      cleanup()
    }
  }, [roomId, userId, nickname, initializeMediaStream, createPeerConnection, initializeConnection, cleanup])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
        setIsVideoEnabled(!isVideoEnabled)
      }
    }
  }, [localStream, isVideoEnabled])

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }, [localStream, isAudioEnabled])

  // Leave room
  const handleLeaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId })
    }
    cleanup()
    onLeaveRoom()
  }, [roomId, cleanup, onLeaveRoom])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Error notification */}
      {connectionError && (
        <div className="absolute top-4 right-4 z-50">
          <Card className="p-4 bg-destructive/10 border-destructive">
            <p className="text-sm text-destructive">{connectionError}</p>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">Room: {roomId}</h1>
              <p className="text-sm text-muted-foreground">{nickname}</p>
            </div>
            <Badge
              variant={
                connectionStatus === "connected"
                  ? "default"
                  : connectionStatus === "connecting"
                    ? "secondary"
                    : connectionStatus === "failed"
                      ? "destructive"
                      : "outline"
              }
            >
              {connectionStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">

          {/* Local video */}
          <Card className="relative overflow-hidden">
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">Initializing camera...</p>
              </div>
            )}
          </Card>

          {/* Remote video */}
          <Card className="relative overflow-hidden">
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">Waiting for participant...</p>
              </div>
            )}
          </Card>
        </div>

        {/* Controls */}
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant={isAudioEnabled ? "default" : "secondary"}
            onClick={toggleAudio}
            disabled={!localStream}
          >
            {isAudioEnabled ? "Mute" : "Unmute"}
          </Button>
          <Button
            variant={isVideoEnabled ? "default" : "secondary"}
            onClick={toggleVideo}
            disabled={!localStream}
          >
            {isVideoEnabled ? "Hide Video" : "Show Video"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleLeaveRoom}
          >
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  )
}
