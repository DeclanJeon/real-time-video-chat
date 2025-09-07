"use client"

import { Button } from "@/components/ui/button"
import { Maximize, Minimize, PictureInPicture } from "lucide-react"
import { cn } from "@/lib/utils"

interface VideoControlsProps {
  isVisible: boolean
  onFullscreen: () => void
  onPictureInPicture: () => void
  isFullscreen: boolean
  isPiPEnabled: boolean
  className?: string
}

export function VideoControls({
  isVisible,
  onFullscreen,
  onPictureInPicture,
  isFullscreen,
  isPiPEnabled,
  className,
}: VideoControlsProps) {
  if (!isVisible) return null

  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={onFullscreen}
        className="bg-black/50 hover:bg-black/70 text-white border-0"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onPictureInPicture}
        className={cn(
          "bg-black/50 hover:bg-black/70 text-white border-0",
          isPiPEnabled && "bg-primary/80 hover:bg-primary",
        )}
      >
        <PictureInPicture className="w-4 h-4" />
      </Button>
    </div>
  )
}
