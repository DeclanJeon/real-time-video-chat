"use client"
// file-share-panel.tsx

import type React from "react"
import { useState, useRef, useCallback, useMemo } from "react"
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
  CheckSquare,
  Square,
  Trash2,
  Copy,
} from "lucide-react"

import { FileState } from "@/hooks/useFileTransfer"

interface FileSharePanelProps {
  roomId: string
  userId: string
  files: FileState[]
  onFileUpload: (files: FileList) => void
  onFileDownload?: (fileId: string) => void
  onFileRemove?: (fileId: string) => void
  onFilePreview?: (file: FileState) => void
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

type FilterType = "all" | "images" | "videos" | "documents" | "audio"

export function FileSharePanel({
  roomId,
  userId,
  files: propFiles,
  onFileUpload,
  onFileDownload,
  onFileRemove,
  onFilePreview
}: FileSharePanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileIcon = useCallback((type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />
    if (type.startsWith("video/")) return <Video className="w-4 h-4" />
    if (type.startsWith("audio/")) return <Music className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }, [])

  const getFileCategory = useCallback((type: string): FilterType => {
    if (type.startsWith("image/")) return "images"
    if (type.startsWith("video/")) return "videos"
    if (type.startsWith("audio/")) return "audio"
    return "documents"
  }, [])

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }, [])

  const validateFile = useCallback((file: File): string | null => {
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
  }, [formatFileSize])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileUpload = useCallback(async (selectedFiles: FileList) => {
    const validFiles: File[] = []
    const errors: string[] = []

    Array.from(selectedFiles).forEach(file => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      console.error("File validation errors:", errors)
      // [추론] 에러 처리 로직이 필요할 수 있으나, 현재 props에 에러 핸들러가 없음
    }

    if (validFiles.length > 0 && onFileUpload) {
      const dataTransfer = new DataTransfer()
      validFiles.forEach(file => dataTransfer.items.add(file))
      onFileUpload(dataTransfer.files)
    }
  }, [onFileUpload, validateFile])

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      await handleFileUpload(selectedFiles)
    }
    event.target.value = ""
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      await handleFileUpload(droppedFiles)
    }
  }, [handleFileUpload])

  const handleDownload = useCallback((file: FileState) => {
    if (onFileDownload) {
      onFileDownload(file.id)
    } else if (file.url) {
      const a = document.createElement("a")
      a.href = file.url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }, [onFileDownload])

  const handlePreview = useCallback((file: FileState) => {
    if (onFilePreview) {
      onFilePreview(file)
    } else if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer")
    }
  }, [onFilePreview])

  const handleRemove = useCallback((fileId: string) => {
    if (onFileRemove) {
      onFileRemove(fileId)
    }
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      newSet.delete(fileId)
      return newSet
    })
  }, [onFileRemove])

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      return newSet
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  const copyFileLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      // [추론] Toast 알림이 있으면 좋겠지만 현재 구현되지 않음
    } catch (error) {
      console.error("Failed to copy link:", error)
    }
  }, [])

  const filteredFiles = useMemo(() => {
    return propFiles.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterType === "all" || getFileCategory(file.type) === filterType
      return matchesSearch && matchesFilter
    })
  }, [propFiles, searchQuery, filterType, getFileCategory])

  const fileStats = useMemo(() => {
    const totalSize = propFiles.reduce((sum, file) => sum + file.size, 0)
    const typeStats = propFiles.reduce((stats, file) => {
      const category = getFileCategory(file.type)
      stats[category] = (stats[category] || 0) + 1
      return stats
    }, {} as Record<string, number>)
    
    return { totalSize, typeStats }
  }, [propFiles, getFileCategory])

  const isImageFile = useCallback((type: string) => type.startsWith("image/"), [])

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">File Sharing</h3>
            <p className="text-sm text-muted-foreground">
              {propFiles.length} files • {formatFileSize(fileStats.totalSize)}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedFiles.size > 0 && (
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear ({selectedFiles.size})
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
                {filterType === "all" ? "All" : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40" align="end">
              <div className="space-y-1">
                {[
                  { value: "all" as FilterType, label: "All Files" },
                  { value: "images" as FilterType, label: "Images" },
                  { value: "videos" as FilterType, label: "Videos" },
                  { value: "audio" as FilterType, label: "Audio" },
                  { value: "documents" as FilterType, label: "Documents" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filterType === option.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType(option.value)}
                    className="w-full justify-start"
                  >
                    {option.label}
                    {option.value !== "all" && fileStats.typeStats[option.value] > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {fileStats.typeStats[option.value]}
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
          className={`min-h-full p-4 transition-colors ${
            dragOver ? "bg-accent/20 border-2 border-dashed border-accent rounded-lg" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragOver ? (
            <div className="flex items-center justify-center py-8 text-accent">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-2" />
                <p className="font-medium">Drop files here to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Max size: {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {propFiles.length === 0 ? (
                    <>
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No files shared yet</p>
                      <p className="text-sm mt-1">Upload files or drag & drop to share</p>
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
                    className={`border border-border rounded-lg p-3 transition-all ${
                      selectedFiles.has(file.id) 
                        ? "bg-accent/10 border-accent shadow-sm" 
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* File thumbnail/icon */}
                      <div className="flex-shrink-0">
                        {file.url && isImageFile(file.type) ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-12 h-12 object-cover rounded border"
                            loading="lazy"
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
                            <p className="text-sm font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>{formatFileSize(file.size)}</span>
                              <span>•</span>
                              <span>
                                {file.status === 'sending' 
                                  ? 'Sending' 
                                  : file.status === 'receiving' 
                                  ? 'Receiving' 
                                  : 'Shared'}
                              </span>
                            </div>
                          </div>

                          {/* File actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFileSelection(file.id)}
                              className="h-8 w-8 p-0"
                              aria-label={selectedFiles.has(file.id) ? "Deselect file" : "Select file"}
                            >
                              {selectedFiles.has(file.id) ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </Button>

                            {file.url && isImageFile(file.type) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(file)}
                                className="h-8 w-8 p-0"
                                aria-label="Preview file"
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
                                aria-label="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}

                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  aria-label="More options"
                                >
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
                                    onClick={() => file.url && copyFileLink(file.url)}
                                    className="w-full justify-start"
                                    disabled={!file.url}
                                  >
                                    <Copy className="w-3 h-3 mr-2" />
                                    Copy Link
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(file.id)}
                                    className="w-full justify-start text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    Remove
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Upload/Download progress */}
                        {typeof file.progress === 'number' && file.progress < 100 && (
                          <div className="mt-2">
                            <Progress value={file.progress} className="h-1" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {file.status === 'sending' ? 'Uploading...' : 'Downloading...'} {Math.round(file.progress)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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
        aria-hidden="true"
      />
    </div>
  )
}