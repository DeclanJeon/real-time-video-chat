"use client"
// chat-panel.tsx

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Send, Smile, MoreVertical, Copy, Reply, Clock } from "lucide-react"

interface Message {
  id: string
  userId: string
  nickname: string
  content: string
  timestamp: Date
  type: "text" | "file" | "system"
  reactions?: { [emoji: string]: string[] } // emoji -> array of user IDs
  replyTo?: string // message ID being replied to
  edited?: boolean
  delivered?: boolean
}

interface ChatPanelProps {
  roomId: string
  userId: string
  nickname: string
}

const EMOJI_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"]

export function ChatPanel({ roomId, userId, nickname }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [newMessage, adjustTextareaHeight])

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }, 100)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      // In a real app, you'd send typing indicator to other user via WebRTC data channel
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      // Send stop typing indicator
    }, 2000)
  }, [isTyping])

  const sendMessage = useCallback(() => {
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        userId,
        nickname,
        content: newMessage.trim(),
        timestamp: new Date(),
        type: "text",
        replyTo: replyingTo?.id,
        delivered: false,
      }

      setMessages((prev) => [...prev, message])
      setNewMessage("")
      setReplyingTo(null)
      setIsTyping(false)

      // Simulate message delivery
      setTimeout(() => {
        setMessages((prev) => prev.map((msg) => (msg.id === message.id ? { ...msg, delivered: true } : msg)))
      }, 1000)

      // In a real app, send via WebRTC data channel or WebSocket
      console.log("Sending message:", message)
    }
  }, [newMessage, userId, nickname, replyingTo])

  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg)),
    )
    setEditingMessage(null)
  }, [])

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const reactions = { ...msg.reactions }
            if (!reactions[emoji]) {
              reactions[emoji] = []
            }
            if (reactions[emoji].includes(userId)) {
              reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
              if (reactions[emoji].length === 0) {
                delete reactions[emoji]
              }
            } else {
              reactions[emoji].push(userId)
            }
            return { ...msg, reactions }
          }
          return msg
        }),
      )
    },
    [userId],
  )

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (e.key === "Escape") {
      setReplyingTo(null)
      setEditingMessage(null)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString()
    }
  }

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [date: string]: Message[] } = {}
    messages.forEach((message) => {
      const dateKey = message.timestamp.toDateString()
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(message)
    })
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Chat</h3>
            <p className="text-sm text-muted-foreground">Room: {roomId}</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {messages.length} messages
          </Badge>
        </div>
        {otherUserTyping && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            Participant is typing...
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {Object.keys(messageGroups).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            Object.entries(messageGroups).map(([dateKey, dateMessages]) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-xs">
                    {formatDate(new Date(dateKey))}
                  </Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {dateMessages.map((message, index) => {
                    const isOwn = message.userId === userId
                    const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId
                    const replyToMessage = message.replyTo ? messages.find((m) => m.id === message.replyTo) : null

                    return (
                      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] ${isOwn ? "order-2" : "order-1"}`}>
                          {/* Reply context */}
                          {replyToMessage && (
                            <div className="mb-1 text-xs text-muted-foreground border-l-2 border-accent pl-2 ml-2">
                              <span className="font-medium">{replyToMessage.nickname}:</span>{" "}
                              {replyToMessage.content.substring(0, 50)}
                              {replyToMessage.content.length > 50 && "..."}
                            </div>
                          )}

                          <div
                            className={`group relative rounded-lg p-3 ${
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {/* Message header */}
                            {showAvatar && !isOwn && (
                              <p className="text-xs font-medium mb-1 opacity-70">{message.nickname}</p>
                            )}

                            {/* Message content */}
                            <div className="space-y-1">
                              <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>

                              {/* Message footer */}
                              <div className="flex items-center justify-between text-xs opacity-70">
                                <div className="flex items-center gap-1">
                                  <span>{formatTime(message.timestamp)}</span>
                                  {message.edited && <span>(edited)</span>}
                                  {isOwn && (
                                    <div className="flex items-center gap-1">
                                      {message.delivered ? (
                                        <div className="w-3 h-3 text-green-400">✓✓</div>
                                      ) : (
                                        <Clock className="w-3 h-3" />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Message actions */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                        <MoreVertical className="w-3 h-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40" align="end">
                                      <div className="space-y-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setReplyingTo(message)}
                                          className="w-full justify-start"
                                        >
                                          <Reply className="w-3 h-3 mr-2" />
                                          Reply
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyMessage(message.content)}
                                          className="w-full justify-start"
                                        >
                                          <Copy className="w-3 h-3 mr-2" />
                                          Copy
                                        </Button>
                                        {isOwn && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingMessage(message.id)}
                                            className="w-full justify-start"
                                          >
                                            Edit
                                          </Button>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            </div>

                            {/* Reactions */}
                            {message.reactions && Object.keys(message.reactions).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {Object.entries(message.reactions).map(([emoji, userIds]) => (
                                  <Button
                                    key={emoji}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => addReaction(message.id, emoji)}
                                    className={`h-6 px-2 text-xs ${
                                      userIds.includes(userId) ? "bg-accent text-accent-foreground" : ""
                                    }`}
                                  >
                                    {emoji} {userIds.length}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {/* Quick reactions */}
                            <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex gap-1 bg-background border border-border rounded-full p-1 shadow-sm">
                                {EMOJI_REACTIONS.slice(0, 3).map((emoji) => (
                                  <Button
                                    key={emoji}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addReaction(message.id, emoji)}
                                    className="h-6 w-6 p-0 hover:bg-accent"
                                  >
                                    {emoji}
                                  </Button>
                                ))}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent">
                                      <Smile className="w-3 h-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48" align="end">
                                    <div className="grid grid-cols-6 gap-1">
                                      {EMOJI_REACTIONS.map((emoji) => (
                                        <Button
                                          key={emoji}
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => addReaction(message.id, emoji)}
                                          className="h-8 w-8 p-0"
                                        >
                                          {emoji}
                                        </Button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border space-y-2">
        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
            <div className="flex items-center gap-2">
              <Reply className="w-3 h-3" />
              <span>Replying to {replyingTo.nickname}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} className="h-6 w-6 p-0">
              ×
            </Button>
          </div>
        )}

        {/* Message input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Type a message... (한글, 中文, English supported)"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyPress}
              className="min-h-[40px] max-h-[120px] resize-none pr-10"
              rows={1}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="absolute right-2 top-2 h-6 w-6 p-0">
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="grid grid-cols-8 gap-1">
                  {[
                    "😀",
                    "😃",
                    "😄",
                    "😁",
                    "😆",
                    "😅",
                    "😂",
                    "🤣",
                    "😊",
                    "😇",
                    "🙂",
                    "🙃",
                    "😉",
                    "😌",
                    "😍",
                    "🥰",
                    "😘",
                    "😗",
                    "😙",
                    "😚",
                    "😋",
                    "😛",
                    "😝",
                    "😜",
                    "🤪",
                    "🤨",
                    "🧐",
                    "🤓",
                    "😎",
                    "🤩",
                    "🥳",
                    "😏",
                  ].map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewMessage((prev) => prev + emoji)}
                      className="h-8 w-8 p-0"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Character count and typing indicator */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <div>{isTyping && <span>Typing...</span>}</div>
          <div>
            {newMessage.length > 0 && (
              <span className={newMessage.length > 1000 ? "text-destructive" : ""}>{newMessage.length}/1000</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
