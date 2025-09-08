"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Video, VideoOff, Shuffle, Copy, Check, AlertCircle, Loader2 } from "lucide-react"
import { DeviceSelector } from "@/components/device-selector"
import { AudioVisualizer } from "@/components/audio-visualizer"

interface RoomSetupProps {
  onJoinRoom: (roomId: string, nickname: string) => void
  userId: string
  initialRoomId?: string // Added optional initial room ID prop
}

export function RoomSetup({ onJoinRoom, userId, initialRoomId }: RoomSetupProps) {
  const searchParams = useSearchParams()
  const [roomId, setRoomId] = useState(initialRoomId || "")
  const [nickname, setNickname] = useState("")
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: PermissionState | null
    microphone: PermissionState | null
  }>({ camera: null, microphone: null })
  const [copied, setCopied] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState<{
    camera: string
    microphone: string
    speaker: string
  }>({ camera: "", microphone: "", speaker: "" })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const initializeMedia = async () => {
      setIsLoading(true)
      setMediaError(null)

      try {
        // Check permissions first
        const cameraPermission = await navigator.permissions.query({ name: "camera" as PermissionName })
        const microphonePermission = await navigator.permissions.query({ name: "microphone" as PermissionName })

        setPermissionStatus({
          camera: cameraPermission.state,
          microphone: microphonePermission.state,
        })

        const videoConstraints = isMobile
          ? {
              deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined,
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
              frameRate: { ideal: 15, max: 30 },
              facingMode: "user",
            }
          : {
              deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }

        const constraints: MediaStreamConstraints = {
          video: isVideoEnabled ? videoConstraints : false,
          audio: isAudioEnabled
            ? {
                deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: isMobile ? 16000 : 48000,
              }
            : false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        setLocalStream(stream)
        setMediaError(null)
      } catch (error) {
        console.error("Error accessing media devices:", error)
        if (error instanceof Error) {
          if (error.name === "NotAllowedError") {
            setMediaError("Camera and microphone access denied. Please allow permissions and refresh the page.")
          } else if (error.name === "NotFoundError") {
            setMediaError("No camera or microphone found. Please connect your devices.")
          } else if (error.name === "NotReadableError") {
            setMediaError("Camera or microphone is already in use by another application.")
          } else {
            setMediaError(`Media error: ${error.message}`)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeMedia()

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isVideoEnabled, isAudioEnabled, selectedDevices, isMobile])

  useEffect(() => {
    const nicknameFromUrl = searchParams.get("nickname")
    if (nicknameFromUrl) {
      setNickname(decodeURIComponent(nicknameFromUrl))
    }
  }, [searchParams])

  const generateRoomId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setRoomId(result)
  }

  const copyRoomId = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error("Failed to copy room ID:", error)
      }
    }
  }

  const validateNickname = (value: string) => {
    // Allow Unicode characters, letters, numbers, spaces, and common punctuation
    const unicodeRegex = /^[\p{L}\p{N}\p{Z}\p{P}]{1,30}$/u
    return unicodeRegex.test(value.trim())
  }

  const validateRoomId = (value: string) => {
    // Room ID should be alphanumeric, 4-20 characters
    const roomRegex = /^[A-Za-z0-9]{4,20}$/
    return roomRegex.test(value.trim())
  }

  const handleJoin = () => {
    if (roomId.trim() && nickname.trim() && validateNickname(nickname) && validateRoomId(roomId)) {
      onJoinRoom(roomId.trim().toUpperCase(), nickname.trim())
    }
  }

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled)
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
      }
    }
  }

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled)
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
      }
    }
  }

  const isFormValid = roomId.trim() && nickname.trim() && validateNickname(nickname) && validateRoomId(roomId)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-2 md:p-4">
      <div
        className={`
        w-full max-w-6xl 
        ${isMobile ? "flex flex-col gap-4" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}
      `}
      >
        <Card className={`${isMobile ? "order-1" : "order-2 lg:order-1 lg:col-span-2"}`}>
          <CardHeader>
            <CardTitle className={isMobile ? "text-base" : undefined}>Camera Preview</CardTitle>
            <CardDescription className={isMobile ? "text-sm" : undefined}>
              Check your camera and audio before joining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`video-container ${isMobile ? "aspect-video" : "aspect-video"}`}>
              {isLoading ? (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center">
                    <Loader2 className={`${isMobile ? "w-6 h-6" : "w-8 h-8"} text-primary mx-auto mb-2 animate-spin`} />
                    <p className={`text-muted-foreground ${isMobile ? "text-sm" : ""}`}>Initializing camera...</p>
                  </div>
                </div>
              ) : mediaError ? (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center max-w-sm px-4">
                    <AlertCircle className={`${isMobile ? "w-8 h-8" : "w-12 h-12"} text-destructive mx-auto mb-2`} />
                    <p className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}>{mediaError}</p>
                  </div>
                </div>
              ) : isVideoEnabled && localStream ? (
                <video
                  ref={(video) => {
                    if (video && localStream) {
                      video.srcObject = localStream
                      // Only set srcObject, no automatic playback
                    }
                  }}
                  className="video-element"
                  muted
                  playsInline
                  style={{ transform: "scaleX(-1)" }} // Mirror for better UX
                  controls // Added controls so user can manually play if needed
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center">
                    <VideoOff
                      className={`${isMobile ? "w-12 h-12" : "w-16 h-16"} text-muted-foreground mx-auto mb-2`}
                    />
                    <p className={`text-muted-foreground ${isMobile ? "text-sm" : ""}`}>Camera disabled</p>
                  </div>
                </div>
              )}
            </div>

            {!mediaError && <AudioVisualizer stream={localStream} isEnabled={isAudioEnabled} />}

            <div className={`flex justify-center ${isMobile ? "gap-6" : "gap-4"}`}>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size={isMobile ? "default" : "icon"}
                  onClick={toggleVideo}
                  disabled={isLoading || !!mediaError}
                  className={`${isVideoEnabled ? "control-button active" : "control-button inactive"} ${
                    isMobile ? "w-16 h-16 rounded-full" : ""
                  }`}
                >
                  {isVideoEnabled ? (
                    <Video className={`${isMobile ? "w-6 h-6" : "w-5 h-5"}`} />
                  ) : (
                    <VideoOff className={`${isMobile ? "w-6 h-6" : "w-5 h-5"}`} />
                  )}
                </Button>
                <Badge variant={permissionStatus.camera === "granted" ? "default" : "destructive"} className="text-xs">
                  {permissionStatus.camera === "granted" ? "Allowed" : "Denied"}
                </Badge>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size={isMobile ? "default" : "icon"}
                  onClick={toggleAudio}
                  disabled={isLoading || !!mediaError}
                  className={`${isAudioEnabled ? "control-button active" : "control-button inactive"} ${
                    isMobile ? "w-16 h-16 rounded-full" : ""
                  }`}
                >
                  {isAudioEnabled ? (
                    <Mic className={`${isMobile ? "w-6 h-6" : "w-5 h-5"}`} />
                  ) : (
                    <MicOff className={`${isMobile ? "w-6 h-6" : "w-5 h-5"}`} />
                  )}
                </Button>
                <Badge
                  variant={permissionStatus.microphone === "granted" ? "default" : "destructive"}
                  className="text-xs"
                >
                  {permissionStatus.microphone === "granted" ? "Allowed" : "Denied"}
                </Badge>
              </div>
            </div>

            {!isMobile && <DeviceSelector onDeviceChange={setSelectedDevices} />}
          </CardContent>
        </Card>

        <Card className={`${isMobile ? "order-2" : "order-1 lg:order-2"}`}>
          <CardHeader>
            <CardTitle className={isMobile ? "text-base" : undefined}>Join Video Chat</CardTitle>
            <CardDescription className={isMobile ? "text-sm" : undefined}>
              Enter room details to start your 1:1 video call
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname" className={isMobile ? "text-sm" : undefined}>
                Your Nickname
              </Label>
              <Input
                id="nickname"
                placeholder="Enter your nickname (한글, 中文, English supported)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={`${isMobile ? "text-base h-12" : "text-base"} ${nickname && !validateNickname(nickname) ? "border-destructive" : ""}`}
                maxLength={30}
              />
              {nickname && !validateNickname(nickname) && (
                <p className="text-xs text-destructive">
                  Nickname must be 1-30 characters and contain only letters, numbers, and basic punctuation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId" className={isMobile ? "text-sm" : undefined}>
                Room ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="roomId"
                  placeholder="Enter or generate room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className={`${isMobile ? "text-base h-12" : "text-base"} ${roomId && !validateRoomId(roomId) ? "border-destructive" : ""}`}
                  maxLength={20}
                />
                <Button
                  variant="outline"
                  onClick={generateRoomId}
                  size={isMobile ? "default" : "icon"}
                  className={isMobile ? "h-12 px-4" : ""}
                >
                  <Shuffle className={`${isMobile ? "w-5 h-5" : "w-4 h-4"}`} />
                </Button>
                {roomId && (
                  <Button
                    variant="outline"
                    onClick={copyRoomId}
                    size={isMobile ? "default" : "icon"}
                    className={isMobile ? "h-12 px-4" : ""}
                  >
                    {copied ? (
                      <Check className={`${isMobile ? "w-5 h-5" : "w-4 h-4"}`} />
                    ) : (
                      <Copy className={`${isMobile ? "w-5 h-5" : "w-4 h-4"}`} />
                    )}
                  </Button>
                )}
              </div>
              {roomId && !validateRoomId(roomId) && (
                <p className="text-xs text-destructive">
                  Room ID must be 4-20 characters and contain only letters and numbers
                </p>
              )}
              {copied && <p className="text-xs text-accent">Room ID copied to clipboard!</p>}
            </div>

            <div
              className={`text-muted-foreground bg-muted p-3 rounded-lg space-y-2 ${isMobile ? "text-sm" : "text-sm"}`}
            >
              <div>
                <strong>Your User ID:</strong>
                <code className="ml-1 text-xs bg-background px-1 rounded">{userId}</code>
              </div>
              <p>Share the Room ID with the person you want to chat with.</p>
              <p className="text-xs">Supports Unicode text input for international users.</p>
            </div>

            {mediaError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className={isMobile ? "text-sm" : undefined}>{mediaError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleJoin}
              disabled={!isFormValid || isLoading || !!mediaError}
              className={`w-full ${isMobile ? "h-12 text-base" : ""}`}
              size={isMobile ? "default" : "lg"}
            >
              {isLoading ? (
                <>
                  <Loader2 className={`${isMobile ? "w-5 h-5" : "w-4 h-4"} mr-2 animate-spin`} />
                  Initializing...
                </>
              ) : (
                "Join Room"
              )}
            </Button>

            {!isFormValid && roomId && nickname && (
              <p className="text-xs text-muted-foreground text-center">Please check your nickname and room ID format</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
