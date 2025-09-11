"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Video, VideoOff, Shuffle, Copy, Check, AlertCircle, Loader2 } from "lucide-react"
import { DeviceSelector } from "@/components/device-selector"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { generateRoomId, validateNickname, validateRoomId, generateUserId } from "@/lib/utils" // generateUserId 임포트
import { MEDIA_DEVICE_CONSTRAINTS } from "@/store/mediaConfig"
import { useUserStore } from "@/store/userConfig" // useUserStore import

interface RoomSetupProps {
  onJoinRoom: (roomId: string, nickname: string) => void
  // userId: string // userId props 제거
}

export function RoomSetup({ onJoinRoom }: RoomSetupProps) {
  // userId props 제거
  const [roomId, setRoomId] = useState("")
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: PermissionState | null
    microphone: PermissionState | null
  }>({ camera: null, microphone: null })
  const [copied, setCopied] = useState(false)

  // Zustand store에서 상태와 액션을 가져옵니다.
  const {
    nickname,
    setNickname,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    selectedDevices,
    setSelectedDevices,
    setUserId, // userId도 Zustand store에서 관리
    id: userId, // userId를 Zustand store에서 가져옵니다.
  } = useUserStore()

  useEffect(() => {
    // userId를 Zustand store에 설정 (초기 렌더링 시 한 번만)
    setUserId(generateUserId())
  }, [setUserId]) // setUserId만 의존성 배열에 포함

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

        // Get media stream with selected devices
        const constraints: MediaStreamConstraints = MEDIA_DEVICE_CONSTRAINTS(
          isVideoEnabled,
          isAudioEnabled,
          selectedDevices,
        )

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
  }, [isVideoEnabled, isAudioEnabled, selectedDevices, setIsAudioEnabled, setIsVideoEnabled]) // 의존성 배열에 추가된 Zustand setter 함수

  const setGenerateRoomId = () => {
    setRoomId(generateRoomId())
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

  const handleJoin = () => {
    if (roomId.trim() && nickname.trim() && validateNickname(nickname) && validateRoomId(roomId)) {
      onJoinRoom(roomId.trim().toUpperCase(), nickname.trim())
    }
  }

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled) // Zustand store 업데이트
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
      }
    }
  }

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled) // Zustand store 업데이트
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
      }
    }
  }

  const handleDeviceChange = useCallback(
    (devices: { camera: string; microphone: string; speaker: string }) => {
      setSelectedDevices(devices) // Zustand store 업데이트
    },
    [setSelectedDevices],
  ) // setSelectedDevices는 stable한 참조이므로 의존성 배열에 추가해도 문제 없음

  const isFormValid = roomId.trim() && nickname.trim() && validateNickname(nickname) && validateRoomId(roomId)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Preview */}
        <Card className="order-2 lg:order-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Camera Preview</CardTitle>
            <CardDescription>Check your camera and audio before joining</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="video-container aspect-video">
              {isLoading ? (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                    <p className="text-muted-foreground">Initializing camera...</p>
                  </div>
                </div>
              ) : mediaError ? (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center max-w-sm">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{mediaError}</p>
                  </div>
                </div>
              ) : isVideoEnabled && localStream ? (
                <video
                  ref={(video) => {
                    if (video && localStream) {
                      if (video.srcObject !== localStream) {
                        video.srcObject = localStream
                      }
                      if (video.readyState >= 2 && video.paused) {
                        video.play().catch((error) => {
                          if (error.name !== "AbortError") {
                            console.error("Video play error:", error)
                          }
                        })
                      }
                    }
                  }}
                  className="video-element"
                  muted
                  playsInline
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted">
                  <div className="text-center">
                    <VideoOff className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Camera disabled</p>
                  </div>
                </div>
              )}
            </div>

            {!mediaError && <AudioVisualizer stream={localStream} isEnabled={isAudioEnabled} />}

            <div className="flex justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleVideo}
                  disabled={isLoading || !!mediaError}
                  className={isVideoEnabled ? "control-button active" : "control-button inactive"}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
                <Badge variant={permissionStatus.camera === "granted" ? "default" : "destructive"} className="text-xs">
                  {permissionStatus.camera === "granted" ? "Allowed" : "Denied"}
                </Badge>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleAudio}
                  disabled={isLoading || !!mediaError}
                  className={isAudioEnabled ? "control-button active" : "control-button inactive"}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Badge
                  variant={permissionStatus.microphone === "granted" ? "default" : "destructive"}
                  className="text-xs"
                >
                  {permissionStatus.microphone === "granted" ? "Allowed" : "Denied"}
                </Badge>
              </div>
            </div>

            <DeviceSelector onDeviceChange={handleDeviceChange} />
          </CardContent>
        </Card>

        {/* Room Setup Form */}
        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle>Join Video Chat</CardTitle>
            <CardDescription>Enter room details to start your 1:1 video call</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Your Nickname</Label>
              <Input
                id="nickname"
                placeholder="Enter your nickname (한글, 中文, English supported)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)} // Zustand store 업데이트
                className={`text-base ${nickname && !validateNickname(nickname) ? "border-destructive" : ""}`}
                maxLength={30}
              />
              {nickname && !validateNickname(nickname) && (
                <p className="text-xs text-destructive">
                  Nickname must be 1-30 characters and contain only letters, numbers, and basic punctuation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <div className="flex gap-2">
                <Input
                  id="roomId"
                  placeholder="Enter or generate room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className={`text-base ${roomId && !validateRoomId(roomId) ? "border-destructive" : ""}`}
                  maxLength={20}
                />
                <Button variant="outline" onClick={setGenerateRoomId} size="icon">
                  <Shuffle className="w-4 h-4" />
                </Button>
                {roomId && (
                  <Button variant="outline" onClick={copyRoomId} size="icon">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg space-y-2">
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
                <AlertDescription>{mediaError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleJoin}
              disabled={!isFormValid || isLoading || !!mediaError}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
