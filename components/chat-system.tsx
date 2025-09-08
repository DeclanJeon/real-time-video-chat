"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Send, User } from "lucide-react"

interface ChatMessage {
  id: string
  userId: string
  nickname: string
  message: string
  timestamp: Date
  type: "message" | "system"
}

interface ChatSystemProps {
  userId: string
  nickname: string
  dataChannel: RTCDataChannel | null
  isConnected: boolean
}

export function ChatSystem({ userId, nickname, dataChannel, isConnected }: ChatSystemProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [remoteTyping, setRemoteTyping] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  // Send message through data channel
  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !dataChannel || dataChannel.readyState !== "open") return

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId,
      nickname,
      message: newMessage.trim(),
      timestamp: new Date(),
      type: "message",
    }

    // Add to local messages
    setMessages((prev) => [...prev, message])

    // Send through data channel
    try {
      dataChannel.send(
        JSON.stringify({
          type: "chat",
          data: message,
        }),
      )
    } catch (error) {
      console.error("Failed to send chat message:", error)
    }

    setNewMessage("")
    setIsTyping(false)

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }, [newMessage, dataChannel, userId, nickname])

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!dataChannel || dataChannel.readyState !== "open") return

    if (!isTyping) {
      setIsTyping(true)
      try {
        dataChannel.send(
          JSON.stringify({
            type: "typing",
            data: { userId, nickname, typing: true },
          }),
        )
      } catch (error) {
        console.error("Failed to send typing indicator:", error)
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      if (dataChannel && dataChannel.readyState === "open") {
        try {
          dataChannel.send(
            JSON.stringify({
              type: "typing",
              data: { userId, nickname, typing: false },
            }),
          )
        } catch (error) {
          console.error("Failed to send typing indicator:", error)
        }
      }
    }, 1000)
  }, [dataChannel, userId, nickname, isTyping])

  // Handle incoming messages
  const handleIncomingMessage = useCallback(
    (data: any) => {
      if (data.type === "chat") {
        setMessages((prev) => [...prev, data.data])
        setTimeout(scrollToBottom, 100)
      } else if (data.type === "typing") {
        setRemoteTyping(data.data.typing)

        // Clear remote typing timeout
        if (remoteTypingTimeoutRef.current) {
          clearTimeout(remoteTypingTimeoutRef.current)
        }

        // Auto-clear remote typing after 3 seconds
        if (data.data.typing) {
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setRemoteTyping(false)
          }, 3000)
        }
      }
    },
    [scrollToBottom],
  )

  // Set up data channel message listener
  useEffect(() => {
    if (!dataChannel) return

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        handleIncomingMessage(data)
      } catch (error) {
        console.error("Error parsing chat message:", error)
      }
    }

    dataChannel.addEventListener("message", handleMessage)

    return () => {
      dataChannel.removeEventListener("message", handleMessage)
    }
  }, [dataChannel, handleIncomingMessage])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Connection status */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Chat</h3>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-xs mt-1">Start a conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.userId === userId ? "justify-end" : "justify-start"}`}>
                <Card
                  className={`max-w-[80%] p-3 ${
                    msg.userId === userId ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{msg.userId === userId ? "You" : msg.nickname}</span>
                    <span className="text-xs opacity-70">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm break-words">{msg.message}</p>
                </Card>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {remoteTyping && (
            <div className="flex justify-start">
              <Card className="bg-muted p-3 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">typing...</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              if (e.target.value.trim()) {
                handleTyping()
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Waiting for connection..."}
            disabled={!isConnected || !dataChannel || dataChannel.readyState !== "open"}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected || !dataChannel || dataChannel.readyState !== "open"}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
