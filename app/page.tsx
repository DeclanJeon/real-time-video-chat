"use client"

import { useState } from "react"
import { RoomSetup } from "@/components/room-setup"
import { VideoChat } from "@/components/video-chat"
import { v4 as uuidv4 } from "uuid"

export default function Home() {
  const [isInRoom, setIsInRoom] = useState(false)
  const [roomId, setRoomId] = useState("")
  const [userId] = useState(() => uuidv4())
  const [nickname, setNickname] = useState("")

  const handleJoinRoom = (roomId: string, nickname: string) => {
    setRoomId(roomId)
    setNickname(nickname)
    setIsInRoom(true)
  }

  const handleLeaveRoom = () => {
    setIsInRoom(false)
    setRoomId("")
  }

  if (!isInRoom) {
    return <RoomSetup onJoinRoom={handleJoinRoom} userId={userId} />
  }

  return <VideoChat roomId={roomId} userId={userId} nickname={nickname} onLeaveRoom={handleLeaveRoom} />
}
