"use client"
// volume-control.tsx

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Volume2, VolumeX, Volume1, Headphones } from "lucide-react"

interface VolumeControlProps {
  volume: number
  onVolumeChange: (volume: number) => void
}

export function VolumeControl({ volume, onVolumeChange }: VolumeControlProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(volume)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>("")

  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputs = devices.filter((device) => device.kind === "audiooutput")
        setAudioDevices(audioOutputs)

        if (audioOutputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioOutputs[0].deviceId)
        }
      } catch (error) {
        console.error("Error getting audio devices:", error)
      }
    }

    getAudioDevices()

    const handleDeviceChange = () => {
      getAudioDevices()
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange)
    }
  }, [selectedDevice])

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      onVolumeChange(previousVolume)
    } else {
      setIsMuted(true)
      setPreviousVolume(volume)
      onVolumeChange(0)
    }
  }

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0]
    onVolumeChange(vol)
    setIsMuted(vol === 0)
  }

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    // Note: Setting audio output device requires setSinkId which may not be available in all browsers
    try {
      const audioElement = document.querySelector("video") as HTMLVideoElement
      if (audioElement && "setSinkId" in audioElement) {
        await (audioElement as any).setSinkId(deviceId)
      }
    } catch (error) {
      console.error("Error setting audio output device:", error)
    }
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />
    if (volume < 50) return <Volume1 className="w-5 h-5" />
    return <Volume2 className="w-5 h-5" />
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="control-button inactive bg-transparent">
          {getVolumeIcon()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="center">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Volume</span>
            <span className="text-sm text-muted-foreground">{Math.round(volume)}%</span>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleMute} className="p-1">
              {getVolumeIcon()}
            </Button>
            <Slider value={[volume]} onValueChange={handleVolumeChange} max={100} step={1} className="flex-1" />
          </div>

          {/* Audio Output Device Selection */}
          {audioDevices.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                <span className="text-sm font-medium">Audio Output</span>
              </div>
              <Select value={selectedDevice} onValueChange={handleDeviceChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select audio output" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Audio Output ${device.deviceId.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleMute} className="flex-1 bg-transparent">
              {isMuted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleVolumeChange([50])} className="flex-1">
              50%
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleVolumeChange([100])} className="flex-1">
              Max
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
