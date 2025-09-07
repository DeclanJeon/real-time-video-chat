"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Video, Mic, Shuffle, Copy, Check } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

export default function Home() {
  const [isInRoom, setIsInRoom] = useState(false)
  const [roomId, setRoomId] = useState("")
  const [nickname, setNickname] = useState("")
  const [userId] = useState(() => uuidv4())
  const [copied, setCopied] = useState(false)

  const generateRoomId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setRoomId(result)
  }

  const copyRoomId = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error("Failed to copy room ID:", error)
      }
    }
  }

  const handleJoinRoom = () => {
    if (roomId.trim() && nickname.trim()) {
      setIsInRoom(true)
    }
  }

  const handleLeaveRoom = () => {
    setIsInRoom(false)
    setRoomId("")
  }

  if (isInRoom) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Video Chat Room: {roomId}</CardTitle>
            <CardDescription>Connected as {nickname}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Video className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Video chat will be implemented here</p>
                <p className="text-sm text-muted-foreground mt-2">Room ID: {roomId}</p>
                <p className="text-sm text-muted-foreground">User ID: {userId}</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" size="icon">
                <Video className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon">
                <Mic className="w-5 h-5" />
              </Button>
              <Button variant="destructive" onClick={handleLeaveRoom}>
                Leave Room
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Join Video Chat</CardTitle>
            <CardDescription>Enter room details to start your 1:1 video call</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Your Nickname</Label>
              <Input
                id="nickname"
                placeholder="Enter your nickname (한글, 中文, English supported)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <div className="flex gap-2">
                <Input
                  id="roomId"
                  placeholder="Enter or generate room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  maxLength={20}
                />
                <Button variant="outline" onClick={generateRoomId} size="icon">
                  <Shuffle className="w-4 h-4" />
                </Button>
                {roomId && (
                  <Button variant="outline" onClick={copyRoomId} size="icon">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              {copied && <p className="text-xs text-accent">Room ID copied to clipboard!</p>}
            </div>

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg space-y-2">
              <div>
                <strong>Your User ID:</strong>
                <Badge variant="outline" className="ml-2 text-xs">
                  {userId.slice(0, 8)}...
                </Badge>
              </div>
              <p>Share the Room ID with the person you want to chat with.</p>
              <p className="text-xs">Supports Unicode text input for international users.</p>
            </div>

            <Button onClick={handleJoinRoom} disabled={!roomId.trim() || !nickname.trim()} className="w-full" size="lg">
              Join Room
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
