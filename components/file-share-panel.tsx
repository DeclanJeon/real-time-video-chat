"use client"
// file-share-panel.tsx

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Upload,
  Download,
  File,
  ImageIcon,
  Video,
  Music,
  X,
  Eye,
  Share2,
  MoreVertical,
  Search,
  Filter,
  FolderOpen,
} from "lucide-react"

interface SharedFile {
  id: string
  name: string
  size: number
  type: string
  uploadedBy: string
  uploadedAt: Date
  url?: string
  progress?: number
  thumbnail?: string
  description?: string
  isPublic?: boolean
  downloadCount?: number
}

interface FileSharePanelProps {
  roomId: string
  userId: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_FILE_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "text/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-rar-compressed",
]

export function FileSharePanel({ roomId, userId }: FileSharePanelProps) {
  const [files, setFiles] = useState<SharedFile[]>([])
  const [uploading, setUploading] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "images" | "videos" | "documents" | "audio">("all")
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />
    if (type.startsWith("video/")) return <Video className="w-4 h-4" />
    if (type.startsWith("audio/")) return <Music className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const getFileCategory = (type: string) => {
    if (type.startsWith("image/")) return "images"
    if (type.startsWith("video/")) return "videos"
    if (type.startsWith("audio/")) return "audio"
    return "documents"
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`
    }

    const isAllowed = ALLOWED_FILE_TYPES.some((allowedType) => {
      if (allowedType.endsWith("/*")) {
        return file.type.startsWith(allowedType.slice(0, -1))
      }
      return file.type === allowedType
    })

    if (!isAllowed) {
      return "File type not supported"
    }

    return null
  }

  const generateThumbnail = async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith("image/")) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")
            const maxSize = 100

            let { width, height } = img
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width
                width = maxSize
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height
                height = maxSize
              }
            }

            canvas.width = width
            canvas.height = height
            ctx?.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL())
          }
          img.src = e.target?.result as string
        }
        reader.readAsDataURL(file)
      })
    }
    return undefined
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (selectedFiles: FileList) => {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const validationError = validateFile(file)

      if (validationError) {
        alert(`${file.name}: ${validationError}`)
        continue
      }

      const fileId = Date.now().toString() + i
      setUploading((prev) => [...prev, fileId])

      // Generate thumbnail for images
      const thumbnail = await generateThumbnail(file)

      const newFile: SharedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedBy: userId,
        uploadedAt: new Date(),
        progress: 0,
        thumbnail,
        downloadCount: 0,
        isPublic: true,
      }

      setFiles((prev) => [...prev, newFile])

      // Simulate upload progress
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          setUploading((prev) => prev.filter((id) => id !== fileId))

          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress: undefined, url: URL.createObjectURL(file) } : f)),
          )
        }

        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)))
      }, 200)
    }
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      await handleFileUpload(selectedFiles)
    }
    event.target.value = ""
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      await handleFileUpload(droppedFiles)
    }
  }, [])

  const handleDownload = (file: SharedFile) => {
    if (file.url) {
      const a = document.createElement("a")
      a.href = file.url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Update download count
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, downloadCount: (f.downloadCount || 0) + 1 } : f)))
    }
  }

  const handlePreview = (file: SharedFile) => {
    if (file.url) {
      window.open(file.url, "_blank")
    }
  }

  const handleRemove = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    setSelectedFiles((prev) => prev.filter((id) => id !== fileId))
  }

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterType === "all" || getFileCategory(file.type) === filterType
    return matchesSearch && matchesFilter
  })

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const fileTypeStats = files.reduce(
    (stats, file) => {
      const category = getFileCategory(file.type)
      stats[category] = (stats[category] || 0) + 1
      return stats
    },
    {} as Record<string, number>,
  )

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">File Sharing</h3>
            <p className="text-sm text-muted-foreground">
              {files.length} files • {formatFileSize(totalSize)}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedFiles.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedFiles([])}>
                Clear ({selectedFiles.length})
              </Button>
            )}
            <Button onClick={handleFileSelect} size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {filterType === "all" ? "All" : filterType}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40" align="end">
              <div className="space-y-1">
                {[
                  { value: "all", label: "All Files" },
                  { value: "images", label: "Images" },
                  { value: "videos", label: "Videos" },
                  { value: "audio", label: "Audio" },
                  { value: "documents", label: "Documents" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filterType === option.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType(option.value as any)}
                    className="w-full justify-start"
                  >
                    {option.label}
                    {fileTypeStats[option.value] && (
                      <Badge variant="secondary" className="ml-auto">
                        {fileTypeStats[option.value]}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div
          className={`p-4 ${dragOver ? "bg-accent/20 border-2 border-dashed border-accent" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="flex items-center justify-center py-8 text-accent">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">Drop files here to upload</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filteredFiles.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {files.length === 0 ? (
                  <>
                    <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No files shared yet</p>
                    <p className="text-sm">Upload files or drag & drop to share</p>
                  </>
                ) : (
                  <>
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No files match your search</p>
                  </>
                )}
              </div>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`border border-border rounded-lg p-3 transition-colors ${
                    selectedFiles.includes(file.id) ? "bg-accent/20 border-accent" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* File thumbnail/icon */}
                    <div className="flex-shrink-0">
                      {file.thumbnail ? (
                        <img
                          src={file.thumbnail || "/placeholder.svg"}
                          alt={file.name}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                          {getFileIcon(file.type)}
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.uploadedAt.toLocaleDateString()}</span>
                            {file.downloadCount && file.downloadCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{file.downloadCount} downloads</span>
                              </>
                            )}
                          </div>
                          {file.uploadedBy !== userId && (
                            <p className="text-xs text-muted-foreground mt-1">Shared by participant</p>
                          )}
                        </div>

                        {/* File actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFileSelection(file.id)}
                            className="h-8 w-8 p-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFiles.includes(file.id)}
                              onChange={() => {}}
                              className="w-4 h-4"
                            />
                          </Button>

                          {file.url && file.type.startsWith("image/") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(file)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}

                          {file.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(file)}
                              className="h-8 w-8 p-0"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40" align="end">
                              <div className="space-y-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownload(file)}
                                  className="w-full justify-start"
                                  disabled={!file.url}
                                >
                                  <Download className="w-3 h-3 mr-2" />
                                  Download
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (file.url) navigator.clipboard.writeText(file.url)
                                  }}
                                  className="w-full justify-start"
                                  disabled={!file.url}
                                >
                                  <Share2 className="w-3 h-3 mr-2" />
                                  Copy Link
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemove(file.id)}
                                  className="w-full justify-start text-destructive"
                                >
                                  <X className="w-3 h-3 mr-2" />
                                  Remove
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* Upload progress */}
                      {typeof file.progress === "number" && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-1" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploading... {Math.round(file.progress)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        accept={ALLOWED_FILE_TYPES.join(",")}
      />
    </div>
  )
}
