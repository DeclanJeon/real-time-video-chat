"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { VideoChat } from "@/components/video-chat"
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

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [isInRoom, setIsInRoom] = useState(false)
  const [userId] = useState(() => uuidv4())
  const [nickname, setNickname] = useState("")
  const [isValidRoom, setIsValidRoom] = useState(true)

  useEffect(() => {
    // Validate room ID format
    const validateRoomId = (id: string) => {
      const roomRegex = /^[A-Za-z0-9]{4,20}$/
      return roomRegex.test(id)
    }

    if (roomId && !validateRoomId(roomId)) {
      setIsValidRoom(false)
    }
  }, [roomId])

  const handleJoinRoom = (roomId: string, nickname: string) => {
    setNickname(nickname)
    setIsInRoom(true)
  }

  const handleLeaveRoom = () => {
    setIsInRoom(false)
    router.push("/")
  }

  if (!isValidRoom) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Room ID</h1>
          <p className="text-muted-foreground mb-4">
            The room ID "{roomId}" is not valid. Room IDs must be 4-20 characters with letters and numbers only.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!isInRoom) {
    return (
      <Suspense fallback={<RoomSetupFallback />}>
        <RoomSetup onJoinRoom={handleJoinRoom} userId={userId} initialRoomId={roomId} />
      </Suspense>
    )
  }

  return <VideoChat roomId={roomId} userId={userId} nickname={nickname} onLeaveRoom={handleLeaveRoom} />
}
