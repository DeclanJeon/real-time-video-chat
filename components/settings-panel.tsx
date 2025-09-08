"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Camera, Mic, Speaker, Monitor, Volume2, Settings, Wifi, Smartphone, RefreshCw } from "lucide-react"

interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

interface SettingsPanelProps {
  localStream: MediaStream | null
  onStreamUpdate: (stream: MediaStream) => void
  connectionStatus: string
  isMobile: boolean
}

export function SettingsPanel({ localStream, onStreamUpdate, connectionStatus, isMobile }: SettingsPanelProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("")
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("")
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("")
  const [videoQuality, setVideoQuality] = useState<string>("720p")
  const [audioQuality, setAudioQuality] = useState<string>("high")
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [autoGainControl, setAutoGainControl] = useState(true)
  const [microphoneVolume, setMicrophoneVolume] = useState([80])
  const [speakerVolume, setSpeakerVolume] = useState([80])
  const [mirrorVideo, setMirrorVideo] = useState(true)
  const [showConnectionInfo, setShowConnectionInfo] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get available media devices
  const getMediaDevices = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const formattedDevices: MediaDeviceInfo[] = deviceList.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        kind: device.kind,
      }))
      setDevices(formattedDevices)

      // Set default selections if not already set
      if (!selectedCamera) {
        const defaultCamera = formattedDevices.find((d) => d.kind === "videoinput")
        if (defaultCamera) setSelectedCamera(defaultCamera.deviceId)
      }
      if (!selectedMicrophone) {
        const defaultMic = formattedDevices.find((d) => d.kind === "audioinput")
        if (defaultMic) setSelectedMicrophone(defaultMic.deviceId)
      }
      if (!selectedSpeaker) {
        const defaultSpeaker = formattedDevices.find((d) => d.kind === "audiooutput")
        if (defaultSpeaker) setSelectedSpeaker(defaultSpeaker.deviceId)
      }
    } catch (error) {
      console.error("Error getting media devices:", error)
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedCamera, selectedMicrophone, selectedSpeaker])

  // Update media stream with new constraints
  const updateMediaStream = useCallback(async () => {
    if (!selectedCamera && !selectedMicrophone) return

    try {
      const videoConstraints = selectedCamera
        ? {
            deviceId: { exact: selectedCamera },
            width: getVideoConstraints(videoQuality).width,
            height: getVideoConstraints(videoQuality).height,
            frameRate: getVideoConstraints(videoQuality).frameRate,
          }
        : false

      const audioConstraints = selectedMicrophone
        ? {
            deviceId: { exact: selectedMicrophone },
            echoCancellation,
            noiseSuppression,
            autoGainControl,
            sampleRate: audioQuality === "high" ? 48000 : 16000,
          }
        : false

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      })

      onStreamUpdate(newStream)
    } catch (error) {
      console.error("Error updating media stream:", error)
    }
  }, [
    selectedCamera,
    selectedMicrophone,
    videoQuality,
    audioQuality,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    onStreamUpdate,
  ])

  // Get video constraints based on quality setting
  const getVideoConstraints = (quality: string) => {
    switch (quality) {
      case "480p":
        return { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
      case "720p":
        return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      case "1080p":
        return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
      default:
        return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
    }
  }

  // Initialize devices on mount
  useEffect(() => {
    getMediaDevices()

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", getMediaDevices)

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getMediaDevices)
    }
  }, [getMediaDevices])

  // Update stream when settings change
  useEffect(() => {
    if (selectedCamera || selectedMicrophone) {
      const timeoutId = setTimeout(updateMediaStream, 500) // Debounce updates
      return () => clearTimeout(timeoutId)
    }
  }, [updateMediaStream])

  const cameraDevices = devices.filter((d) => d.kind === "videoinput")
  const microphoneDevices = devices.filter((d) => d.kind === "audioinput")
  const speakerDevices = devices.filter((d) => d.kind === "audiooutput")

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Device Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Device Settings
                </CardTitle>
                <CardDescription>Configure your camera, microphone, and speakers</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={getMediaDevices} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Camera
              </Label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameraDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Microphone Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Microphone
              </Label>
              <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {microphoneDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Speaker className="w-4 h-4" />
                Speakers
              </Label>
              <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select speakers" />
                </SelectTrigger>
                <SelectContent>
                  {speakerDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Video Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Video Settings
            </CardTitle>
            <CardDescription>Adjust video quality and display preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Quality */}
            <div className="space-y-2">
              <Label>Video Quality</Label>
              <Select value={videoQuality} onValueChange={setVideoQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="480p">480p (Standard)</SelectItem>
                  <SelectItem value="720p">720p (HD)</SelectItem>
                  <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mirror Video */}
            <div className="flex items-center justify-between">
              <Label htmlFor="mirror-video">Mirror my video</Label>
              <Switch id="mirror-video" checked={mirrorVideo} onCheckedChange={setMirrorVideo} />
            </div>
          </CardContent>
        </Card>

        {/* Audio Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Audio Settings
            </CardTitle>
            <CardDescription>Configure audio quality and processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audio Quality */}
            <div className="space-y-2">
              <Label>Audio Quality</Label>
              <Select value={audioQuality} onValueChange={setAudioQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (16kHz)</SelectItem>
                  <SelectItem value="high">High (48kHz)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Microphone Volume */}
            <div className="space-y-2">
              <Label>Microphone Volume: {microphoneVolume[0]}%</Label>
              <Slider
                value={microphoneVolume}
                onValueChange={setMicrophoneVolume}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Speaker Volume */}
            <div className="space-y-2">
              <Label>Speaker Volume: {speakerVolume[0]}%</Label>
              <Slider value={speakerVolume} onValueChange={setSpeakerVolume} max={100} step={1} className="w-full" />
            </div>

            <Separator />

            {/* Audio Processing */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Audio Processing</Label>

              <div className="flex items-center justify-between">
                <Label htmlFor="echo-cancellation" className="text-sm">
                  Echo Cancellation
                </Label>
                <Switch id="echo-cancellation" checked={echoCancellation} onCheckedChange={setEchoCancellation} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="noise-suppression" className="text-sm">
                  Noise Suppression
                </Label>
                <Switch id="noise-suppression" checked={noiseSuppression} onCheckedChange={setNoiseSuppression} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-gain-control" className="text-sm">
                  Auto Gain Control
                </Label>
                <Switch id="auto-gain-control" checked={autoGainControl} onCheckedChange={setAutoGainControl} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Connection Info
            </CardTitle>
            <CardDescription>View connection status and diagnostics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Connection Status</Label>
              <Badge
                variant={
                  connectionStatus === "connected"
                    ? "default"
                    : connectionStatus === "connecting"
                      ? "secondary"
                      : "destructive"
                }
              >
                {connectionStatus}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <Label>Device Type</Label>
              <Badge variant="outline" className="flex items-center gap-1">
                {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                {isMobile ? "Mobile" : "Desktop"}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConnectionInfo(!showConnectionInfo)}
              className="w-full"
            >
              {showConnectionInfo ? "Hide" : "Show"} Advanced Info
            </Button>

            {showConnectionInfo && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>User Agent:</span>
                  <span className="text-right text-xs max-w-[200px] truncate">{navigator.userAgent.split(" ")[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span>WebRTC Support:</span>
                  <span>{typeof RTCPeerConnection !== "undefined" ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Media Devices:</span>
                  <span>{devices.length} found</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apply Settings Button */}
        <Button onClick={updateMediaStream} className="w-full" size="lg">
          Apply Settings
        </Button>
      </div>
    </ScrollArea>
  )
}
