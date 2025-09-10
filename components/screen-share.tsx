// screen-share.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Monitor, MonitorOff, Square } from "lucide-react"

interface ScreenShareProps {
  onScreenShare: (stream: MediaStream | null) => void
  isSharing: boolean
}

export function ScreenShare({ onScreenShare, isSharing }: ScreenShareProps) {
  const [error, setError] = useState<string | null>(null)

  const startScreenShare = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: true,
      })

      // 화면 공유가 중단되었을 때 처리
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        onScreenShare(null)
      })

      onScreenShare(stream)
    } catch (err: any) {
      console.error("Screen share error:", err)
      setError("화면 공유를 시작할 수 없습니다.")
    }
  }

  const stopScreenShare = () => {
    onScreenShare(null)
  }

  return (
    <div className="p-4">
      <h3 className="font-semibold mb-4">화면 공유</h3>

      {error && (
        <Card className="p-3 mb-4 bg-destructive/10 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      <div className="space-y-3">
        <Button
          onClick={isSharing ? stopScreenShare : startScreenShare}
          variant={isSharing ? "destructive" : "default"}
          className="w-full"
        >
          {isSharing ? (
            <>
              <MonitorOff className="h-4 w-4 mr-2" />
              화면 공유 중단
            </>
          ) : (
            <>
              <Monitor className="h-4 w-4 mr-2" />
              화면 공유 시작
            </>
          )}
        </Button>

        {isSharing && (
          <Card className="p-3 bg-primary/10">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-primary" />
              <span className="text-sm">화면을 공유하고 있습니다</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
