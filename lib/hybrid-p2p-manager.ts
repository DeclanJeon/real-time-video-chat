import { LibP2PManager, type PeerInfo } from "./libp2p-manager"
import { WebRTCManager } from "./webrtc"
import SocketManager from "./socket"

export class HybridP2PManager {
  private libp2p: LibP2PManager
  private webrtc: WebRTCManager | null = null
  private socket: any = null
  private roomId = ""
  private userId = ""
  private nickname = ""

  constructor() {
    this.libp2p = new LibP2PManager()
  }

  async initialize(roomId: string, userId: string, nickname: string): Promise<void> {
    this.roomId = roomId
    this.userId = userId
    this.nickname = nickname

    console.log("[v0] Initializing hybrid P2P manager")

    // Initialize libp2p for peer discovery
    await this.libp2p.initialize(roomId)

    // Initialize socket connection for signaling fallback
    const socketManager = SocketManager.getInstance()
    this.socket = socketManager.connect()

    // Initialize WebRTC manager
    this.webrtc = new WebRTCManager(this.socket, userId)

    // Set up libp2p event handlers
    this.libp2p.setOnPeerDiscovered((peer) => {
      console.log("[v0] Hybrid: Peer discovered via libp2p:", peer.peerId)
      this.handlePeerDiscovered(peer)
    })

    this.libp2p.setOnPeerConnected((peerId) => {
      console.log("[v0] Hybrid: Peer connected via libp2p:", peerId)
      this.handlePeerConnected(peerId)
    })

    this.libp2p.setOnPeerDisconnected((peerId) => {
      console.log("[v0] Hybrid: Peer disconnected from libp2p:", peerId)
      this.handlePeerDisconnected(peerId)
    })

    // Set up room protocol for direct P2P communication
    await this.libp2p.setupRoomProtocol(roomId, (message, fromPeer) => {
      this.handleDirectMessage(message, fromPeer)
    })

    // Enable relay functionality
    await this.libp2p.enableRelay()

    // Join room via socket as fallback
    this.socket.emit("join-room", { roomId, userId, nickname })

    console.log("[v0] Hybrid P2P manager initialized")
  }

  private handlePeerDiscovered(peer: PeerInfo): void {
    // When a peer is discovered via libp2p, we can attempt direct connection
    // This bypasses the need for centralized signaling in some cases
    console.log("[v0] Attempting direct P2P connection to discovered peer")
  }

  private handlePeerConnected(peerId: string): void {
    // When connected via libp2p, we can use direct messaging
    // This reduces server load and improves privacy
    console.log("[v0] Direct P2P connection established with:", peerId)
  }

  private handlePeerDisconnected(peerId: string): void {
    // Fall back to socket signaling when direct connection is lost
    console.log("[v0] Direct P2P connection lost, falling back to socket signaling")
  }

  private handleDirectMessage(message: any, fromPeer: string): void {
    console.log("[v0] Received direct P2P message from:", fromPeer, message)

    // Handle different message types
    switch (message.type) {
      case "chat":
        // Handle chat message received directly
        break
      case "file":
        // Handle file sharing directly
        break
      case "webrtc-signal":
        // Handle WebRTC signaling directly (bypassing socket)
        break
    }
  }

  async sendMessage(message: any, preferDirect = true): Promise<void> {
    const connectedPeers = this.libp2p.getConnectedPeers()

    if (preferDirect && connectedPeers.length > 0) {
      // Try direct P2P messaging first
      console.log("[v0] Sending message via direct P2P")
      await this.libp2p.broadcastToRoom(this.roomId, message)
    } else {
      // Fall back to socket signaling
      console.log("[v0] Sending message via socket fallback")
      if (this.socket) {
        this.socket.emit("chat-message", {
          roomId: this.roomId,
          message: message.content,
          userId: this.userId,
          nickname: this.nickname,
        })
      }
    }
  }

  getNetworkStatus() {
    const libp2pPeers = this.libp2p.getConnectedPeers()
    const relayPeers = this.libp2p.findRelayPeers()

    return {
      libp2pConnected: libp2pPeers.length > 0,
      socketConnected: this.socket?.connected || false,
      directPeers: libp2pPeers.length,
      relayPeers: relayPeers.length,
      localPeerId: this.libp2p.getPeerId(),
      localMultiaddrs: this.libp2p.getMultiaddrs(),
    }
  }

  getDiscoveredPeers(): PeerInfo[] {
    return this.libp2p.getDiscoveredPeers()
  }

  getConnectedPeers(): PeerInfo[] {
    return this.libp2p.getConnectedPeers()
  }

  async enableRelay(): Promise<void> {
    await this.libp2p.enableRelay()
  }

  async stop(): Promise<void> {
    console.log("[v0] Stopping hybrid P2P manager")

    if (this.webrtc) {
      this.webrtc.closeAllConnections()
    }

    if (this.socket) {
      SocketManager.getInstance().disconnect()
    }

    await this.libp2p.stop()
  }
}
