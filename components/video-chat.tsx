"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import io, { type Socket } from "socket.io-client"
import Peer from "simple-peer"
import {
  Play,
  Monitor,
  PenTool,
  MessageSquare,
  Settings,
  FileText,
  Menu,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
} from "lucide-react"
import { ScreenShareManager } from "@/components/screen-share-manager"
import { Whiteboard } from "@/components/whiteboard"
import { ChatSystem } from "@/components/chat-system"
import { SettingsPanel } from "@/components/settings-panel"
import { FileSharingSystem } from "@/components/file-sharing-system"

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
  { urls: "stun:stun4.l.google.com:19302" },
]

export function VideoChat({ roomId, userId, nickname, onLeaveRoom }: VideoChatProps) {
  // State management
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "failed">(
    "connecting",
  )
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [localVideoPlaying, setLocalVideoPlaying] = useState(false)
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [showMobileControls, setShowMobileControls] = useState(true)
  const [mobileControlsTimeout, setMobileControlsTimeout] = useState<NodeJS.Timeout | null>(null)

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const peerRef = useRef<Peer.Instance | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const isMountedRef = useRef(true)
  const localStreamRef = useRef<MediaStream | null>(null)
  const targetSocketIdRef = useRef<string | null>(null)
  const mySocketIdRef = useRef<string | undefined>(undefined)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([])
  const dataChannelRef = useRef<RTCDataChannel | null>(null)

  const localVideoManagerRef = useRef<{
    currentStream: MediaStream | null
    isPlaying: boolean
    playPromise: Promise<void> | null
    abortController: AbortController | null
  }>({ currentStream: null, isPlaying: false, playPromise: null, abortController: null })

  const remoteVideoManagerRef = useRef<{
    currentStream: MediaStream | null
    isPlaying: boolean
    playPromise: Promise<void> | null
    abortController: AbortController | null
  }>({ currentStream: null, isPlaying: false, playPromise: null, abortController: null })

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...")

    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Abort any pending video operations
    if (localVideoManagerRef.current.abortController) {
      localVideoManagerRef.current.abortController.abort()
    }
    if (remoteVideoManagerRef.current.abortController) {
      remoteVideoManagerRef.current.abortController.abort()
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
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      localStreamRef.current = null
    }

    cleanupVideoElements()

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setLocalStream(null)
    setRemoteStream(null)
    setConnectionStatus("disconnected")
  }, [])

  const cleanupVideoElements = useCallback(() => {
    localVideoManagerRef.current = { currentStream: null, isPlaying: false, playPromise: null, abortController: null }
    remoteVideoManagerRef.current = { currentStream: null, isPlaying: false, playPromise: null, abortController: null }

    // Clear video elements safely without calling load()
    if (localVideoRef.current) {
      localVideoRef.current.pause()
      localVideoRef.current.srcObject = null
      // Removed load() call that was causing new load requests
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause()
      remoteVideoRef.current.srcObject = null
      // Removed load() call that was causing new load requests
    }
  }, [])

  const handleScreenShare = useCallback((stream: MediaStream | null) => {
    setScreenStream(stream)
    setIsScreenSharing(!!stream)
  }, [])

  const handleDrawingData = useCallback((data: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      dataChannelRef.current.send(
        JSON.stringify({
          type: "whiteboard",
          data: data,
        }),
      )
    }
  }, [])

  const [whiteboardDataReceiver, setWhiteboardDataReceiver] = useState<((data: any) => void) | null>(null)

  const setupWhiteboardReceiver = useCallback((callback: (data: any) => void) => {
    setWhiteboardDataReceiver(() => callback)
  }, [])

  const safeSetVideoStream = useCallback(
    (videoElement: HTMLVideoElement | null, stream: MediaStream | null, isLocal = false): void => {
      if (!videoElement || !isMountedRef.current) return

      const manager = isLocal ? localVideoManagerRef.current : remoteVideoManagerRef.current

      try {
        // Cancel any pending operations
        if (manager.abortController) {
          manager.abortController.abort()
        }

        // Simple, synchronous stream assignment
        if (manager.currentStream !== stream) {
          videoElement.srcObject = stream
          manager.currentStream = stream
        }

        // Never automatically play - user must click
        manager.isPlaying = false
        if (isLocal) {
          setLocalVideoPlaying(false)
        } else {
          setRemoteVideoPlaying(false)
        }
      } catch (error) {
        // Ignore all errors
      }
    },
    [],
  )

  const handleVideoPlay = useCallback((isLocal: boolean) => {
    const videoElement = isLocal ? localVideoRef.current : remoteVideoRef.current
    const manager = isLocal ? localVideoManagerRef.current : remoteVideoManagerRef.current

    if (!videoElement || !videoElement.srcObject) return

    try {
      videoElement.play()
      manager.isPlaying = true
      if (isLocal) {
        setLocalVideoPlaying(true)
      } else {
        setRemoteVideoPlaying(true)
      }
    } catch (error) {
      // Ignore all play errors
    }
  }, [])

  const handleUserInteraction = useCallback(() => {
    if (!userInteracted) {
      setUserInteracted(true)
    }
  }, [userInteracted])

  const resetMobileControlsTimeout = useCallback(() => {
    if (mobileControlsTimeout) {
      clearTimeout(mobileControlsTimeout)
    }

    setShowMobileControls(true)

    if (isMobile) {
      const timeout = setTimeout(() => {
        setShowMobileControls(false)
      }, 3000)
      setMobileControlsTimeout(timeout)
    }
  }, [isMobile, mobileControlsTimeout])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
        setIsVideoEnabled(!isVideoEnabled)
      }
    }
  }, [localStream, isVideoEnabled])

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }, [localStream, isAudioEnabled])

  const handleLeaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit("leave-room", { roomId })
    }
    cleanup()
    onLeaveRoom()
  }, [roomId, cleanup, onLeaveRoom])

  const initializeMediaStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const videoConstraints = isMobile
        ? {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 },
            facingMode: "user",
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: isMobile ? 16000 : 48000, // Lower sample rate for mobile
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)

      await safeSetVideoStream(localVideoRef.current, stream, true)

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
  }, [safeSetVideoStream, isMobile])

  const createPeerConnection = useCallback(
    (initiator: boolean, targetSocketId: string): Peer.Instance | null => {
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
            iceCandidatePoolSize: 10,
          },
        })

        // Set up data channel for whiteboard and chat
        if (initiator) {
          const dataChannel = peer._pc.createDataChannel("messages", {
            ordered: true,
          })

          dataChannel.onopen = () => {
            console.log("Data channel opened")
            dataChannelRef.current = dataChannel
          }

          dataChannel.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data)
              if (message.type === "whiteboard" && whiteboardDataReceiver) {
                whiteboardDataReceiver(message.data)
              }
              // Chat messages are handled by ChatSystem component
            } catch (error) {
              console.error("Error parsing data channel message:", error)
            }
          }
        } else {
          peer._pc.ondatachannel = (event) => {
            const dataChannel = event.channel
            dataChannelRef.current = dataChannel

            dataChannel.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data)
                if (message.type === "whiteboard" && whiteboardDataReceiver) {
                  whiteboardDataReceiver(message.data)
                }
                // Chat messages are handled by ChatSystem component
              } catch (error) {
                console.error("Error parsing data channel message:", error)
              }
            }
          }
        }

        // Handle signaling
        peer.on("signal", (data: Peer.SignalData) => {
          if (!socketRef.current) return

          if (data.type === "offer") {
            socketRef.current.emit("offer", {
              targetSocketId,
              offer: data,
            })
          } else if (data.type === "answer") {
            socketRef.current.emit("answer", {
              targetSocketId,
              answer: data,
            })
          } else if (data.type === "candidate" && data.candidate) {
            socketRef.current.emit("ice-candidate", {
              targetSocketId,
              candidate: data.candidate,
            })
          }
        })

        peer.on("stream", (stream: MediaStream) => {
          console.log("Received remote stream")
          setRemoteStream(stream)
          safeSetVideoStream(remoteVideoRef.current, stream, false)
        })

        // Connection established
        peer.on("connect", () => {
          console.log("Peer connection established")
          setConnectionStatus("connected")
          setConnectionError(null)

          // Process queued ICE candidates
          while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift()
            if (candidate) {
              peer.signal({ type: "candidate", candidate } as any)
            }
          }
        })

        // Handle errors
        peer.on("error", (err: Error) => {
          console.error("Peer error:", err)
          setConnectionError(err.message)
          setConnectionStatus("failed")

          // Attempt reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...")
            initializeConnection()
          }, 3000)
        })

        // Connection closed
        peer.on("close", () => {
          console.log("Peer connection closed")
          setConnectionStatus("disconnected")
          setRemoteStream(null)
          if (remoteVideoRef.current) {
            safeSetVideoStream(remoteVideoRef.current, null, false)
          }
        })

        return peer
      } catch (error) {
        console.error("Error creating peer connection:", error)
        setConnectionError("Failed to create peer connection")
        return null
      }
    },
    [whiteboardDataReceiver, safeSetVideoStream],
  )

  // Initialize connection
  const initializeConnection = useCallback(() => {
    if (!socketRef.current) {
      console.error("Socket not connected")
      return
    }

    socketRef.current.emit("get-room-users", roomId, (users: RoomUser[]) => {
      const otherUsers = users.filter((u) => u.socketId !== socketRef.current?.id)

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

  // Handle stream update from settings panel
  const handleStreamUpdate = useCallback(
    (newStream: MediaStream) => {
      // Stop old stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
      }

      // Update refs and state
      localStreamRef.current = newStream
      setLocalStream(newStream)

      // Update video element
      safeSetVideoStream(localVideoRef.current, newStream, true)

      // Update peer connection if it exists
      if (peerRef.current && peerRef.current._pc) {
        const senders = peerRef.current._pc.getSenders()

        // Replace video track
        const videoTrack = newStream.getVideoTracks()[0]
        const videoSender = senders.find((s) => s.track && s.track.kind === "video")
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack)
        }

        // Replace audio track
        const audioTrack = newStream.getAudioTracks()[0]
        const audioSender = senders.find((s) => s.track && s.track.kind === "audio")
        if (audioSender && audioTrack) {
          audioSender.replaceTrack(audioTrack)
        }
      }
    },
    [safeSetVideoStream],
  )

  // Main initialization effect
  useEffect(() => {
    isMountedRef.current = true
    let mounted = true

    const init = async () => {
      // Get media stream first
      const stream = await initializeMediaStream()
      if (!stream || !mounted) return

      // Connect to signaling server
      const socket = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "http://localhost:3001", {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      socketRef.current = socket

      // Socket event handlers
      socket.on("connect", () => {
        console.log("Connected to signaling server")
        mySocketIdRef.current = socket.id
        socket.emit("join-room", { roomId, userId, nickname })
      })

      socket.on("existing-users", (users: RoomUser[]) => {
        console.log("Existing users:", users)
        if (mounted) {
          setTimeout(initializeConnection, 500)
        }
      })

      socket.on("user-joined", (data: any) => {
        console.log("User joined:", data)
        if (mounted && !peerRef.current) {
          setTimeout(initializeConnection, 500)
        }
      })

      socket.on("offer", (data: { senderSocketId: string; offer: Peer.SignalData }) => {
        if (!mounted) return

        console.log("Received offer")

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

      socket.on("answer", (data: { senderSocketId: string; answer: Peer.SignalData }) => {
        if (!mounted || !peerRef.current) return

        console.log("Received answer")
        peerRef.current.signal(data.answer)
      })

      socket.on("ice-candidate", (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
        if (!mounted) return

        if (peerRef.current) {
          peerRef.current.signal({ type: "candidate", candidate: data.candidate } as any)
        } else {
          // Queue ICE candidates if peer not ready
          iceCandidatesQueue.current.push(data.candidate)
        }
      })

      socket.on("user-left", (data: any) => {
        console.log("User left:", data)
        if (peerRef.current) {
          peerRef.current.destroy()
          peerRef.current = null
        }
        setRemoteStream(null)
        setConnectionStatus("disconnected")
      })

      socket.on("disconnect", () => {
        console.log("Disconnected from signaling server")
        setConnectionStatus("disconnected")
      })

      socket.on("reconnect", () => {
        console.log("Reconnected to signaling server")
        socket.emit("join-room", { roomId, userId, nickname })
      })
    }

    init()

    return () => {
      mounted = false
      isMountedRef.current = false
      cleanup()
    }
  }, [roomId, userId, nickname, initializeMediaStream, createPeerConnection, initializeConnection, cleanup])

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      const portrait = window.innerHeight > window.innerWidth
      setIsMobile(mobile)
      setIsPortrait(portrait)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    window.addEventListener("orientationchange", () => {
      setTimeout(checkMobile, 100) // Delay to get accurate dimensions after orientation change
    })

    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("orientationchange", checkMobile)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Error notification */}
      {connectionError && (
        <div className="absolute top-4 right-4 z-50 max-w-xs md:max-w-sm">
          <Card className="p-3 md:p-4 bg-destructive/10 border-destructive">
            <p className="text-xs md:text-sm text-destructive">{connectionError}</p>
          </Card>
        </div>
      )}

      {/* Main video area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Mobile optimized */}
        <div className="bg-card border-b border-border p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <div className="min-w-0">
                <h1 className="text-sm md:text-lg font-semibold truncate">Room: {roomId}</h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{nickname}</p>
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
                className="text-xs"
              >
                {connectionStatus}
              </Badge>
            </div>

            {/* Desktop sidebar controls */}
            <div className="hidden md:flex gap-2">
              <Button
                variant={activeTab === "screen" && showSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTab("screen")
                  setShowSidebar(!showSidebar || activeTab !== "screen")
                }}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "whiteboard" && showSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTab("whiteboard")
                  setShowSidebar(!showSidebar || activeTab !== "whiteboard")
                }}
              >
                <PenTool className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "chat" && showSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTab("chat")
                  setShowSidebar(!showSidebar || activeTab !== "chat")
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "files" && showSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTab("files")
                  setShowSidebar(!showSidebar || activeTab !== "files")
                }}
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "settings" && showSidebar ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setActiveTab("settings")
                  setShowSidebar(!showSidebar || activeTab !== "settings")
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile menu trigger */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-sm">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="screen" className="text-xs">
                        Screen
                      </TabsTrigger>
                      <TabsTrigger value="whiteboard" className="text-xs">
                        Board
                      </TabsTrigger>
                    </TabsList>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="chat" className="text-xs">
                        Chat
                      </TabsTrigger>
                      <TabsTrigger value="files" className="text-xs">
                        Files
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="text-xs">
                        Settings
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="screen" className="h-full">
                      <ScreenShareManager
                        onScreenShare={handleScreenShare}
                        isScreenSharing={isScreenSharing}
                        peerConnection={peerRef.current}
                      />
                    </TabsContent>

                    <TabsContent value="whiteboard" className="h-full p-0">
                      <Whiteboard
                        onDrawingData={handleDrawingData}
                        onReceiveDrawingData={setupWhiteboardReceiver}
                        isVisible={activeTab === "whiteboard"}
                      />
                    </TabsContent>

                    <TabsContent value="chat" className="h-full">
                      <ChatSystem
                        userId={userId}
                        nickname={nickname}
                        dataChannel={dataChannelRef.current}
                        isConnected={connectionStatus === "connected"}
                      />
                    </TabsContent>

                    <TabsContent value="files" className="h-full">
                      <FileSharingSystem
                        dataChannel={dataChannelRef.current}
                        isConnected={connectionStatus === "connected"}
                        userId={userId}
                        nickname={nickname}
                      />
                    </TabsContent>

                    <TabsContent value="settings" className="h-full">
                      <SettingsPanel
                        localStream={localStream}
                        onStreamUpdate={handleStreamUpdate}
                        connectionStatus={connectionStatus}
                        isMobile={isMobile}
                      />
                    </TabsContent>
                  </Tabs>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Video content - Mobile optimized layout */}
        <div
          className="flex-1 p-2 md:p-4 relative"
          onClick={handleUserInteraction}
          onTouchStart={handleUserInteraction}
        >
          <div
            className={`
            ${
              isMobile
                ? isPortrait
                  ? "flex flex-col gap-2 h-full"
                  : "grid grid-cols-2 gap-2 h-full"
                : "grid grid-cols-1 lg:grid-cols-2 gap-4 h-full"
            }
          `}
          >
            {/* Remote video - Primary on mobile */}
            <Card className={`relative overflow-hidden ${isMobile && isPortrait ? "flex-1" : ""}`}>
              <video
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                playsInline
                muted={false}
                style={{ transform: isMobile ? "scaleX(-1)" : "none" }} // Mirror for mobile front camera
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <p className="text-xs md:text-sm text-muted-foreground text-center px-2">
                    Waiting for participant...
                  </p>
                </div>
              )}
              {remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Button
                    onClick={() => handleVideoPlay(false)}
                    size={isMobile ? "default" : "lg"}
                    className="bg-primary/90 hover:bg-primary"
                    variant="default"
                  >
                    <Play className={`${isMobile ? "w-4 h-4" : "w-6 h-6"} mr-2`} />
                    {isMobile ? "Play" : "Click to Play Remote Video"}
                  </Button>
                </div>
              )}
            </Card>

            {/* Local video - Picture-in-picture style on mobile portrait */}
            <Card
              className={`
              relative overflow-hidden 
              ${isMobile && isPortrait ? "h-32 absolute bottom-20 right-2 w-24 z-10 rounded-lg" : ""}
            `}
            >
              <video
                ref={localVideoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                style={{ transform: "scaleX(-1)" }} // Mirror local video
              />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <p className={`text-muted-foreground text-center px-1 ${isMobile ? "text-xs" : "text-sm"}`}>
                    {isMobile ? "Camera..." : "Initializing camera..."}
                  </p>
                </div>
              )}
              {localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Button
                    onClick={() => handleVideoPlay(true)}
                    size={isMobile ? "sm" : "lg"}
                    className="bg-primary/90 hover:bg-primary"
                    variant="default"
                  >
                    <Play className={`${isMobile ? "w-3 h-3" : "w-6 h-6"} ${isMobile ? "" : "mr-2"}`} />
                    {!isMobile && "Click to Play Local Video"}
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {isMobile && (
            <div
              className={`
              absolute bottom-4 left-1/2 transform -translate-x-1/2 
              flex items-center gap-3 bg-black/80 backdrop-blur-sm 
              rounded-full px-4 py-3 transition-opacity duration-300
              ${showMobileControls ? "opacity-100" : "opacity-0 pointer-events-none"}
            `}
            >
              <Button
                variant={isAudioEnabled ? "default" : "destructive"}
                size="sm"
                onClick={toggleAudio}
                disabled={!localStream}
                className="rounded-full w-12 h-12 p-0"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button
                variant={isVideoEnabled ? "default" : "destructive"}
                size="sm"
                onClick={toggleVideo}
                disabled={!localStream}
                className="rounded-full w-12 h-12 p-0"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button variant="destructive" size="sm" onClick={handleLeaveRoom} className="rounded-full w-12 h-12 p-0">
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Desktop controls */}
          {!isMobile && (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant={isAudioEnabled ? "default" : "secondary"} onClick={toggleAudio} disabled={!localStream}>
                {isAudioEnabled ? "Mute" : "Unmute"}
              </Button>
              <Button variant={isVideoEnabled ? "default" : "secondary"} onClick={toggleVideo} disabled={!localStream}>
                {isVideoEnabled ? "Hide Video" : "Show Video"}
              </Button>
              <Button variant="destructive" onClick={handleLeaveRoom}>
                Leave Room
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop sidebar */}
      {showSidebar && !isMobile && (
        <div className="w-96 border-l border-border bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="screen" className="text-xs">
                Screen
              </TabsTrigger>
              <TabsTrigger value="whiteboard" className="text-xs">
                Board
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                Chat
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs">
                Files
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="screen" className="h-full p-4">
              <ScreenShareManager
                onScreenShare={handleScreenShare}
                isScreenSharing={isScreenSharing}
                peerConnection={peerRef.current}
              />
            </TabsContent>

            <TabsContent value="whiteboard" className="h-full p-0">
              <Whiteboard
                onDrawingData={handleDrawingData}
                onReceiveDrawingData={setupWhiteboardReceiver}
                isVisible={activeTab === "whiteboard"}
              />
            </TabsContent>

            <TabsContent value="chat" className="h-full p-4">
              <ChatSystem
                userId={userId}
                nickname={nickname}
                dataChannel={dataChannelRef.current}
                isConnected={connectionStatus === "connected"}
              />
            </TabsContent>

            <TabsContent value="files" className="h-full p-4">
              <FileSharingSystem
                dataChannel={dataChannelRef.current}
                isConnected={connectionStatus === "connected"}
                userId={userId}
                nickname={nickname}
              />
            </TabsContent>

            <TabsContent value="settings" className="h-full p-4">
              <SettingsPanel
                localStream={localStream}
                onStreamUpdate={handleStreamUpdate}
                connectionStatus={connectionStatus}
                isMobile={isMobile}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
