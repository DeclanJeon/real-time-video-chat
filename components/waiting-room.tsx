"use client"
// waiting-room.tsx

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Users, ArrowLeft } from "lucide-react"

interface WaitingRoomProps {
  roomId: string
  message: string
  onReturnHome: () => void
}

export function WaitingRoom({ roomId, message, onReturnHome }: WaitingRoomProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Room Full</h1>
          <p className="text-sm text-muted-foreground mb-4">Room ID: {roomId}</p>
        </div>

        <div className="mb-6">
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="space-y-3">
          <Button onClick={onReturnHome} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Home
          </Button>
        </div>
      </Card>
    </div>
  )
}
