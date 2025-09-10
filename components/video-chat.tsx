"use client"
import { useEffect, useRef, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MessageCircle, Monitor, Settings, Share, Menu, Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle, User } from "lucide-react"

import { ICE_SERVERS } from "@/config/mediaConfig"
import { ChatPanel } from "./chat-panel"
import { ScreenShare } from "./screen-share"
import { DeviceSettings } from "./device-settings"
import { FileSharePanel } from "./file-share-panel"
import { AudioVisualizer } from "./audio-visualizer"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorOverlay } from "./error-overlay"
import { ThemeToggle } from "@/components/theme-toggle"
import { RealtimeCaption } from "./realtime-caption"

// Hooks import
import { useMediaStream } from "@/hooks/useMediaStream"
import { useSignaling } from "@/hooks/useSignaling"
import { useWebRTC } from "@/hooks/useWebRTC"
import { useFileTransfer } from "@/hooks/useFileTransfer"
import { useAppStore, Message } from '@/store/userConfigStore'

interface VideoChatProps {
  roomId: string
  userId: string
  nickname: string
  onLeaveRoom: () => void
}

interface CaptionData {
  source: string
  translated: string
  isFinal: boolean
}

export function VideoChat({ roomId, userId, nickname, onLeaveRoom }: VideoChatProps) {
  const isMediaLoading = useAppStore(state => state.isMediaLoading)
  const mediaError = useAppStore(state => state.error)
  const {
    localStream, remoteStream, isAudioEnabled, isVideoEnabled, isScreenSharing,
    webRTCConnectionState, error, messages, isPeerTyping,
    init, cleanup, toggleAudio, toggleVideo, setScreenSharing, addMessage, setError,
  } = useAppStore()
  const files = useAppStore(state => Object.values(state.files))

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [remoteCaption, setRemoteCaption] = useState<CaptionData | null>(null)

  const handleRetry = () => {
    window.location.reload();
  }

  const isFatalError = error && (webRTCConnectionState === 'failed' || webRTCConnectionState === 'closed');
  
  // Hooks 초기화
  const { initializeStream, startScreenShare, stopScreenShare, changeDevice } = useMediaStream({ 
    constraints: { video: true, audio: true } 
  })
  
  const { sendSignal, socket } = useSignaling({
    serverUrl: process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "http://localhost:3001",
    roomId,
    userId,
    nickname,
  })

  const fileTransfer = useFileTransfer({
    sendData: (data: any) => webRTC.sendData('file', data),
  })
  
  const webRTC = useWebRTC({
    iceServers: ICE_SERVERS,
    roomId,
    userId,
    localStream: localStream || undefined,
    onData: (data) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(data))
        if (message.type === 'caption') {
          setRemoteCaption(message.payload)
        } else {
          fileTransfer.handleData(data)
        }
      } catch (e) {
        fileTransfer.handleData(data)
      }
    },
  })

  // 컴포넌트 마운트 시 스토어 초기화
  useEffect(() => {
    init({ roomId, userId, nickname })
    
    return () => {
      cleanup()
    }
  }, [userId, nickname, roomId, init, cleanup])

  // 미디어 스트림 초기화
  useEffect(() => {
    initializeStream()
  }, [initializeStream])

  // 비디오 요소에 스트림 연결
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    } else if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }, [remoteStream])

  // 방 나가기 핸들러
  const handleLeaveRoom = useCallback(() => {
    cleanup()
    onLeaveRoom()
  }, [cleanup, onLeaveRoom])
  
  // 화면 공유 토글
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare()
      setScreenSharing(false)
    } else {
      const stream = await startScreenShare()
      if (stream) {
        setScreenSharing(true)
        if (webRTC.updateStream) {
          await webRTC.updateStream(stream)
        }
      }
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare, setScreenSharing, webRTC])

  // 메시지 전송 핸들러
  const handleSendMessage = useCallback((content: string, replyTo?: string) => {
    const message: Message = {
      id: Date.now().toString(),
      userId,
      nickname,
      content,
      timestamp: new Date(),
      type: "text",
      replyTo,
    }
    
    if (webRTC.sendData) {
      const success = webRTC.sendData('text', JSON.stringify(message))
      if (success) {
        addMessage({ ...message, delivered: true })
      } else if (socket) {
        socket.emit("chat-message", { roomId, message })
      }
    } else if (socket) {
      socket.emit("chat-message", { roomId, message })
    }
  }, [roomId, userId, nickname, socket, webRTC, addMessage])

  // 파일 공유 핸들러
  const handleFileShare = useCallback((files: FileList) => {
    Array.from(files).forEach(file => fileTransfer.sendFile(file))
  }, [fileTransfer])

  const handleDownloadFile = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId)
    if (file && file.url) {
      const a = document.createElement("a")
      a.href = file.url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }, [files])

  const handleCaptionGenerated = useCallback((captionData: any) => {
    if (webRTC.sendData) {
      webRTC.sendData('caption', JSON.stringify(captionData))
    }
  }, [webRTC])

  return (
    <div className="min-h-screen bg-background flex relative">
      {isFatalError && (
        <ErrorOverlay 
          error={error as string} 
          onRetry={handleRetry} 
          onLeave={onLeaveRoom} 
        />
      )}
      {/* Main video area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold">Room: {roomId}</h1>
                <p className="text-sm text-muted-foreground">{nickname}</p>
              </div>
              <Badge
                variant={
                  webRTCConnectionState === "connected"
                    ? "default"
                    : webRTCConnectionState === "connecting"
                      ? "secondary"
                      : webRTCConnectionState === "failed"
                        ? "destructive"
                        : "outline"
                }
              >
                {webRTCConnectionState}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Mobile menu button */}
              <div className="md:hidden">
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 p-0">
                    <Tabs defaultValue="chat" className="h-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="chat">
                          <MessageCircle className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="screen">
                          <Monitor className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="settings">
                          <Settings className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="files">
                          <Share className="h-4 w-4" />
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="chat" className="h-full mt-0">
                        <ChatPanel
                          roomId={roomId}
                          userId={userId}
                          nickname={nickname}
                          onSendMessage={handleSendMessage}
                          onAddReaction={() => {}}
                          onCopyMessage={() => {}}
                          onEditMessage={() => {}}
                        />
                      </TabsContent>
                      <TabsContent value="screen" className="mt-0">
                        <ScreenShare
                          onToggleScreenShare={handleToggleScreenShare}
                          isSharing={isScreenSharing}
                        />
                      </TabsContent>
                      <TabsContent value="settings" className="mt-0">
                        <DeviceSettings
                          onDeviceChange={changeDevice}
                          onVolumeChange={(volume) => console.log("Volume:", volume)}
                          onQualityChange={(quality) => console.log("Quality:", quality)}
                        />
                      </TabsContent>
                      <TabsContent value="files" className="mt-0">
                        <FileSharePanel
                          roomId={roomId}
                          userId={userId}
                          files={files}
                          onFileUpload={handleFileShare}
                          onFileDownload={handleDownloadFile}
                          onFileRemove={() => {}}
                          onFilePreview={() => {}}
                        />
                      </TabsContent>
                    </Tabs>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Local Video */}
            <Card className="relative overflow-hidden bg-card">
              <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-sm">{nickname}</div>
              {isMediaLoading ? (
                <div className="w-full h-full flex flex-col p-4">
                  <Skeleton className="w-1/3 h-6 mb-4" />
                  <Skeleton className="w-full h-full" />
                </div>
              ) : mediaError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive p-4 text-center">
                  <AlertCircle className="w-12 h-12 mb-4" />
                  <p className="font-semibold">Media Error</p>
                  <p className="text-sm">{mediaError}</p>
                </div>
              ) : (
                <>
                  <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-3/4">
                    <AudioVisualizer stream={localStream} isEnabled={true} showLabel={false}/>
                  </div>
                </>
              )}
              <RealtimeCaption onCaptionGenerated={handleCaptionGenerated} />
            </Card>

            {/* Remote Video */}
            <Card className="relative overflow-hidden bg-card">
              <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-sm">Remote User</div>
              {!remoteStream ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-muted-foreground">
                  <User className="w-16 h-16 mb-4" />
                  <p className="font-semibold">Waiting for participant...</p>
                  <p className="text-sm">Share the room ID to invite someone.</p>
                </div>
              ) : (
                <>
                  <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-3/4">
                    <AudioVisualizer stream={remoteStream} isEnabled={!!remoteStream} showLabel={false}/>
                  </div>
                </>
              )}
              {remoteCaption && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/50 p-2 rounded-lg text-white text-center w-3/4 max-w-3xl z-20">
                  <p className="text-lg font-semibold">{remoteCaption.source}</p>
                  <p className="text-sm text-gray-300">{remoteCaption.translated}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Controls */}
          <div className="mt-4 flex justify-center gap-4">
            <Button variant="outline" size="icon" onClick={toggleAudio}>
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={toggleVideo}>
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleLeaveRoom}>
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar - 동일한 구조로 유지 */}
      <div className="hidden md:block w-80 border-l border-border bg-card">
        <Tabs defaultValue="chat" className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat">
              <MessageCircle className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="screen">
              <Monitor className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="files">
              <Share className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="h-full mt-0">
            <ChatPanel
              roomId={roomId}
              userId={userId}
              nickname={nickname}
              onSendMessage={handleSendMessage}
              onAddReaction={() => {}}
              onCopyMessage={() => {}}
              onEditMessage={() => {}}
            />
          </TabsContent>
          <TabsContent value="screen" className="mt-0">
            <ScreenShare
              onToggleScreenShare={handleToggleScreenShare}
              isSharing={isScreenSharing}
            />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <DeviceSettings
              onDeviceChange={changeDevice}
              onVolumeChange={(volume) => console.log("Volume:", volume)}
              onQualityChange={(quality) => console.log("Quality:", quality)}
            />
          </TabsContent>
          <TabsContent value="files" className="mt-0">
            <FileSharePanel
              roomId={roomId}
              userId={userId}
              files={files}
              onFileUpload={handleFileShare}
              onFileDownload={handleDownloadFile}
              onFileRemove={() => {}}
              onFilePreview={() => {}}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
