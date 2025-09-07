import { io, type Socket } from "socket.io-client"

class SocketManager {
  private socket: Socket | null = null
  private static instance: SocketManager

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager()
    }
    return SocketManager.instance
  }

  connect(): Socket {
    if (!this.socket) {
      this.socket = io("http://localhost:3001", {
        transports: ["websocket", "polling"],
        autoConnect: true,
      })

      this.socket.on("connect", () => {
        console.log("[v0] Connected to signaling server:", this.socket?.id)
      })

      this.socket.on("disconnect", () => {
        console.log("[v0] Disconnected from signaling server")
      })

      this.socket.on("connect_error", (error) => {
        console.error("[v0] Socket connection error:", error)
      })
    }

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export default SocketManager
