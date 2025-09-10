import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ErrorOverlayProps {
  error: string
  onRetry: () => void
  onLeave: () => void
}

export function ErrorOverlay({ error, onRetry, onLeave }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-md w-full bg-card border border-destructive rounded-lg p-8 text-center shadow-lg">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">An Error Occurred</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={onRetry} className="flex-1">
            Try to Reconnect
          </Button>
          <Button variant="destructive" onClick={onLeave} className="flex-1">
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  )
}