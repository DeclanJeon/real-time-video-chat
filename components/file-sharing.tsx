// file-sharing.tsx
"use client"

import { Label } from "@/components/ui/label"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, Download, File, X } from "lucide-react"

interface FileInfo {
  id: string
  name: string
  size: number
  type: string
  progress?: number
  status: "uploading" | "completed" | "failed"
}

interface FileSharingProps {
  onFileShare: (file: File) => void
  sharedFiles: FileInfo[]
  onDownloadFile: (fileId: string) => void
}

export function FileSharing({ onFileShare, sharedFiles, onDownloadFile }: FileSharingProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0]
      // 파일 크기 제한 (100MB)
      if (file.size > 100 * 1024 * 1024) {
        alert("파일 크기는 100MB를 초과할 수 없습니다.")
        return
      }
      onFileShare(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold">파일 공유</h3>

      {/* 파일 업로드 영역 */}
      <Card
        className={`p-6 border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-xs text-muted-foreground mt-1">최대 100MB</p>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
      </Card>

      {/* 공유된 파일 목록 */}
      <div className="space-y-2">
        <Label className="font-medium">공유된 파일</Label>
        {sharedFiles.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            <p className="text-sm">공유된 파일이 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {sharedFiles.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>

                  {file.status === "uploading" && file.progress !== undefined ? (
                    <div className="w-20">
                      <Progress value={file.progress} className="h-2" />
                    </div>
                  ) : file.status === "completed" ? (
                    <Button size="sm" variant="outline" onClick={() => onDownloadFile(file.id)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
