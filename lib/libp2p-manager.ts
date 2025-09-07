import { createLibp2p, type Libp2p } from "libp2p"
import { webRTC } from "@libp2p/webrtc"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@libp2p/noise"
import { yamux } from "@libp2p/yamux"
import { bootstrap } from "@libp2p/bootstrap"
import { identify } from "@libp2p/identify"
import { ping } from "@libp2p/ping"
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"
import { dcutr } from "@libp2p/dcutr"
import { PeerRelayManager, type RelayMetrics } from "./peer-relay-manager"

export interface PeerInfo {
  peerId: string
  multiaddrs: string[]
  protocols: string[]
  isConnected: boolean
  lastSeen: number
}

export class LibP2PManager {
  private node: Libp2p | null = null
  private discoveredPeers = new Map<string, PeerInfo>()
  private relayManager: PeerRelayManager | null = null
  private onPeerDiscovered?: (peer: PeerInfo) => void
  private onPeerConnected?: (peerId: string) => void
  private onPeerDisconnected?: (peerId: string) => void
  private onRelayStatusChange?: (status: RelayMetrics) => void

  async initialize(roomId: string): Promise<void> {
    try {
      console.log("[v0] Initializing libp2p node for room:", roomId)

      this.node = await createLibp2p({
        addresses: {
          listen: ["/webrtc", "/ws/0.0.0.0/0"],
        },
        transports: [
          webRTC(),
          webSockets(),
          circuitRelayTransport({
            discoverRelays: 2,
          }),
        ],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
          bootstrap({
            list: [
              // Public bootstrap nodes - in production, use your own
              "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
              "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
            ],
          }),
        ],
        services: {
          identify: identify(),
          ping: ping(),
          dcutr: dcutr(),
        },
        connectionManager: {
          maxConnections: 100,
          minConnections: 5,
        },
      })

      this.relayManager = new PeerRelayManager(this.node)
      this.relayManager.setOnRelayStatusChange((status) => {
        if (this.onRelayStatusChange) {
          this.onRelayStatusChange(status)
        }
      })

      this.setupEventListeners()
      await this.node.start()

      console.log("[v0] libp2p node started with PeerId:", this.node.peerId.toString())
      console.log(
        "[v0] Listening on addresses:",
        this.node.getMultiaddrs().map((ma) => ma.toString()),
      )
    } catch (error) {
      console.error("[v0] Failed to initialize libp2p:", error)
      throw error
    }
  }

  private setupEventListeners(): void {
    if (!this.node) return

    // Peer discovery events
    this.node.addEventListener("peer:discovery", (event) => {
      const peerId = event.detail.id.toString()
      const multiaddrs = event.detail.multiaddrs.map((ma) => ma.toString())

      console.log("[v0] Discovered peer:", peerId)

      const peerInfo: PeerInfo = {
        peerId,
        multiaddrs,
        protocols: [],
        isConnected: false,
        lastSeen: Date.now(),
      }

      this.discoveredPeers.set(peerId, peerInfo)

      if (this.onPeerDiscovered) {
        this.onPeerDiscovered(peerInfo)
      }

      // Attempt to connect to discovered peer
      this.connectToPeer(peerId).catch(console.error)
    })

    // Connection events
    this.node.addEventListener("peer:connect", (event) => {
      const peerId = event.detail.toString()
      console.log("[v0] Connected to peer:", peerId)

      const peerInfo = this.discoveredPeers.get(peerId)
      if (peerInfo) {
        peerInfo.isConnected = true
        peerInfo.lastSeen = Date.now()
      }

      if (this.onPeerConnected) {
        this.onPeerConnected(peerId)
      }
    })

    this.node.addEventListener("peer:disconnect", (event) => {
      const peerId = event.detail.toString()
      console.log("[v0] Disconnected from peer:", peerId)

      const peerInfo = this.discoveredPeers.get(peerId)
      if (peerInfo) {
        peerInfo.isConnected = false
      }

      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(peerId)
      }
    })

    // Protocol identification
    this.node.addEventListener("peer:identify", (event) => {
      const peerId = event.detail.peerId.toString()
      const protocols = event.detail.protocols

      console.log("[v0] Identified peer protocols:", peerId, protocols)

      const peerInfo = this.discoveredPeers.get(peerId)
      if (peerInfo) {
        peerInfo.protocols = protocols
      }
    })
  }

  private async connectToPeer(peerId: string): Promise<void> {
    if (!this.node) return

    try {
      const peerInfo = this.discoveredPeers.get(peerId)
      if (!peerInfo || peerInfo.isConnected) return

      console.log("[v0] Attempting to connect to peer:", peerId)

      // Try to dial the peer using its multiaddrs
      for (const multiaddr of peerInfo.multiaddrs) {
        try {
          await this.node.dial(multiaddr)
          console.log("[v0] Successfully connected to peer via:", multiaddr)
          break
        } catch (error) {
          console.warn("[v0] Failed to connect via:", multiaddr, error)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to connect to peer:", peerId, error)
    }
  }

  async broadcastToRoom(roomId: string, message: any): Promise<void> {
    if (!this.node) return

    const connectedPeers = this.getConnectedPeers()
    console.log("[v0] Broadcasting to", connectedPeers.length, "peers in room:", roomId)

    for (const peer of connectedPeers) {
      try {
        const stream = await this.node.dialProtocol(peer.peerId, `/video-chat/${roomId}/1.0.0`)
        const encoder = new TextEncoder()
        const data = encoder.encode(JSON.stringify(message))

        await stream.sink([data])
        await stream.close()
      } catch (error) {
        console.error("[v0] Failed to send message to peer:", peer.peerId, error)
      }
    }
  }

  async setupRoomProtocol(roomId: string, messageHandler: (message: any, fromPeer: string) => void): Promise<void> {
    if (!this.node) return

    const protocol = `/video-chat/${roomId}/1.0.0`

    await this.node.handle(protocol, ({ stream, connection }) => {
      console.log("[v0] Received stream for room protocol:", roomId, "from:", connection.remotePeer.toString())

      // Handle incoming messages
      const decoder = new TextDecoder()

      stream.source.forEach(async (chunk) => {
        try {
          const message = JSON.parse(decoder.decode(chunk.subarray()))
          messageHandler(message, connection.remotePeer.toString())
        } catch (error) {
          console.error("[v0] Failed to parse room message:", error)
        }
      })
    })

    console.log("[v0] Room protocol handler set up for:", protocol)
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values()).filter((peer) => peer.isConnected)
  }

  getDiscoveredPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values())
  }

  getPeerId(): string | null {
    return this.node?.peerId.toString() || null
  }

  getMultiaddrs(): string[] {
    return this.node?.getMultiaddrs().map((ma) => ma.toString()) || []
  }

  setOnPeerDiscovered(callback: (peer: PeerInfo) => void): void {
    this.onPeerDiscovered = callback
  }

  setOnPeerConnected(callback: (peerId: string) => void): void {
    this.onPeerConnected = callback
  }

  setOnPeerDisconnected(callback: (peerId: string) => void): void {
    this.onPeerDisconnected = callback
  }

  async stop(): Promise<void> {
    if (this.node) {
      console.log("[v0] Stopping libp2p node")
      await this.node.stop()
      this.node = null
      this.discoveredPeers.clear()
    }
  }

  // Relay functionality for hybrid P2P
  async enableRelay(maxConnections = 10, bandwidthLimit = 1024 * 1024): Promise<void> {
    if (!this.relayManager) return

    try {
      this.relayManager.enableRelay(maxConnections, bandwidthLimit)
      console.log("[v0] Enhanced relay functionality enabled")
    } catch (error) {
      console.error("[v0] Failed to enable relay:", error)
    }
  }

  async connectToPeerViaRelay(targetPeerId: string): Promise<boolean> {
    if (!this.relayManager) return false

    try {
      const bestRelay = await this.relayManager.findBestRelay(targetPeerId)
      if (!bestRelay) {
        console.log("[v0] No suitable relay found for:", targetPeerId)
        return false
      }

      const connectionId = await this.relayManager.requestRelay(targetPeerId, bestRelay)
      if (connectionId) {
        console.log("[v0] Successfully connected via relay:", connectionId)
        return true
      }

      return false
    } catch (error) {
      console.error("[v0] Failed to connect via relay:", error)
      return false
    }
  }

  async findRelayPeers(): Promise<PeerInfo[]> {
    const relayPeers = this.getConnectedPeers().filter((peer) =>
      peer.protocols.includes("/libp2p/circuit/relay/0.2.0/hop"),
    )

    console.log("[v0] Found", relayPeers.length, "relay peers")
    return relayPeers
  }

  getRelayMetrics(): RelayMetrics | null {
    return this.relayManager?.getRelayMetrics() || null
  }

  getActiveRelayConnections() {
    return this.relayManager?.getActiveRelayConnections() || []
  }

  setOnRelayStatusChange(callback: (status: RelayMetrics) => void): void {
    this.onRelayStatusChange = callback
  }

  isRelayEnabled(): boolean {
    return this.relayManager?.isRelayActive() || false
  }
}
