"use client"

import type React from "react"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  className?: string
  resizable?: boolean
}

export function ResizablePanel({
  children,
  defaultWidth = 400,
  defaultHeight = 300,
  minWidth = 200,
  minHeight = 150,
  maxWidth = 800,
  maxHeight = 600,
  className,
  resizable = true,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [height, setHeight] = useState(defaultHeight)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>("")
  const panelRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ width: 0, height: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizable) return

      const deltaX = e.clientX - startPos.current.x
      const deltaY = e.clientY - startPos.current.y

      let newWidth = startSize.current.width
      let newHeight = startSize.current.height

      if (resizeDirection.includes("right")) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.current.width + deltaX))
      }
      if (resizeDirection.includes("left")) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.current.width - deltaX))
      }
      if (resizeDirection.includes("bottom")) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.current.height + deltaY))
      }
      if (resizeDirection.includes("top")) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.current.height - deltaY))
      }

      setWidth(newWidth)
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeDirection("")
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = getResizeCursor(resizeDirection)
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, resizeDirection, minWidth, minHeight, maxWidth, maxHeight, resizable])

  const handleMouseDown = (direction: string) => (e: React.MouseEvent) => {
    if (!resizable) return

    e.preventDefault()
    setIsResizing(true)
    setResizeDirection(direction)
    startPos.current = { x: e.clientX, y: e.clientY }
    startSize.current = { width, height }
  }

  const getResizeCursor = (direction: string) => {
    if (direction.includes("right") && direction.includes("bottom")) return "nw-resize"
    if (direction.includes("left") && direction.includes("bottom")) return "ne-resize"
    if (direction.includes("right") && direction.includes("top")) return "sw-resize"
    if (direction.includes("left") && direction.includes("top")) return "se-resize"
    if (direction.includes("right") || direction.includes("left")) return "ew-resize"
    if (direction.includes("top") || direction.includes("bottom")) return "ns-resize"
    return "default"
  }

  return (
    <div
      ref={panelRef}
      className={cn("relative bg-background border rounded-lg overflow-hidden", className)}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {children}

      {resizable && (
        <>
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("top-left")}
          />
          <div
            className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("top-right")}
          />
          <div
            className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("bottom-left")}
          />
          <div
            className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("bottom-right")}
          />

          {/* Edge handles */}
          <div
            className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("top")}
          />
          <div
            className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("bottom")}
          />
          <div
            className="absolute left-0 top-2 bottom-2 w-1 cursor-ew-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("left")}
          />
          <div
            className="absolute right-0 top-2 bottom-2 w-1 cursor-ew-resize opacity-0 hover:opacity-100 bg-primary/20"
            onMouseDown={handleMouseDown("right")}
          />
        </>
      )}
    </div>
  )
}
