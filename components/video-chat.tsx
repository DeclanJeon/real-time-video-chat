"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Users,
  Activity,
  Play as Relay,
} from "lucide-react"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { VolumeControl } from "@/components/volume-control"
import { VideoControls } from "@/components/video-controls"
import { ResizablePanel } from "@/components/resizable-panel"
import { ChatPanel } from "@/components/chat-panel"
import { FileSharePanel } from "@/components/file-share-panel"
import { SpeechToText } from "@/components/speech-to-text"
import { TranslationPanel } from "@/components/translation-panel"
import { PeerDiscoveryPanel } from "@/components/peer-discovery-panel"
import { SystemDiagnosticsPanel } from "@/components/system-diagnostics-panel"
import { RelayStatusPanel } from "@/components/relay-status-panel"
import { HybridP2PManager } from "@/lib/hybrid-p2p-manager"
import { WebRTCManager } from "@/lib/webrtc"
import SocketManager from "@/lib/socket"
import { P2POptimizer, type NetworkQuality, type OptimizationSettings } from "@/lib/p2p-optimizer"

interface VideoChatProps {
  roomId: string
  userId: string
  nickname: string
  onLeaveRoom: () => void
}

export function VideoChat({ roomId, userId, nickname, onLeaveRoom }: VideoChatProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showFileShare, setShowFileShare] = useState(false)
  const [showPeerDiscovery, setShowPeerDiscovery] = useState(false)
  const [isSubtitlesEnabled, setIsSubtitlesEnabled] = useState(false)
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [volume, setVolume] = useState(50)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiPEnabled, setIsPiPEnabled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
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
  const [hybridP2P, setHybridP2P] = useState<HybridP2PManager | null>(null)
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null)
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([])
  const [networkStatus, setNetworkStatus] = useState<any>({})
  const [relayEnabled, setRelayEnabled] = useState(false)
  const [p2pOptimizer, setP2POptimizer] = useState<P2POptimizer | null>(null)
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    latency: 0,
    bandwidth: 0,
    packetLoss: 0,
    jitter: 0,
    score: 0,
  })
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    videoQuality: "auto",
    audioQuality: "auto",
    adaptiveBitrate: true,
    relayPreference: "auto",
    connectionTimeout: 10000,
    maxRetries: 3,
  })
  const [relayMetrics, setRelayMetrics] = useState<any>({
    totalConnections: 0,
    activeRelays: 0,
    bandwidthUsed: 0,
    averageLatency: 0,
    successRate: 0,
  })
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showRelayStatus, setShowRelayStatus] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController>(new AbortController())
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const setVideoStream = useCallback(
    (videoElement: HTMLVideoElement | null, stream: MediaStream | null, isLocal = false) => {
      if (!videoElement || !isMountedRef.current) return

      try {
        videoElement.pause()
        videoElement.srcObject = null

        if (stream) {
          videoElement.srcObject = stream
          videoElement.muted = isLocal

          if (isLocal) {
            setLocalVideoPlaying(false)
          } else {
            setRemoteVideoPlaying(false)
          }
        }
      } catch (error) {
        console.error("[v0] Error setting video stream:", error)
      }
    },
    [],
  )

  const playVideo = useCallback(
    async (videoElement: HTMLVideoElement | null, isLocal = false) => {
      if (!videoElement || !isMountedRef.current || !userInteracted) return

      try {
        if (videoElement.paused && videoElement.srcObject) {
          await videoElement.play()
          if (isLocal) {
            setLocalVideoPlaying(true)
          } else {
            setRemoteVideoPlaying(true)
          }
        }
      } catch (error) {
        console.log("[v0] Video play requires user interaction:", error)
      }
    },
    [userInteracted],
  )

  const initializePeerConnection = useCallback(() => {
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }

    const peerConnection = new RTCPeerConnection(configuration)
    peerConnectionRef.current = peerConnection

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState
      if (state === "connected" || state === "completed") {
        setConnectionStatus("connected")
      } else if (state === "disconnected" || state === "failed") {
        setConnectionStatus("disconnected")
      } else {
        setConnectionStatus("connecting")
      }
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams
      setRemoteStreams((prev) => new Map(prev.set(event.track.id, remoteStream)))
      remoteVideoRefs.current.set(event.track.id, document.createElement("video"))
      setVideoStream(remoteVideoRefs.current.get(event.track.id), remoteStream, false)
    }

    return peerConnection
  }, [setVideoStream])

  useEffect(() => {
    isMountedRef.current = true
    abortControllerRef.current = new AbortController()

    const initializeP2PSystem = async () => {
      if (!isMountedRef.current) return

      try {
        console.log("[v0] Initializing hybrid P2P system")

        const p2pManager = new HybridP2PManager()
        await p2pManager.initialize(roomId, userId, nickname)
        setHybridP2P(p2pManager)

        const optimizer = new P2POptimizer()
        setP2POptimizer(optimizer)

        optimizer.setOnQualityChange((quality) => {
          setNetworkQuality(quality)
        })

        optimizer.setOnSettingsChange((settings) => {
          setOptimizationSettings(settings)
        })

        const socketManager = SocketManager.getInstance()
        const socket = socketManager.connect()

        const webrtc = new WebRTCManager(socket, userId)
        setWebrtcManager(webrtc)

        webrtc.setOnRemoteStream((peerId: string, stream: MediaStream) => {
          console.log("[v0] Received remote stream from:", peerId)
          setRemoteStreams((prev) => new Map(prev.set(peerId, stream)))
          setConnectedPeers((prev) => [...prev.filter((id) => id !== peerId), peerId])
        })

        const videoConstraints = optimizer.getOptimalVideoConstraints()
        const audioConstraints = optimizer.getOptimalAudioConstraints()

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        })

        if (!isMountedRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setLocalStream(stream)
        setVideoStream(localVideoRef.current, stream, true)
        webrtc.setLocalStream(stream)

        socket.emit("join-room", { roomId, userId, nickname })

        const statusInterval = setInterval(() => {
          if (p2pManager && isMountedRef.current) {
            const status = p2pManager.getNetworkStatus()
            setNetworkStatus(status)
            setDiscoveredPeers(p2pManager.getDiscoveredPeers())

            const relayMetrics = p2pManager.getRelayMetrics()
            if (relayMetrics) {
              setRelayMetrics(relayMetrics)
            }

            if (status.libp2pConnected || status.socketConnected) {
              setConnectionStatus("connected")
            } else {
              setConnectionStatus("connecting")
            }
          }
        }, 2000)

        return () => {
          clearInterval(statusInterval)
        }
      } catch (error) {
        console.error("Error initializing P2P system:", error)
        if (isMountedRef.current) {
          setConnectionStatus("disconnected")
        }
      }
    }

    initializeP2PSystem()

    return () => {
      isMountedRef.current = false
      abortControllerRef.current.abort()

      if (localVideoRef.current) {
        localVideoRef.current.pause()
        localVideoRef.current.srcObject = null
      }

      remoteVideoRefs.current.forEach((video) => {
        video.pause()
        video.srcObject = null
      })

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop())
      }

      if (hybridP2P) {
        hybridP2P.stop()
      }

      if (p2pOptimizer) {
        p2pOptimizer.stopQualityMonitoring()
      }
    }
  }, [roomId, userId, nickname])

  const toggleRelay = useCallback(async () => {
    if (hybridP2P) {
      try {
        await hybridP2P.enableRelay()
        setRelayEnabled(!relayEnabled)
        console.log("[v0] Relay functionality toggled:", !relayEnabled)
      } catch (error) {
        console.error("[v0] Failed to toggle relay:", error)
      }
    }
  }, [hybridP2P, relayEnabled])

  const handleUserInteraction = useCallback(() => {
    if (!userInteracted) {
      setUserInteracted(true)
      if (localVideoRef.current && localStream) {
        playVideo(localVideoRef.current, true)
      }
      Array.from(remoteVideoRefs.current.values()).forEach((video) => {
        if (video && video.srcObject) {
          playVideo(video, false)
        }
      })
    }
  }, [userInteracted, localStream])

  const toggleVideo = useCallback(() => {
    handleUserInteraction()
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
        setIsVideoEnabled(!isVideoEnabled)
      }
    }
  }, [localStream, isVideoEnabled, handleUserInteraction])

  const toggleAudio = useCallback(() => {
    handleUserInteraction()
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }, [localStream, isAudioEnabled, handleUserInteraction])

  const toggleScreenShare = useCallback(async () => {
    handleUserInteraction()
    if (!isMountedRef.current) return

    if (!isScreenSharing) {
      try {
        const screenShareStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        })

        if (!isMountedRef.current) {
          screenShareStream.getTracks().forEach((track) => track.stop())
          return
        }

        setScreenStream(screenShareStream)
        setIsScreenSharing(true)

        if (webrtcManager && localStream) {
          const videoTrack = localStream.getVideoTracks()[0]
          const screenTrack = screenShareStream.getVideoTracks()[0]

          const sender = webrtcManager.getSenders().find((s) => s.track && s.track.kind === "video")

          if (sender && screenTrack) {
            await sender.replaceTrack(screenTrack)
          }

          screenTrack.onended = () => {
            if (!isMountedRef.current) return
            setIsScreenSharing(false)
            setScreenStream(null)
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack)
            }
            setVideoStream(localVideoRef.current, localStream, true)
            if (userInteracted) {
              playVideo(localVideoRef.current, true)
            }
          }
        }

        setVideoStream(localVideoRef.current, screenShareStream, true)
        if (userInteracted) {
          playVideo(localVideoRef.current, true)
        }
      } catch (error) {
        console.error("Error sharing screen:", error)
      }
    } else {
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop())
        setScreenStream(null)
      }
      setIsScreenSharing(false)

      setVideoStream(localVideoRef.current, localStream, true)
      if (userInteracted) {
        playVideo(localVideoRef.current, true)
      }

      if (webrtcManager && localStream) {
        const videoTrack = localStream.getVideoTracks()[0]
        const sender = webrtcManager.getSenders().find((s) => s.track && s.track.kind === "video")

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        }
      }
    }
  }, [isScreenSharing, screenStream, localStream, setVideoStream, playVideo, userInteracted, handleUserInteraction])

  const toggleFullscreen = useCallback(() => {
    handleUserInteraction()
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [handleUserInteraction])

  const togglePictureInPicture = useCallback(async () => {
    handleUserInteraction()
    if (remoteVideoRefs.current.size > 0 && isMountedRef.current) {
      try {
        const firstRemoteVideo = remoteVideoRefs.current.values().next().value
        if (!document.pictureInPictureElement) {
          await firstRemoteVideo.requestPictureInPicture()
          setIsPiPEnabled(true)
        } else {
          await document.exitPictureInPicture()
          setIsPiPEnabled(false)
        }
      } catch (error) {
        console.error("Picture-in-picture error:", error)
      }
    }
  }, [handleUserInteraction])

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume)
    remoteVideoRefs.current.forEach((video) => {
      if (video) {
        video.volume = newVolume / 100
      }
    })
  }, [])

  const handleTranscript = useCallback(
    (text: string, language: string) => {
      setCurrentTranscript(text)
      const newEntry = {
        text,
        timestamp: new Date(),
        speaker: nickname,
      }
      setSubtitleHistory((prev) => [newEntry, ...prev.slice(0, 49)])
    },
    [nickname],
  )

  const handleTranslation = useCallback((original: string, translated: string, fromLang: string, toLang: string) => {
    setCurrentTranslation(translated)
    setSubtitleHistory((prev) => {
      const updated = [...prev]
      if (updated[0] && updated[0].text === original) {
        updated[0].translation = translated
      }
      return updated
    })
  }, [])

  const toggleSubtitles = useCallback(() => {
    setIsSubtitlesEnabled(!isSubtitlesEnabled)
    setShowSubtitles(!showSubtitles)
  }, [isSubtitlesEnabled, showSubtitles])

  const toggleTranslation = useCallback(() => {
    setIsTranslationEnabled(!isTranslationEnabled)
    setShowTranslation(!showTranslation)
  }, [isTranslationEnabled, showTranslation])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiPEnabled(!!document.pictureInPictureElement)
    }

    document.addEventListener("enterpictureinpicture", handlePiPChange)
    document.addEventListener("leavepictureinpicture", handlePiPChange)

    return () => {
      document.removeEventListener("enterpictureinpicture", handlePiPChange)
      document.removeEventListener("leavepictureinpicture", handlePiPChange)
    }
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex flex-col" onClick={handleUserInteraction}>
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">Room: {roomId}</h1>
              <p className="text-sm text-muted-foreground">Connected as {nickname}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {networkStatus.libp2pConnected ? "P2P" : "Socket"} • {connectedPeers.length} peers
                </Badge>
                {networkStatus.localPeerId && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {networkStatus.localPeerId.slice(0, 8)}...
                  </Badge>
                )}
                <Badge
                  variant={
                    networkQuality.score > 80 ? "default" : networkQuality.score > 50 ? "secondary" : "destructive"
                  }
                  className="text-xs"
                >
                  Quality: {networkQuality.score.toFixed(0)}%
                </Badge>
              </div>
            </div>
            <Badge
              variant={
                connectionStatus === "connected"
                  ? "default"
                  : connectionStatus === "connecting"
                    ? "secondary"
                    : "destructive"
              }
            >
              {connectionStatus === "connected" && "Connected"}
              {connectionStatus === "connecting" && "Connecting..."}
              {connectionStatus === "disconnected" && "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className={showChat ? "bg-accent text-accent-foreground" : ""}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFileShare(!showFileShare)}
              className={showFileShare ? "bg-accent text-accent-foreground" : ""}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPeerDiscovery(!showPeerDiscovery)}
              className={showPeerDiscovery ? "bg-accent text-accent-foreground" : ""}
            >
              <Users className="w-4 h-4 mr-2" />
              Peers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={showDiagnostics ? "bg-accent text-accent-foreground" : ""}
            >
              <Activity className="w-4 h-4 mr-2" />
              Diagnostics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRelayStatus(!showRelayStatus)}
              className={showRelayStatus ? "bg-accent text-accent-foreground" : ""}
            >
              <Relay className="w-4 h-4 mr-2" />
              Relay
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={showSubtitles ? "bg-accent text-accent-foreground" : ""}
            >
              <Subtitles className="w-4 h-4 mr-2" />
              Subtitles
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTranslation(!showTranslation)}
              className={showTranslation ? "bg-accent text-accent-foreground" : ""}
            >
              <Languages className="w-4 h-4 mr-2" />
              Translation
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex relative">
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <ResizablePanel
                key={peerId}
                defaultWidth={640}
                defaultHeight={480}
                minWidth={320}
                minHeight={240}
                className="video-container relative group"
              >
                <div className="relative h-full">
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(peerId, el)
                        setVideoStream(el, stream, false)
                      }
                    }}
                    className="video-element"
                    playsInline
                    muted={false}
                    onVolumeChange={(e) => setAudioOutputLevel(e.currentTarget.volume * 100)}
                  />

                  <div className="absolute top-4 left-4">
                    <Badge variant="default" className="bg-black/50 text-white">
                      Peer: {peerId.slice(0, 8)}...
                    </Badge>
                  </div>

                  <VideoControls
                    isVisible={true}
                    onFullscreen={toggleFullscreen}
                    onPictureInPicture={togglePictureInPicture}
                    isFullscreen={isFullscreen}
                    isPiPEnabled={isPiPEnabled}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="absolute bottom-4 left-4 right-4">
                    <AudioVisualizer stream={stream} isEnabled={true} />
                  </div>
                </div>
              </ResizablePanel>
            ))}

            {remoteStreams.size === 0 && (
              <ResizablePanel
                defaultWidth={640}
                defaultHeight={480}
                minWidth={320}
                minHeight={240}
                className="video-container relative group"
              >
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center">
                    <Video className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Waiting for participants...</p>
                    <Badge variant="secondary" className="mt-2">
                      {connectionStatus}
                    </Badge>
                    <div className="mt-2 text-sm text-muted-foreground">{discoveredPeers.length} peers discovered</div>
                  </div>
                </div>
              </ResizablePanel>
            )}

            <ResizablePanel
              defaultWidth={640}
              defaultHeight={480}
              minWidth={320}
              minHeight={240}
              className="video-container relative group"
            >
              <div className="relative h-full">
                {isVideoEnabled && (localStream || screenStream) ? (
                  <div className="relative h-full">
                    <video ref={localVideoRef} className="video-element" muted playsInline />
                    {!localVideoPlaying && userInteracted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => playVideo(localVideoRef.current, true)}
                          className="bg-white/90 hover:bg-white"
                        >
                          <Play className="w-6 h-6 mr-2" />
                          Play Video
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-muted">
                    <VideoOff className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute top-4 left-4 right-4 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge variant={isVideoEnabled ? "default" : "secondary"}>
                    {isVideoEnabled ? "Camera On" : "Camera Off"}
                  </Badge>
                  {isScreenSharing && (
                    <Badge variant="default" className="bg-accent text-accent-foreground">
                      <Monitor className="w-3 h-3 mr-1" />
                      Screen Sharing
                    </Badge>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <AudioVisualizer stream={localStream} isEnabled={isAudioEnabled} />
                </div>
              </div>
            </ResizablePanel>
          </div>

          <div className="mt-4 flex justify-center">
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleAudio}
                    className={isAudioEnabled ? "control-button active" : "control-button inactive"}
                  >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </Button>
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-100"
                      style={{ width: `${audioInputLevel}%` }}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleVideo}
                  className={isVideoEnabled ? "control-button active" : "control-button inactive"}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleScreenShare}
                  className={isScreenSharing ? "control-button active" : "control-button inactive"}
                >
                  {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </Button>

                <VolumeControl volume={volume} onVolumeChange={handleVolumeChange} />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="control-button inactive bg-transparent"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePictureInPicture}
                  disabled={remoteStreams.size === 0}
                  className={isPiPEnabled ? "control-button active" : "control-button inactive bg-transparent"}
                >
                  <PictureInPicture className="w-5 h-5" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleSubtitles}
                  className={isSubtitlesEnabled ? "control-button active" : "control-button inactive bg-transparent"}
                >
                  <Subtitles className="w-5 h-5" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleTranslation}
                  className={isTranslationEnabled ? "control-button active" : "control-button inactive bg-transparent"}
                >
                  <Languages className="w-5 h-5" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={onLeaveRoom}
                  className="control-button danger bg-transparent"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {showDiagnostics && (
          <div className="w-96 border-l border-border">
            <SystemDiagnosticsPanel
              networkQuality={networkQuality}
              optimizationSettings={optimizationSettings}
              relayMetrics={relayMetrics}
              onRunDiagnostics={() => {
                if (p2pOptimizer && hybridP2P) {
                  // Run comprehensive diagnostics
                  console.log("[v0] Running system diagnostics")
                }
              }}
              onOptimizeSettings={() => {
                if (p2pOptimizer) {
                  // Auto-optimize settings based on current conditions
                  console.log("[v0] Auto-optimizing settings")
                }
              }}
              onUpdateSettings={(newSettings) => {
                if (p2pOptimizer) {
                  p2pOptimizer.updateSettings(newSettings)
                }
              }}
            />
          </div>
        )}

        {showRelayStatus && (
          <div className="w-80 border-l border-border">
            <RelayStatusPanel
              metrics={relayMetrics}
              connections={hybridP2P?.getActiveRelayConnections() || []}
              isEnabled={relayEnabled}
              onToggleRelay={toggleRelay}
              onOptimizeRelay={() => {
                console.log("[v0] Optimizing relay connections")
              }}
            />
          </div>
        )}

        {showChat && (
          <div className="w-80 border-l border-border">
            <ChatPanel
              roomId={roomId}
              userId={userId}
              nickname={nickname}
              onSendMessage={(message) => {
                if (hybridP2P) {
                  hybridP2P.sendMessage({ type: "chat", content: message })
                }
              }}
            />
          </div>
        )}

        {showFileShare && (
          <div className="w-80 border-l border-border">
            <FileSharePanel
              roomId={roomId}
              userId={userId}
              nickname={nickname}
              onShareFile={(fileData) => {
                if (hybridP2P) {
                  hybridP2P.sendMessage({ type: "file", content: fileData })
                }
              }}
            />
          </div>
        )}

        {showPeerDiscovery && (
          <div className="w-80 border-l border-border">
            <PeerDiscoveryPanel
              peers={discoveredPeers}
              connectedPeers={discoveredPeers.filter((p) => p.isConnected)}
              localPeerId={networkStatus.localPeerId}
              localMultiaddrs={networkStatus.localMultiaddrs || []}
              relayEnabled={relayEnabled}
              onToggleRelay={toggleRelay}
            />
          </div>
        )}

        {showSubtitles && (
          <div className="w-80 border-l border-border">
            <SpeechToText isEnabled={isSubtitlesEnabled} onTranscript={handleTranscript} stream={localStream} />
          </div>
        )}

        {showTranslation && (
          <div className="w-80 border-l border-border">
            <TranslationPanel
              isEnabled={isTranslationEnabled}
              transcript={currentTranscript}
              onTranslation={handleTranslation}
            />
          </div>
        )}
      </div>
    </div>
  )
}
