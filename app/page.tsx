"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shuffle, ArrowRight, Video } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [roomId, setRoomId] = useState("")

  const generateRoomId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setRoomId(result)
  }

  const createRoom = () => {
    if (!roomId.trim()) {
      generateRoomId()
      return
    }
    router.push(`/room/${roomId.trim().toUpperCase()}`)
  }

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim().toUpperCase()}`)
    }
  }

  const validateRoomId = (value: string) => {
    const roomRegex = /^[A-Za-z0-9]{4,20}$/
    return roomRegex.test(value.trim())
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Video Chat</CardTitle>
            <CardDescription>Start a 1:1 video call with anyone, anywhere</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <div className="flex gap-2">
                <Input
                  id="roomId"
                  placeholder="Enter room ID or generate new"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className={`text-base ${roomId && !validateRoomId(roomId) ? "border-destructive" : ""}`}
                  maxLength={20}
                />
                <Button variant="outline" onClick={generateRoomId} size="icon">
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
              {roomId && !validateRoomId(roomId) && (
                <p className="text-xs text-destructive">
                  Room ID must be 4-20 characters and contain only letters and numbers
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button onClick={createRoom} className="w-full" size="lg">
                {roomId.trim() ? "Create Room" : "Generate & Create Room"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                onClick={joinRoom}
                variant="outline"
                className="w-full bg-transparent"
                size="lg"
                disabled={!roomId.trim() || !validateRoomId(roomId)}
              >
                Join Existing Room
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="text-xs space-y-1">
                <li>• Create a room and share the Room ID</li>
                <li>• Or join an existing room with a Room ID</li>
                <li>• Maximum 2 participants per room</li>
                <li>• Supports video, audio, and text chat</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
