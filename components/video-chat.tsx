"use client"
// video-chat.tsx

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MessageCircle, Monitor, Settings, Share, Menu } from "lucide-react"
import io, { type Socket } from "socket.io-client"
import Peer from "simple-peer"
import { ICE_SERVERS, MEDIA_CONSTRAINTS } from "@/config/mediaConfig"
import { ChatSystem } from "./chat-system"
import { ScreenShare } from "./screen-share"
import { DeviceSettings } from "./device-settings"
import { FileSharing } from "./file-sharing"

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
  isPolite?: boolean
}

interface Message {
  id: string
  userId: string
  nickname: string
  content: string
  timestamp: Date
  type: "text" | "file"
}

interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  progress?: number
  status: "uploading" | "completed" | "failed"
}

export function VideoChat({ roomId, userId, nickname, onLeaveRoom }: VideoChatProps) {
  // State management
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sharedFiles, setSharedFiles] = useState<FileInfo[]>([])
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Connection status type and constants
  type ConnectionStatus = "connecting" | "connected" | "disconnected" | "failed"
  const CONNECTION_STATUS: Record<ConnectionStatus, ConnectionStatus> = {
    connecting: "connecting",
    connected: "connected",
    disconnected: "disconnected",
    failed: "failed",
  } as const

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(CONNECTION_STATUS.connecting)

  // Custom setter with logging and validation
  const setConnectionStatusWithLogging = (status: ConnectionStatus) => {
    // Validate status
    if (!Object.values(CONNECTION_STATUS).includes(status)) {
      console.warn(`Invalid connection status: ${status}`)
      return
    }

    console.log(`Connection status changed from ${connectionStatus} to ${status}`)
    setConnectionStatus(status)
  }
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<Peer.Instance | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([])

  // Perfect Negotiation Pattern을 위한 상태
  const isPolite = useRef(false)
  const makingOffer = useRef(false)
  const ignoreOffer = useRef(false)
  const isSettingRemoteAnswerPending = useRef(false)
  const targetSocketIdRef = useRef<string | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("Cleaning up resources...")

    if (peerRef.current) {
      try {
        peerRef.current.destroy()
      } catch (e) {
        console.error("Error destroying peer:", e)
      }
      peerRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      localStreamRef.current = null
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setLocalStream(null)
    setRemoteStream(null)
    setConnectionStatusWithLogging(CONNECTION_STATUS.disconnected)
  }, [])

  // Initialize media stream
  const initializeMediaStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = MEDIA_CONSTRAINTS

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      return stream
    } catch (error) {
      console.error("Error accessing media devices:", error)
      setConnectionError("Failed to access camera/microphone")

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

  // Create peer connection
  const createPeerConnection = useCallback((initiator: boolean, targetSocketId: string): Peer.Instance | null => {
    if (!localStreamRef.current) {
      console.error("No local stream available")
      return null
    }

    // 기존 peer가 있고 연결되어 있으면 재사용
    if (peerRef.current && !peerRef.current.destroyed) {
      console.log("Reusing existing peer connection")
      return peerRef.current
    }

    try {
      console.log(`Creating peer connection as ${initiator ? "initiator" : "responder"}, polite: ${isPolite.current}`)

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: localStreamRef.current,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        },
      })

      peer.on("signal", (data: Peer.SignalData) => {
        if (!socketRef.current) return

        if (data.type === "offer") {
          makingOffer.current = true
          socketRef.current.emit("offer", {
            targetSocketId,
            offer: data,
            polite: isPolite.current,
          })
          makingOffer.current = false
        } else if (data.type === "answer") {
          socketRef.current.emit("answer", {
            targetSocketId,
            answer: data,
          })
          isSettingRemoteAnswerPending.current = false
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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      })

      peer.on("connect", () => {
        console.log("Peer connection established")
        setConnectionStatusWithLogging(CONNECTION_STATUS.connected)
        setConnectionError(null)

        // Process queued ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift()
          if (candidate) {
            peer.signal({ type: "candidate", candidate } as any)
          }
        }
      })

      peer.on("error", (err: Error) => {
        console.error("Peer error:", err)
        // stable state 에러는 무시 (자동 복구됨)
        if (!err.message?.includes("stable")) {
          setConnectionError(err.message)
          setConnectionStatusWithLogging(CONNECTION_STATUS.failed)
        }
      })

      peer.on("close", () => {
        console.log("Peer connection closed")
        setConnectionStatusWithLogging(CONNECTION_STATUS.disconnected)
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

  // Chat message handler
  const handleSendMessage = useCallback(
    (content: string) => {
      const message: Message = {
        id: Date.now().toString(),
        userId,
        nickname,
        content,
        timestamp: new Date(),
        type: "text",
      }

      setMessages((prev) => [...prev, message])

      if (socketRef.current) {
        socketRef.current.emit("chat-message", {
          roomId,
          message,
        })
      }
    },
    [roomId, userId, nickname],
  )

  // Screen share handler
  const handleScreenShare = useCallback(async (stream: MediaStream | null) => {
    if (stream) {
      setIsScreenSharing(true)
      // Replace video track in peer connection
      if (peerRef.current && localStreamRef.current) {
        const videoTrack = stream.getVideoTracks()[0]
        const sender = peerRef.current._pc?.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        }
      }
    } else {
      setIsScreenSharing(false)
      // Restore camera
      if (peerRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        const sender = peerRef.current._pc?.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        }
      }
    }
  }, [])

  // File share handler
  const handleFileShare = useCallback((file: File) => {
    const fileInfo: FileInfo = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading",
      progress: 0,
    }

    setSharedFiles((prev) => [...prev, fileInfo])

    // Simulate file upload progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setSharedFiles((prev) => prev.map((f) => (f.id === fileInfo.id ? { ...f, progress } : f)))

      if (progress >= 100) {
        clearInterval(interval)
        setSharedFiles((prev) =>
          prev.map((f) => (f.id === fileInfo.id ? { ...f, status: "completed", progress: undefined } : f)),
        )
      }
    }, 200)
  }, [])

  // Device change handler
  const handleDeviceChange = useCallback(async (type: "video" | "audio", deviceId: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: type === "video" ? { deviceId: { exact: deviceId } } : true,
        audio: type === "audio" ? { deviceId: { exact: deviceId } } : true,
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (type === "video") {
        const videoTrack = newStream.getVideoTracks()[0]
        if (peerRef.current) {
          const sender = peerRef.current._pc?.getSenders().find((s) => s.track && s.track.kind === "video")
          if (sender) {
            await sender.replaceTrack(videoTrack)
          }
        }

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((track) => track.stop())
          localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0])
          localStreamRef.current.addTrack(videoTrack)
        }
      } else {
        const audioTrack = newStream.getAudioTracks()[0]
        if (peerRef.current) {
          const sender = peerRef.current._pc?.getSenders().find((s) => s.track && s.track.kind === "audio")
          if (sender) {
            await sender.replaceTrack(audioTrack)
          }
        }

        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => track.stop())
          localStreamRef.current.removeTrack(localStreamRef.current.getAudioTracks()[0])
          localStreamRef.current.addTrack(audioTrack)
        }
      }
    } catch (error) {
      console.error("Error changing device:", error)
    }
  }, [])

  // Main initialization effect
  useEffect(() => {
    let mounted = true

    const init = async () => {
      const stream = await initializeMediaStream()
      if (!stream || !mounted) return

      const socket = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "http://localhost:3001", {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      socketRef.current = socket

      socket.on("connect", () => {
        console.log("Connected to signaling server")
        socket.emit("join-room", { roomId, userId, nickname })
      })

      socket.on("chat-message", (data: { message: Message }) => {
        setMessages((prev) => [...prev, data.message])
      })

      socket.on("existing-users", (users: RoomUser[]) => {
        console.log("Existing users:", users)

        if (users.length === 0) {
          // 첫 번째 유저
          isPolite.current = false
          console.log("First user in room, waiting for others...")
        } else {
          // 두 번째 유저
          isPolite.current = true
          const targetUser = users[0]
          targetSocketIdRef.current = targetUser.socketId

          // 두 번째 유저가 즉시 offer 생성
          console.log("Second user, creating offer immediately")
          peerRef.current = createPeerConnection(true, targetUser.socketId)
        }
      })

      socket.on("user-joined", (data: any) => {
        console.log("User joined:", data)

        if (!peerRef.current && !isPolite.current) {
          // 첫 번째 유저는 두 번째 유저가 들어오면 대기
          targetSocketIdRef.current = data.socketId
          console.log("First user waiting for offer from second user")
        }
      })

      socket.on("offer", async (data: { senderSocketId: string; offer: Peer.SignalData; polite?: boolean }) => {
        if (!mounted) return

        console.log("Received offer")
        targetSocketIdRef.current = data.senderSocketId

        // offer collision 처리
        const offerCollision = makingOffer.current || isSettingRemoteAnswerPending.current
        ignoreOffer.current = isPolite.current && offerCollision

        if (ignoreOffer.current) {
          console.log("Ignoring offer due to collision")
          return
        }

        // impolite peer는 충돌 시 연결 재시작
        if (!isPolite.current && offerCollision) {
          console.log("Offer collision detected, restarting...")
          if (peerRef.current) {
            peerRef.current.destroy()
            peerRef.current = null
          }
        }

        // answer 생성
        if (!peerRef.current || peerRef.current.destroyed) {
          peerRef.current = createPeerConnection(false, data.senderSocketId)
        }

        if (peerRef.current) {
          isSettingRemoteAnswerPending.current = true
          try {
            peerRef.current.signal(data.offer)
          } catch (err) {
            console.error("Error setting remote description:", err)
            isSettingRemoteAnswerPending.current = false
          }
        }
      })

      socket.on("answer", (data: { senderSocketId: string; answer: Peer.SignalData }) => {
        if (!mounted || !peerRef.current) return

        console.log("Received answer")

        if (isSettingRemoteAnswerPending.current) {
          console.log("Already setting remote answer, ignoring")
          return
        }

        try {
          peerRef.current.signal(data.answer)
        } catch (err: any) {
          console.error("Error setting answer:", err)
          // stable state 에러는 무시
          if (!err.message?.includes("stable")) {
            setTimeout(() => {
              if (peerRef.current) {
                peerRef.current.destroy()
                peerRef.current = null
              }
              if (targetSocketIdRef.current) {
                peerRef.current = createPeerConnection(true, targetSocketIdRef.current)
              }
            }, 100)
          }
        }
      })

      socket.on("ice-candidate", (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
        if (!mounted) return

        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            peerRef.current.signal({ type: "candidate", candidate: data.candidate } as any)
          } catch (err) {
            console.log("Buffering ICE candidate")
            iceCandidatesQueue.current.push(data.candidate)
          }
        } else {
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
        setConnectionStatusWithLogging(CONNECTION_STATUS.disconnected)
        targetSocketIdRef.current = null
      })

      socket.on("disconnect", () => {
        console.log("Disconnected from signaling server")
        setConnectionStatusWithLogging(CONNECTION_STATUS.disconnected)
      })

      socket.on("reconnect", () => {
        console.log("Reconnected to signaling server")
        socket.emit("join-room", { roomId, userId, nickname })
      })
    }

    init()

    return () => {
      mounted = false
      cleanup()
    }
  }, [roomId, userId, nickname, initializeMediaStream, createPeerConnection, cleanup])

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
      socketRef.current.emit("leave-room", { roomId })
    }
    cleanup()
    onLeaveRoom()
  }, [roomId, cleanup, onLeaveRoom])

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main video area */}
      <div className="flex-1 flex flex-col">
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

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-0">
                  <Tabs defaultValue="chat" className="h-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="chat">
                        <MessageCircle className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="screen">
                        <Monitor className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="settings">
                        <Settings className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="files">
                        <Share className="h-4 w-4" />
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="chat" className="h-full mt-0">
                      <ChatSystem
                        userId={userId}
                        nickname={nickname}
                        onSendMessage={handleSendMessage}
                        messages={messages}
                      />
                    </TabsContent>
                    <TabsContent value="screen" className="mt-0">
                      <ScreenShare onScreenShare={handleScreenShare} isSharing={isScreenSharing} />
                    </TabsContent>
                    <TabsContent value="settings" className="mt-0">
                      <DeviceSettings
                        onDeviceChange={handleDeviceChange}
                        onVolumeChange={(volume) => console.log("Volume:", volume)}
                        onQualityChange={(quality) => console.log("Quality:", quality)}
                      />
                    </TabsContent>
                    <TabsContent value="files" className="mt-0">
                      <FileSharing
                        onFileShare={handleFileShare}
                        sharedFiles={sharedFiles}
                        onDownloadFile={(fileId) => console.log("Download:", fileId)}
                      />
                    </TabsContent>
                  </Tabs>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            <Card className="relative overflow-hidden">
              <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
              {!remoteStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground">Waiting for participant...</p>
                </div>
              )}
            </Card>

            <Card className="relative overflow-hidden">
              <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <p className="text-muted-foreground">Initializing camera...</p>
                </div>
              )}
            </Card>
          </div>

          {/* Controls */}
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
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block w-80 border-l border-border bg-card">
        <Tabs defaultValue="chat" className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat">
              <MessageCircle className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="screen">
              <Monitor className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="files">
              <Share className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="h-full mt-0">
            <ChatSystem userId={userId} nickname={nickname} onSendMessage={handleSendMessage} messages={messages} />
          </TabsContent>
          <TabsContent value="screen" className="mt-0">
            <ScreenShare onScreenShare={handleScreenShare} isSharing={isScreenSharing} />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <DeviceSettings
              onDeviceChange={handleDeviceChange}
              onVolumeChange={(volume) => console.log("Volume:", volume)}
              onQualityChange={(quality) => console.log("Quality:", quality)}
            />
          </TabsContent>
          <TabsContent value="files" className="mt-0">
            <FileSharing
              onFileShare={handleFileShare}
              sharedFiles={sharedFiles}
              onDownloadFile={(fileId) => console.log("Download:", fileId)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
