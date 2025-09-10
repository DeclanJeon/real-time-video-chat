"use client"
// device-selector.tsx

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Settings, RefreshCw, Bluetooth, Headphones } from "lucide-react"

interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

interface DeviceSelectorProps {
  onDeviceChange?: (devices: { camera: string; microphone: string; speaker: string }) => void
}

export function DeviceSelector({ onDeviceChange }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("")
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("")
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const getDevices = async () => {
    setIsRefreshing(true)
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const processedDevices = deviceList.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        kind: device.kind,
      }))

      setDevices(processedDevices)

      // Auto-select default devices if none selected
      if (!selectedCamera) {
        const defaultCamera = processedDevices.find((d) => d.kind === "videoinput")
        if (defaultCamera) setSelectedCamera(defaultCamera.deviceId)
      }
      if (!selectedMicrophone) {
        const defaultMic = processedDevices.find((d) => d.kind === "audioinput")
        if (defaultMic) setSelectedMicrophone(defaultMic.deviceId)
      }
      if (!selectedSpeaker) {
        const defaultSpeaker = processedDevices.find((d) => d.kind === "audiooutput")
        if (defaultSpeaker) setSelectedSpeaker(defaultSpeaker.deviceId)
      }
    } catch (error) {
      console.error("Error getting devices:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    getDevices()

    // Listen for device changes (e.g., Bluetooth devices connecting/disconnecting)
    const handleDeviceChange = () => {
      getDevices()
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange)
    }
  }, [])

  useEffect(() => {
    if (onDeviceChange) {
      onDeviceChange({
        camera: selectedCamera,
        microphone: selectedMicrophone,
        speaker: selectedSpeaker,
      })
    }
  }, [selectedCamera, selectedMicrophone, selectedSpeaker, onDeviceChange])

  const getDeviceIcon = (device: MediaDeviceInfo) => {
    const label = device.label.toLowerCase()
    if (label.includes("bluetooth") || label.includes("airpods") || label.includes("wireless")) {
      return <Bluetooth className="w-3 h-3" />
    }
    if (label.includes("headphone") || label.includes("headset")) {
      return <Headphones className="w-3 h-3" />
    }
    return null
  }

  const getDeviceType = (device: MediaDeviceInfo) => {
    const label = device.label.toLowerCase()
    if (label.includes("bluetooth")) return "Bluetooth"
    if (label.includes("usb")) return "USB"
    if (label.includes("built-in") || label.includes("internal")) return "Built-in"
    return null
  }

  const cameras = devices.filter((device) => device.kind === "videoinput")
  const microphones = devices.filter((device) => device.kind === "audioinput")
  const speakers = devices.filter((device) => device.kind === "audiooutput")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4" />
            Device Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={getDevices} disabled={isRefreshing} className="h-6 px-2">
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Camera ({cameras.length} available)</Label>
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select camera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(camera)}
                    <span className="truncate">{camera.label}</span>
                    {getDeviceType(camera) && (
                      <Badge variant="outline" className="text-xs border-border bg-background text-foreground">
                        {getDeviceType(camera)}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Microphone ({microphones.length} available)</Label>
          <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent>
              {microphones.map((mic) => (
                <SelectItem key={mic.deviceId} value={mic.deviceId}>
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(mic)}
                    <span className="truncate">{mic.label}</span>
                    {getDeviceType(mic) && (
                      <Badge variant="outline" className="text-xs border-border bg-background text-foreground">
                        {getDeviceType(mic)}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Speaker ({speakers.length} available)</Label>
          <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select speaker" />
            </SelectTrigger>
            <SelectContent>
              {speakers.map((speaker) => (
                <SelectItem key={speaker.deviceId} value={speaker.deviceId}>
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(speaker)}
                    <span className="truncate">{speaker.label}</span>
                    {getDeviceType(speaker) && (
                      <Badge variant="outline" className="text-xs border-border bg-background text-foreground">
                        {getDeviceType(speaker)}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <p>Devices will auto-refresh when new hardware is connected.</p>
          {devices.some((d) => d.label.toLowerCase().includes("bluetooth")) && (
            <p className="mt-1 text-accent">Bluetooth devices detected</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
