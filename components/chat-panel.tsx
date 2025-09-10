"use client"
// chat-panel.tsx

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "./ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Send, Smile, MoreVertical, Copy, Reply, Clock } from "lucide-react"
import { useAppStore, Message } from '@/store/userConfigStore'

const EMOJI_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"]

export function ChatPanel({
  roomId,
  userId,
  nickname,
  onSendMessage,
  onAddReaction,
  onCopyMessage,
  onEditMessage,
}: {
  roomId: string;
  userId: string;
  nickname: string;
  onSendMessage: (content: string, replyTo?: string) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onCopyMessage: (content: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
}) {
  const messages = useAppStore(state => state.messages)
  const isPeerTyping = useAppStore(state => state.isPeerTyping)
  const { setPeerTyping } = useAppStore.getState()
  
  const [newMessage, setNewMessage] = useState("")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [newMessage, adjustTextareaHeight])

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

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      setPeerTyping(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      setPeerTyping(false)
    }, 2000)
  }, [isTyping, setPeerTyping])

  const sendMessage = useCallback(() => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim(), replyingTo?.id)
      setNewMessage("")
      setReplyingTo(null)
      setIsTyping(false)
      setPeerTyping(false)
    }
  }, [newMessage, onSendMessage, replyingTo, setPeerTyping])

  const editMessage = useCallback((messageId: string, newContent: string) => {
    onEditMessage(messageId, newContent)
    setEditingMessage(null)
    setNewMessage("")
  }, [onEditMessage])

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      onAddReaction(messageId, emoji)
    },
    [onAddReaction],
  )

  const copyMessage = useCallback((content: string) => {
    onCopyMessage(content)
    navigator.clipboard.writeText(content)
  }, [onCopyMessage])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingMessage) {
        editMessage(editingMessage, newMessage)
      } else {
        sendMessage()
      }
    } else if (e.key === "Escape") {
      setReplyingTo(null)
      setEditingMessage(null)
      setNewMessage("")
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (new Date(date).toDateString() === today.toDateString()) {
      return "Today"
    } else if (new Date(date).toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      return new Date(date).toLocaleDateString()
    }
  }

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [date: string]: Message[] } = {}
    messages.forEach((message) => {
      const dateKey = new Date(message.timestamp).toDateString()
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(message)
    })
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  useEffect(() => {
    if (editingMessage) {
      const msgToEdit = messages.find(msg => msg.id === editingMessage)
      if (msgToEdit) {
        setNewMessage(msgToEdit.content)
        textareaRef.current?.focus()
      }
    }
  }, [editingMessage, messages])

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus()
    }
  }, [replyingTo])


  return (
    <div className="h-full flex flex-col bg-card">
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
        {isPeerTyping && (
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
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-xs">
                    {formatDate(new Date(dateKey))}
                  </Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-3">
                  {dateMessages.map((message, index) => {
                    const isOwn = message.userId === userId
                    const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId
                    const replyToMessage = message.replyTo ? messages.find((m) => m.id === message.replyTo) : null

                    return (
                      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] ${isOwn ? "order-2" : "order-1"}`}>
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
                            {showAvatar && !isOwn && (
                              <p className="text-xs font-medium mb-1 opacity-70">{message.nickname}</p>
                            )}

                            <div className="space-y-1">
                              <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>

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

                            {message.reactions && Object.keys(message.reactions).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {Object.entries(message.reactions).map(([emoji, userIds]) => (
                                  <Button
                                    key={emoji}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => addReaction(message.id, emoji)}
                                    className={`h-6 px-2 text-xs ${
                                      (userIds as string[]).includes(userId) ? "bg-accent text-accent-foreground" : ""
                                    }`}
                                  >
                                    {emoji} {(userIds as string[]).length}
                                  </Button>
                                ))}
                              </div>
                            )}

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
                                  <PopoverContent className="w-64" align="end">
                                    <div className="grid grid-cols-8 gap-1">
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

      <div className="p-4 border-t border-border space-y-2">
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

        {editingMessage && (
          <div className="flex items-center justify-between bg-muted p-2 rounded text-sm">
            <div className="flex items-center gap-2">
              <span>Editing message...</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingMessage(null)} className="h-6 w-6 p-0">
              ×
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Type a message... (한글, 中文, English supported)"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
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
                    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
                    "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
                    "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
                    "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏",
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
          {editingMessage ? (
            <Button onClick={() => editMessage(editingMessage, newMessage)} disabled={!newMessage.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

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
