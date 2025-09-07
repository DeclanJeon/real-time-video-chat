import type { NextRequest } from "next/server"
import { Server as SocketIOServer } from "socket.io"
import { Server as HTTPServer } from "http"

let io: SocketIOServer | null = null

// Room management
const rooms = new Map<string, Set<string>>()
const userSockets = new Map<string, string>() // userId -> socketId

export async function GET(req: NextRequest) {
  if (!io) {
    // Initialize Socket.io server
    const httpServer = new HTTPServer()
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    })

    io.on("connection", (socket) => {
      console.log("[v0] Socket connected:", socket.id)

      // Join room
      socket.on("join-room", ({ roomId, userId, nickname }) => {
        console.log("[v0] User joining room:", { roomId, userId, nickname })

        socket.join(roomId)
        userSockets.set(userId, socket.id)

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        rooms.get(roomId)!.add(userId)

        // Notify other users in the room
        socket.to(roomId).emit("user-joined", { userId, nickname })

        // Send current room users to the new user
        const roomUsers = Array.from(rooms.get(roomId)!)
        socket.emit(
          "room-users",
          roomUsers.filter((id) => id !== userId),
        )
      })

      // WebRTC signaling
      socket.on("offer", ({ targetUserId, offer }) => {
        const targetSocketId = userSockets.get(targetUserId)
        if (targetSocketId) {
          io!.to(targetSocketId).emit("offer", {
            fromUserId: getUserIdBySocket(socket.id),
            offer,
          })
        }
      })

      socket.on("answer", ({ targetUserId, answer }) => {
        const targetSocketId = userSockets.get(targetUserId)
        if (targetSocketId) {
          io!.to(targetSocketId).emit("answer", {
            fromUserId: getUserIdBySocket(socket.id),
            answer,
          })
        }
      })

      socket.on("ice-candidate", ({ targetUserId, candidate }) => {
        const targetSocketId = userSockets.get(targetUserId)
        if (targetSocketId) {
          io!.to(targetSocketId).emit("ice-candidate", {
            fromUserId: getUserIdBySocket(socket.id),
            candidate,
          })
        }
      })

      // Chat messages
      socket.on("chat-message", ({ roomId, message, userId, nickname }) => {
        socket.to(roomId).emit("chat-message", { message, userId, nickname, timestamp: Date.now() })
      })

      // File sharing
      socket.on("file-share", ({ roomId, fileData, userId, nickname }) => {
        socket.to(roomId).emit("file-share", { fileData, userId, nickname, timestamp: Date.now() })
      })

      // Disconnect handling
      socket.on("disconnect", () => {
        console.log("[v0] Socket disconnected:", socket.id)
        const userId = getUserIdBySocket(socket.id)
        if (userId) {
          userSockets.delete(userId)
          // Remove from all rooms
          rooms.forEach((users, roomId) => {
            if (users.has(userId)) {
              users.delete(userId)
              socket.to(roomId).emit("user-left", { userId })
              if (users.size === 0) {
                rooms.delete(roomId)
              }
            }
          })
        }
      })
    })

    // Helper function
    function getUserIdBySocket(socketId: string): string | null {
      for (const [userId, sId] of userSockets.entries()) {
        if (sId === socketId) return userId
      }
      return null
    }

    httpServer.listen(3001)
    console.log("[v0] Socket.io server started on port 3001")
  }

  return new Response("Socket.io server running", { status: 200 })
}
