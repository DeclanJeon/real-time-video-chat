"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  Download,
  File,
  ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  X,
  Check,
  AlertCircle,
  Paperclip,
} from "lucide-react"

interface SharedFile {
  id: string
  name: string
  size: number
  type: string
  data?: ArrayBuffer
  url?: string
  progress: number
  status: "pending" | "sending" | "receiving" | "completed" | "failed"
  timestamp: Date
  sender: string
}

interface FileTransfer {
  fileId: string
  chunks: ArrayBuffer[]
  totalChunks: number
  receivedChunks: number
}

interface FileSharingSystemProps {
  dataChannel: RTCDataChannel | null
  isConnected: boolean
  userId: string
  nickname: string
}

const CHUNK_SIZE = 16384 // 16KB chunks for reliable transfer
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB limit

export function FileSharingSystem({ dataChannel, isConnected, userId, nickname }: FileSharingSystemProps) {
  const [files, setFiles] = useState<SharedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [transfers, setTransfers] = useState<Map<string, FileTransfer>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />
    if (type.startsWith("video/")) return <Video className="w-4 h-4" />
    if (type.startsWith("audio/")) return <Music className="w-4 h-4" />
    if (type.includes("text") || type.includes("document")) return <FileText className="w-4 h-4" />
    if (type.includes("zip") || type.includes("rar") || type.includes("archive")) return <Archive className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`
    }

    // Block potentially dangerous file types
    const dangerousTypes = [".exe", ".bat", ".cmd", ".scr", ".pif", ".com", ".jar"]
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."))
    if (dangerousTypes.includes(fileExtension)) {
      return "This file type is not allowed for security reasons"
    }

    return null
  }

  // Send file through data channel
  const sendFile = useCallback(
    async (file: File) => {
      if (!dataChannel || dataChannel.readyState !== "open") {
        console.error("Data channel not available")
        return
      }

      const validation = validateFile(file)
      if (validation) {
        alert(validation)
        return
      }

      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const arrayBuffer = await file.arrayBuffer()
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE)

      // Add file to list
      const sharedFile: SharedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: "sending",
        timestamp: new Date(),
        sender: nickname,
      }

      setFiles((prev) => [...prev, sharedFile])

      try {
        // Send file metadata
        dataChannel.send(
          JSON.stringify({
            type: "file-metadata",
            data: {
              fileId,
              name: file.name,
              size: file.size,
              type: file.type,
              totalChunks,
              sender: nickname,
            },
          }),
        )

        // Send file in chunks
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength)
          const chunk = arrayBuffer.slice(start, end)

          dataChannel.send(
            JSON.stringify({
              type: "file-chunk",
              data: {
                fileId,
                chunkIndex: i,
                chunk: Array.from(new Uint8Array(chunk)),
              },
            }),
          )

          // Update progress
          const progress = Math.round(((i + 1) / totalChunks) * 100)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, progress, status: i === totalChunks - 1 ? "completed" : "sending" } : f,
            ),
          )

          // Small delay to prevent overwhelming the data channel
          await new Promise((resolve) => setTimeout(resolve, 1))
        }

        console.log(`File ${file.name} sent successfully`)
      } catch (error) {
        console.error("Error sending file:", error)
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "failed" } : f)))
      }
    },
    [dataChannel, nickname],
  )

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      Array.from(files).forEach((file) => {
        sendFile(file)
      })
    },
    [sendFile],
  )

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  // Handle incoming file data
  const handleIncomingFileData = useCallback((data: any) => {
    if (data.type === "file-metadata") {
      const { fileId, name, size, type, totalChunks, sender } = data.data

      // Create new file entry
      const sharedFile: SharedFile = {
        id: fileId,
        name,
        size,
        type,
        progress: 0,
        status: "receiving",
        timestamp: new Date(),
        sender,
      }

      setFiles((prev) => [...prev, sharedFile])

      // Initialize transfer tracking
      setTransfers((prev) => {
        const newTransfers = new Map(prev)
        newTransfers.set(fileId, {
          fileId,
          chunks: new Array(totalChunks),
          totalChunks,
          receivedChunks: 0,
        })
        return newTransfers
      })
    } else if (data.type === "file-chunk") {
      const { fileId, chunkIndex, chunk } = data.data

      setTransfers((prev) => {
        const newTransfers = new Map(prev)
        const transfer = newTransfers.get(fileId)

        if (transfer) {
          // Store chunk
          transfer.chunks[chunkIndex] = new Uint8Array(chunk).buffer
          transfer.receivedChunks++

          // Update progress
          const progress = Math.round((transfer.receivedChunks / transfer.totalChunks) * 100)
          setFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    progress,
                    status: transfer.receivedChunks === transfer.totalChunks ? "completed" : "receiving",
                  }
                : f,
            ),
          )

          // If all chunks received, combine them
          if (transfer.receivedChunks === transfer.totalChunks) {
            const combinedBuffer = new ArrayBuffer(
              transfer.chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
            )
            const combinedArray = new Uint8Array(combinedBuffer)
            let offset = 0

            transfer.chunks.forEach((chunk) => {
              combinedArray.set(new Uint8Array(chunk), offset)
              offset += chunk.byteLength
            })

            // Update file with data and create download URL
            setFiles((prevFiles) =>
              prevFiles.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      data: combinedBuffer,
                      url: URL.createObjectURL(new Blob([combinedBuffer], { type: f.type })),
                    }
                  : f,
              ),
            )

            // Clean up transfer tracking
            newTransfers.delete(fileId)
          }
        }

        return newTransfers
      })
    }
  }, [])

  // Download file
  const downloadFile = useCallback((file: SharedFile) => {
    if (!file.url) return

    const link = document.createElement("a")
    link.href = file.url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === fileId)
      if (fileToRemove?.url) {
        URL.revokeObjectURL(fileToRemove.url)
      }
      return prev.filter((f) => f.id !== fileId)
    })
  }, [])

  // Set up data channel message listener
  useEffect(() => {
    if (!dataChannel) return

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "file-metadata" || data.type === "file-chunk") {
          handleIncomingFileData(data)
        }
      } catch (error) {
        console.error("Error parsing file sharing message:", error)
      }
    }

    dataChannel.addEventListener("message", handleMessage)

    return () => {
      dataChannel.removeEventListener("message", handleMessage)
    }
  }, [dataChannel, handleIncomingFileData])

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.url) {
          URL.revokeObjectURL(file.url)
        }
      })
    }
  }, [files])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              File Sharing
            </h3>
            <p className="text-xs text-muted-foreground">Share files up to {formatFileSize(MAX_FILE_SIZE)}</p>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? "Ready" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-3 border-b border-border">
        <div
          className={`
            border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
            ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => isConnected && fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">{isDragging ? "Drop files here" : "Click to upload or drag & drop"}</p>
          <p className="text-xs text-muted-foreground mt-1">Max {formatFileSize(MAX_FILE_SIZE)} per file</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={!isConnected}
        />
      </div>

      {/* Connection Warning */}
      {!isConnected && (
        <div className="p-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              File sharing is disabled. Wait for peer connection to be established.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Files List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {files.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files shared yet</p>
              <p className="text-xs mt-1">Upload files to share with your peer</p>
            </div>
          ) : (
            files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">{getFileIcon(file.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate">{file.name}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.sender === nickname ? "You" : file.sender}</span>
                      <span>•</span>
                      <span>{file.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    {/* Progress Bar */}
                    {(file.status === "sending" || file.status === "receiving") && (
                      <div className="mb-2">
                        <Progress value={file.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {file.status === "sending" ? "Sending" : "Receiving"} {file.progress}%
                        </p>
                      </div>
                    )}

                    {/* Status and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {file.status === "completed" && <Check className="w-3 h-3 text-green-500" />}
                        {file.status === "failed" && <AlertCircle className="w-3 h-3 text-red-500" />}
                        <Badge
                          variant={
                            file.status === "completed"
                              ? "default"
                              : file.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {file.status}
                        </Badge>
                      </div>

                      {file.status === "completed" && file.url && (
                        <Button variant="outline" size="sm" onClick={() => downloadFile(file)} className="h-6 text-xs">
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
