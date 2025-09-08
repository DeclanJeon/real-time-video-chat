"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Pen, Eraser, Square, Circle, Minus, Trash2, Download, Undo, Redo } from "lucide-react"

interface WhiteboardProps {
  onDrawingData?: (data: any) => void
  onReceiveDrawingData?: (callback: (data: any) => void) => void
  isVisible: boolean
}

interface DrawingPoint {
  x: number
  y: number
  pressure?: number
}

interface DrawingStroke {
  id: string
  tool: "pen" | "eraser" | "line" | "rectangle" | "circle"
  points: DrawingPoint[]
  color: string
  size: number
  timestamp: number
}

const COLORS = [
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#008000",
  "#800000",
  "#000080",
]

export function Whiteboard({ onDrawingData, onReceiveDrawingData, isVisible }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentTool, setCurrentTool] = useState<"pen" | "eraser" | "line" | "rectangle" | "circle">("pen")
  const [currentColor, setCurrentColor] = useState("#000000")
  const [brushSize, setBrushSize] = useState([3])
  const [strokes, setStrokes] = useState<DrawingStroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null)
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([])
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([])
  const [startPoint, setStartPoint] = useState<DrawingPoint | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number,
      clientY: number,
      pressure = 1

    if ("touches" in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
      pressure = (touch as any).force || 1
    } else {
      // Mouse event
      clientX = e.clientX
      clientY = e.clientY
      pressure = (e as any).pressure || 1
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      pressure,
    }
  }, [])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length === 0) return

    ctx.save()
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over"
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (stroke.tool === "pen" || stroke.tool === "eraser") {
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
    } else if (stroke.tool === "line" && stroke.points.length >= 2) {
      const start = stroke.points[0]
      const end = stroke.points[stroke.points.length - 1]
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    } else if (stroke.tool === "rectangle" && stroke.points.length >= 2) {
      const start = stroke.points[0]
      const end = stroke.points[stroke.points.length - 1]
      const width = end.x - start.x
      const height = end.y - start.y
      ctx.strokeRect(start.x, start.y, width, height)
    } else if (stroke.tool === "circle" && stroke.points.length >= 2) {
      const start = stroke.points[0]
      const end = stroke.points[stroke.points.length - 1]
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
      ctx.beginPath()
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI)
      ctx.stroke()
    }

    ctx.restore()
  }, [])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set white background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw all strokes
    strokes.forEach((stroke) => drawStroke(ctx, stroke))

    // Draw current stroke if drawing
    if (currentStroke) {
      drawStroke(ctx, currentStroke)
    }
  }, [strokes, currentStroke, drawStroke])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  useEffect(() => {
    if (onReceiveDrawingData) {
      onReceiveDrawingData((data: any) => {
        if (data.type === "stroke") {
          setStrokes((prev) => [...prev, data.stroke])
        } else if (data.type === "clear") {
          setStrokes([])
        }
      })
    }
  }, [onReceiveDrawingData])

  const handleStart = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const point = getCanvasPoint(e)
      setIsDrawing(true)
      setStartPoint(point)

      const newStroke: DrawingStroke = {
        id: Date.now().toString(),
        tool: currentTool,
        points: [point],
        color: currentColor,
        size: brushSize[0],
        timestamp: Date.now(),
      }

      setCurrentStroke(newStroke)
    },
    [getCanvasPoint, currentTool, currentColor, brushSize],
  )

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentStroke) return
      e.preventDefault()

      const point = getCanvasPoint(e)

      if (currentTool === "pen" || currentTool === "eraser") {
        setCurrentStroke((prev) =>
          prev
            ? {
                ...prev,
                points: [...prev.points, point],
              }
            : null,
        )
      } else {
        // For shapes, only keep start and current point
        setCurrentStroke((prev) =>
          prev
            ? {
                ...prev,
                points: [prev.points[0], point],
              }
            : null,
        )
      }
    },
    [isDrawing, currentStroke, getCanvasPoint, currentTool],
  )

  const handleEnd = useCallback(() => {
    if (!isDrawing || !currentStroke) return

    setIsDrawing(false)

    // Add to undo stack
    setUndoStack((prev) => [...prev, strokes])
    setRedoStack([]) // Clear redo stack

    // Add stroke to strokes
    setStrokes((prev) => [...prev, currentStroke])

    // Send drawing data to peer
    if (onDrawingData) {
      onDrawingData({
        type: "stroke",
        stroke: currentStroke,
      })
    }

    setCurrentStroke(null)
    setStartPoint(null)
  }, [isDrawing, currentStroke, strokes, onDrawingData])

  const clearCanvas = useCallback(() => {
    setUndoStack((prev) => [...prev, strokes])
    setRedoStack([])
    setStrokes([])

    if (onDrawingData) {
      onDrawingData({ type: "clear" })
    }
  }, [strokes, onDrawingData])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return

    const previousState = undoStack[undoStack.length - 1]
    setRedoStack((prev) => [...prev, strokes])
    setStrokes(previousState)
    setUndoStack((prev) => prev.slice(0, -1))
  }, [undoStack, strokes])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return

    const nextState = redoStack[redoStack.length - 1]
    setUndoStack((prev) => [...prev, strokes])
    setStrokes(nextState)
    setRedoStack((prev) => prev.slice(0, -1))
  }, [redoStack, strokes])

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }, [])

  if (!isVisible) return null

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={`${isMobile ? "text-base" : "text-lg"}`}>Whiteboard</CardTitle>
          <Badge variant="outline" className="text-xs">
            {strokes.length} strokes
          </Badge>
        </div>

        <div className={`flex flex-wrap gap-1 ${isMobile ? "gap-1" : "gap-2"}`}>
          <div className="flex gap-1">
            <Button
              variant={currentTool === "pen" ? "default" : "outline"}
              size={isMobile ? "sm" : "sm"}
              onClick={() => setCurrentTool("pen")}
            >
              <Pen className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button
              variant={currentTool === "eraser" ? "default" : "outline"}
              size={isMobile ? "sm" : "sm"}
              onClick={() => setCurrentTool("eraser")}
            >
              <Eraser className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button
              variant={currentTool === "line" ? "default" : "outline"}
              size={isMobile ? "sm" : "sm"}
              onClick={() => setCurrentTool("line")}
            >
              <Minus className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button
              variant={currentTool === "rectangle" ? "default" : "outline"}
              size={isMobile ? "sm" : "sm"}
              onClick={() => setCurrentTool("rectangle")}
            >
              <Square className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button
              variant={currentTool === "circle" ? "default" : "outline"}
              size={isMobile ? "sm" : "sm"}
              onClick={() => setCurrentTool("circle")}
            >
              <Circle className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={undo} disabled={undoStack.length === 0}>
              <Undo className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={redo} disabled={redoStack.length === 0}>
              <Redo className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={clearCanvas}>
              <Trash2 className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={downloadCanvas}>
              <Download className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
            </Button>
          </div>
        </div>

        {/* Color palette */}
        <div className="flex gap-1 flex-wrap">
          {COLORS.map((color) => (
            <button
              key={color}
              className={`${isMobile ? "w-5 h-5" : "w-6 h-6"} rounded border-2 ${
                currentColor === color ? "border-primary" : "border-gray-300"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setCurrentColor(color)}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className={`${isMobile ? "text-xs" : "text-sm"}`}>Size:</span>
          <Slider
            value={brushSize}
            onValueChange={setBrushSize}
            max={20}
            min={1}
            step={1}
            className={`flex-1 ${isMobile ? "max-w-20" : "max-w-32"}`}
          />
          <span className={`${isMobile ? "text-xs w-6" : "text-sm w-8"}`}>{brushSize[0]}</span>
        </div>
      </CardHeader>

      <CardContent className="p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full border border-border rounded cursor-crosshair bg-white touch-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{ touchAction: "none" }} // Prevent scrolling on touch
        />
      </CardContent>
    </Card>
  )
}
