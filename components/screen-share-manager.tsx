"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, MonitorOff, AlertCircle, Info } from "lucide-react"

interface ScreenShareManagerProps {
  onScreenShare: (stream: MediaStream | null) => void
  isScreenSharing: boolean
  peerConnection?: any
}

export function ScreenShareManager({ onScreenShare, isScreenSharing, peerConnection }: ScreenShareManagerProps) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState<boolean>(true)
  const [permissionStatus, setPermissionStatus] = useState<string>("")
  const screenVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const checkSupport = async () => {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setIsSupported(false)
        setError("Screen sharing is not supported in this browser.")
        return
      }

      // Check if we're in a secure context (HTTPS)
      if (!window.isSecureContext) {
        setIsSupported(false)
        setError("Screen sharing requires a secure connection (HTTPS).")
        return
      }

      // Check permissions policy
      try {
        // @ts-ignore - permissions API might not be fully typed
        if (navigator.permissions && navigator.permissions.query) {
          const permission = await navigator.permissions.query({ name: "display-capture" as any })
          setPermissionStatus(permission.state)

          if (permission.state === "denied") {
            setError("Screen sharing permission has been denied. Please enable it in your browser settings.")
          }
        }
      } catch (err) {
        console.log("Permissions API not available")
      }
    }

    checkSupport()
  }, [])

  const startScreenShare = useCallback(async () => {
    try {
      setError(null)

      if (!isSupported) {
        setError("Screen sharing is not available in this browser or context.")
        return
      }

      // Check if we're in an iframe and suggest opening in new tab
      if (window !== window.top) {
        setError("Screen sharing may not work in embedded frames. Try opening this page in a new tab.")
        return
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      setScreenStream(stream)
      onScreenShare(stream)

      // Set up screen video element
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream
        // Only set srcObject, no automatic playback
      }

      // Replace video track in peer connection
      if (peerConnection && peerConnection.streams && peerConnection.streams[0]) {
        const videoTrack = stream.getVideoTracks()[0]
        const sender = peerConnection._pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === "video")

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        }
      }

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopScreenShare()
      })
    } catch (error: any) {
      console.error("Error starting screen share:", error)

      let errorMessage = "Failed to start screen sharing."

      if (error.name === "NotAllowedError") {
        errorMessage = "Screen sharing permission was denied. Please allow screen sharing and try again."
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Screen sharing is not supported in this browser."
      } else if (error.name === "NotFoundError") {
        errorMessage = "No screen sharing source was selected."
      } else if (error.message?.includes("permissions policy")) {
        errorMessage =
          "Screen sharing is blocked by browser policy. Try opening this page in a new tab or check your browser settings."
      }

      setError(errorMessage)
    }
  }, [onScreenShare, peerConnection, isSupported])

  const stopScreenShare = useCallback(async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
      setScreenStream(null)
      onScreenShare(null)

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null
      }

      // Restore camera stream in peer connection
      if (peerConnection && peerConnection.streams && peerConnection.streams[0]) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          })

          const videoTrack = cameraStream.getVideoTracks()[0]
          const sender = peerConnection._pc.getSenders().find((s: RTCRtpSender) => s.track && s.track.kind === "video")

          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack)
          }
        } catch (error) {
          console.error("Error restoring camera:", error)
        }
      }
    }
    setError(null)
  }, [screenStream, onScreenShare, peerConnection])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={isScreenSharing ? "destructive" : "default"}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          disabled={!isSupported}
          className="flex items-center gap-2"
        >
          {isScreenSharing ? (
            <>
              <MonitorOff className="w-4 h-4" />
              Stop Sharing
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4" />
              Share Screen
            </>
          )}
        </Button>
      </div>

      {!isSupported && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-700">
              <Info className="w-4 h-4" />
              <span className="text-sm">Screen sharing is not available in this browser or requires HTTPS.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {screenStream && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Screen Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <video
              ref={screenVideoRef}
              className="w-full h-32 object-contain bg-black rounded"
              muted
              playsInline
              controls // Added controls so user can manually play if needed
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
