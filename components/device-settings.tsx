// device-settings.tsx
"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Camera, Mic, Volume2 } from "lucide-react"

interface DeviceSettingsProps {
  onDeviceChange: (type: "video" | "audio", deviceId: string) => void
  onVolumeChange: (volume: number) => void
  onQualityChange: (quality: "low" | "medium" | "high") => void
}

export function DeviceSettings({ onDeviceChange, onVolumeChange, onQualityChange }: DeviceSettingsProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [volume, setVolume] = useState([80])
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium")
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [noiseSuppression, setNoiseSuppression] = useState(true)

  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setVideoDevices(devices.filter((device) => device.kind === "videoinput"))
        setAudioDevices(devices.filter((device) => device.kind === "audioinput"))
        setOutputDevices(devices.filter((device) => device.kind === "audiooutput"))
      } catch (error) {
        console.error("Error getting devices:", error)
      }
    }

    getDevices()
  }, [])

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    onVolumeChange(value[0])
  }

  const handleQualityChange = (newQuality: "low" | "medium" | "high") => {
    setQuality(newQuality)
    onQualityChange(newQuality)
  }

  return (
    <div className="p-4 space-y-6">
      <h3 className="font-semibold">장치 및 설정</h3>

      {/* 카메라 설정 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="h-4 w-4" />
          <Label className="font-medium">카메라</Label>
        </div>
        <Select onValueChange={(value) => onDeviceChange("video", value)}>
          <SelectTrigger>
            <SelectValue placeholder="카메라 선택" />
          </SelectTrigger>
          <SelectContent>
            {videoDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `카메라 ${device.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* 마이크 설정 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="h-4 w-4" />
          <Label className="font-medium">마이크</Label>
        </div>
        <Select onValueChange={(value) => onDeviceChange("audio", value)}>
          <SelectTrigger>
            <SelectValue placeholder="마이크 선택" />
          </SelectTrigger>
          <SelectContent>
            {audioDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `마이크 ${device.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* 스피커 설정 */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="h-4 w-4" />
          <Label className="font-medium">스피커</Label>
        </div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="스피커 선택" />
          </SelectTrigger>
          <SelectContent>
            {outputDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `스피커 ${device.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* 볼륨 설정 */}
      <Card className="p-4">
        <Label className="font-medium mb-3 block">볼륨</Label>
        <Slider value={volume} onValueChange={handleVolumeChange} max={100} step={1} className="w-full" />
        <div className="text-sm text-muted-foreground mt-1">{volume[0]}%</div>
      </Card>

      {/* 화질 설정 */}
      <Card className="p-4">
        <Label className="font-medium mb-3 block">화질</Label>
        <Select value={quality} onValueChange={handleQualityChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">낮음 (480p)</SelectItem>
            <SelectItem value="medium">보통 (720p)</SelectItem>
            <SelectItem value="high">높음 (1080p)</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* 오디오 처리 설정 */}
      <Card className="p-4 space-y-4">
        <Label className="font-medium">오디오 처리</Label>

        <div className="flex items-center justify-between">
          <Label htmlFor="echo-cancellation">에코 제거</Label>
          <Switch id="echo-cancellation" checked={echoCancellation} onCheckedChange={setEchoCancellation} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="noise-suppression">노이즈 억제</Label>
          <Switch id="noise-suppression" checked={noiseSuppression} onCheckedChange={setNoiseSuppression} />
        </div>
      </Card>
    </div>
  )
}
