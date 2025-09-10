// screen-share.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Monitor, MonitorOff, Square } from "lucide-react"

interface ScreenShareProps {
  onToggleScreenShare: () => void
  isSharing: boolean
}

export function ScreenShare({ onToggleScreenShare, isSharing }: ScreenShareProps) {
  return (
    <div className="p-4">
      <h3 className="font-semibold mb-4">화면 공유</h3>

      <div className="space-y-3">
        <Button
          onClick={onToggleScreenShare}
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
