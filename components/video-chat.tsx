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
} from "lucide-react"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { VolumeControl } from "@/components/volume-control"
import { VideoControls } from "@/components/video-controls"
import { ResizablePanel } from "@/components/resizable-panel"

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
  const [isSubtitlesEnabled, setIsSubtitlesEnabled] = useState(false)
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
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

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController>(new AbortController())

  // Complete manual video control without autoPlay
  const setVideoStream = useCallback((videoElement: HTMLVideoElement | null, stream: MediaStream | null, isLocal = false) => {
    if (!videoElement || !isMountedRef.current) return

    try {
      // Stop any existing playback immediately
      videoElement.pause()
      videoElement.srcObject = null
      
      if (stream) {
        videoElement.srcObject = stream
        videoElement.muted = isLocal // Local video is always muted to prevent feedback
        
        // Update playing state
        if (isLocal) {
          setLocalVideoPlaying(false)
        } else {
          setRemoteVideoPlaying(false)
        }
      }
    } catch (error) {
      console.error("[v0] Error setting video stream:", error)
    }
  }, [])

  // Manual play function that requires user interaction
  const playVideo = useCallback(async (videoElement: HTMLVideoElement | null, isLocal = false) => {
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
  }, [userInteracted])

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
      setRemoteStream(remoteStream)
      setVideoStream(remoteVideoRef.current, remoteStream, false)
    }

    return peerConnection
  }, [setVideoStream])

  useEffect(() => {
    isMountedRef.current = true
    abortControllerRef.current = new AbortController()

    const initializeCall = async () => {
      if (!isMountedRef.current) return

      try {
        const peerConnection = initializePeerConnection()

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
        })

        if (!isMountedRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setLocalStream(stream)
        setVideoStream(localVideoRef.current, stream, true)

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream)
        })
      } catch (error) {
        console.error("Error accessing media devices:", error)
        if (isMountedRef.current) {
          setConnectionStatus("disconnected")
        }
      }
    }

    initializeCall()

    return () => {
      isMountedRef.current = false
      abortControllerRef.current.abort()

      if (localVideoRef.current) {
        localVideoRef.current.pause()
        localVideoRef.current.srcObject = null
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause()
        remoteVideoRef.current.srcObject = null
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [initializePeerConnection, setVideoStream])

  // Handle user interaction to enable video playback
  const handleUserInteraction = useCallback(() => {
    if (!userInteracted) {
      setUserInteracted(true)
      // Auto-play videos after user interaction
      if (localVideoRef.current && localStream) {
        playVideo(localVideoRef.current, true)
      }
      if (remoteVideoRef.current && remoteStream) {
        playVideo(remoteVideoRef.current, false)
      }
    }
  }, [userInteracted, localStream, remoteStream, playVideo])

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

        if (peerConnectionRef.current && localStream) {
          const videoTrack = localStream.getVideoTracks()[0]
          const screenTrack = screenShareStream.getVideoTracks()[0]

          const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video")

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

      if (peerConnectionRef.current && localStream) {
        const videoTrack = localStream.getVideoTracks()[0]
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video")

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
    if (remoteVideoRef.current && isMountedRef.current) {
      try {
        if (!document.pictureInPictureElement) {
          await remoteVideoRef.current.requestPictureInPicture()
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
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newVolume / 100
    }
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
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">Room: {roomId}</h1>
              <p className="text-sm text-muted-foreground">Connected as {nickname}</p>
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

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Video Area */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Remote Video */}
            <ResizablePanel
              defaultWidth={640}
              defaultHeight={480}
              minWidth={320}
              minHeight={240}
              className="video-container relative group"
            >
              <div className="relative h-full">
                {remoteStream ? (
                  <div className="relative h-full">
                    <video
                      ref={remoteVideoRef}
                      className="video-element"
                      playsInline
                      muted={false}
                      onVolumeChange={(e) => setAudioOutputLevel(e.currentTarget.volume * 100)}
                    />
                    {!remoteVideoPlaying && userInteracted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => playVideo(remoteVideoRef.current, false)}
                          className="bg-white/90 hover:bg-white"
                        >
                          <Play className="w-6 h-6 mr-2" />
                          Play Video
                        </Button>
                      </div>
                    )}
                    {!userInteracted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-center text-white">
                          <Play className="w-12 h-12 mx-auto mb-2" />
                          <p>Click anywhere to enable video playback</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-muted">
                    <div className="text-center">
                      <Video className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Waiting for participant...</p>
                      <Badge variant="secondary" className="mt-2">
                        {connectionStatus}
                      </Badge>
                    </div>
                  </div>
                )}

                <VideoControls
                  isVisible={!!remoteStream}
                  onFullscreen={toggleFullscreen}
                  onPictureInPicture={togglePictureInPicture}
                  isFullscreen={isFullscreen}
                  isPiPEnabled={isPiPEnabled}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                />

                {remoteStream && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <AudioVisualizer stream={remoteStream} isEnabled={true} />
                  </div>
                )}

                {(isSubtitlesEnabled || isTranslationEnabled) && remoteStream && (
                  <div className="absolute bottom-16 left-4 right-4 space-y-2">
                    {currentTranscript && (
                      <div className="bg-black/80 text-white p-3 rounded-lg text-center">
                        <div className="text-sm opacity-75 mb-1">Original:</div>
                        <div>{currentTranscript}</div>
                        {currentTranslation && isTranslationEnabled && (
                          <>
                            <div className="text-sm opacity-75 mt-2 mb-1">Translation:</div>
                            <div className="text-accent-foreground">{currentTranslation}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ResizablePanel>

            {/* Local Video */}
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

          {/* Enhanced Control Bar */}
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
                  disabled={!remoteStream}
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

        {/* Side Panels */}
        {showChat && (
          <div className="w-80 border-l border-border">
            <Chat\
