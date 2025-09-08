"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { RoomSetup } from "@/components/room-setup"
import { v4 as uuidv4 } from "uuid"

function RoomSetupFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading room setup...</p>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [userId] = useState(() => uuidv4())

  const handleJoinRoom = (roomId: string, nickname: string) => {
    router.push(`/room/${roomId}?nickname=${encodeURIComponent(nickname)}`)
  }

  return (
    <Suspense fallback={<RoomSetupFallback />}>
      <RoomSetup onJoinRoom={handleJoinRoom} userId={userId} />
    </Suspense>
  )
}
