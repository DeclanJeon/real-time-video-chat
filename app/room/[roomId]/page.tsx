"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { VideoChat } from "@/components/video-chat"
import { WaitingRoom } from "@/components/waiting-room"
import { RoomSetup } from "@/components/room-setup"
import { v4 as uuidv4 } from "uuid"
import io, { type Socket } from "socket.io-client"

interface RoomUser {
  userId: string
  nickname: string
  socketId: string
}

function RoomPageContent() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [userId] = useState(() => uuidv4())
  const [nickname, setNickname] = useState("")
  const [roomStatus, setRoomStatus] = useState<"setup" | "waiting" | "active" | "full">("setup")
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!roomId) return

    const socketConnection = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "http://localhost:3001", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    setSocket(socketConnection)

    socketConnection.on("connect", () => {
      // Check room status before joining
      socketConnection.emit("check-room-status", { roomId })
    })

    socketConnection.on("room-status", (data: { users: RoomUser[]; canJoin: boolean }) => {
      setRoomUsers(data.users)

      if (data.users.length >= 2 && !data.canJoin) {
        setRoomStatus("full")
      } else if (data.users.length === 1) {
        setRoomStatus("setup") // Can join as second user
      } else {
        setRoomStatus("setup") // Empty room
      }
    })

    socketConnection.on("room-full", () => {
      setRoomStatus("full")
    })

    return () => {
      socketConnection.disconnect()
    }
  }, [roomId])

  const handleJoinRoom = (nickname: string) => {
    setNickname(nickname)
    if (socket) {
      socket.emit("join-room", { roomId, userId, nickname })
      setRoomStatus("active")
    }
  }

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit("leave-room", { roomId })
      socket.disconnect()
    }
    router.push("/")
  }

  const handleReturnHome = () => {
    if (socket) {
      socket.disconnect()
    }
    router.push("/")
  }

  if (roomStatus === "full") {
    return (
      <WaitingRoom
        roomId={roomId}
        message="This room is currently full (2/2 participants). Please try again later."
        onReturnHome={handleReturnHome}
      />
    )
  }

  if (roomStatus === "setup") {
    return <RoomSetup onJoinRoom={handleJoinRoom} userId={userId} initialRoomId={roomId} />
  }

  if (roomStatus === "active" && nickname) {
    return <VideoChat roomId={roomId} userId={userId} nickname={nickname} onLeaveRoom={handleLeaveRoom} />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Loading room...</h2>
        <p className="text-muted-foreground">Please wait while we prepare your room.</p>
      </div>
    </div>
  )
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Preparing your video chat room.</p>
          </div>
        </div>
      }
    >
      <RoomPageContent />
    </Suspense>
  )
}
