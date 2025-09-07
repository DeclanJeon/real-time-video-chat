import type { Libp2p } from "libp2p"

export interface RelayConnection {
  relayPeerId: string
  targetPeerId: string
  connectionId: string
  bandwidth: number
  latency: number
  isActive: boolean
  createdAt: number
  lastActivity: number
}

export interface RelayMetrics {
  totalConnections: number
  activeRelays: number
  bandwidthUsed: number
  averageLatency: number
  successRate: number
}

export class PeerRelayManager {
  private node: Libp2p | null = null
  private relayConnections = new Map<string, RelayConnection>()
  private relayMetrics: RelayMetrics = {
    totalConnections: 0,
    activeRelays: 0,
    bandwidthUsed: 0,
    averageLatency: 0,
    successRate: 0,
  }
  private isRelayEnabled = false
  private maxRelayConnections = 10
  private relayBandwidthLimit = 1024 * 1024 // 1MB/s
  private onRelayStatusChange?: (status: RelayMetrics) => void

  constructor(node: Libp2p) {
    this.node = node
    this.setupRelayHandlers()
  }

  private setupRelayHandlers(): void {
    if (!this.node) return

    this.node.addEventListener("peer:connect", (event) => {
      const peerId = event.detail.toString()
      this.evaluateRelayCapability(peerId)
    })

    this.node.addEventListener("peer:disconnect", (event) => {
      const peerId = event.detail.toString()
      this.cleanupRelayConnections(peerId)
    })

    this.node.handle("/relay-request/1.0.0", ({ stream, connection }) => {
      this.handleRelayRequest(stream, connection.remotePeer.toString())
    })

    setInterval(() => {
      this.updateRelayMetrics()
    }, 5000)
  }

  private async evaluateRelayCapability(peerId: string): Promise<void> {
    if (!this.node) return

    try {
      const protocols = await this.node.peerStore.get(peerId)
      const supportsRelay = protocols.protocols.includes("/libp2p/circuit/relay/0.2.0/hop")

      if (supportsRelay) {
        console.log("[v0] Peer supports relay functionality:", peerId)
        await this.testRelayPerformance(peerId)
      }
    } catch (error) {
      console.error("[v0] Failed to evaluate relay capability:", error)
    }
  }

  private async testRelayPerformance(peerId: string): Promise<void> {
    if (!this.node) return

    try {
      const startTime = Date.now()
      const stream = await this.node.dialProtocol(peerId, "/relay-test/1.0.0")

      const testData = new Uint8Array(1024) // 1KB test data
      await stream.sink([testData])

      const latency = Date.now() - startTime
      console.log("[v0] Relay performance test - Latency:", latency, "ms")

      const relayInfo: RelayConnection = {
        relayPeerId: peerId,
        targetPeerId: "",
        connectionId: `relay-${peerId}-${Date.now()}`,
        bandwidth: 0,
        latency,
        isActive: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      }

      this.relayConnections.set(peerId, relayInfo)
    } catch (error) {
      console.error("[v0] Relay performance test failed:", error)
    }
  }

  private async handleRelayRequest(stream: any, fromPeer: string): Promise<void> {
    if (!this.isRelayEnabled || this.relayConnections.size >= this.maxRelayConnections) {
      console.log("[v0] Relay request denied - capacity or disabled")
      await stream.close()
      return
    }

    try {
      const decoder = new TextDecoder()
      const chunks: Uint8Array[] = []

      for await (const chunk of stream.source) {
        chunks.push(chunk.subarray())
      }

      const requestData = JSON.parse(
        decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[]))),
      )
      const { targetPeerId, connectionType } = requestData

      console.log("[v0] Processing relay request from:", fromPeer, "to:", targetPeerId)

      const relayConnection = await this.establishRelayConnection(fromPeer, targetPeerId, connectionType)

      if (relayConnection) {
        const response = {
          success: true,
          connectionId: relayConnection.connectionId,
          relayPeerId: this.node?.peerId.toString(),
        }

        const encoder = new TextEncoder()
        await stream.sink([encoder.encode(JSON.stringify(response))])
      } else {
        const response = { success: false, error: "Failed to establish relay" }
        const encoder = new TextEncoder()
        await stream.sink([encoder.encode(JSON.stringify(response))])
      }
    } catch (error) {
      console.error("[v0] Error handling relay request:", error)
    }
  }

  private async establishRelayConnection(
    fromPeer: string,
    targetPeer: string,
    connectionType: string,
  ): Promise<RelayConnection | null> {
    if (!this.node) return null

    try {
      const connectionId = `relay-${fromPeer}-${targetPeer}-${Date.now()}`

      const relayConnection: RelayConnection = {
        relayPeerId: this.node.peerId.toString(),
        targetPeerId: targetPeer,
        connectionId,
        bandwidth: 0,
        latency: 0,
        isActive: true,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      }

      this.relayConnections.set(connectionId, relayConnection)

      await this.setupDataForwarding(fromPeer, targetPeer, connectionId)

      console.log("[v0] Relay connection established:", connectionId)
      return relayConnection
    } catch (error) {
      console.error("[v0] Failed to establish relay connection:", error)
      return null
    }
  }

  private async setupDataForwarding(fromPeer: string, targetPeer: string, connectionId: string): Promise<void> {
    if (!this.node) return

    try {
      const forwardProtocol = `/relay-forward/${connectionId}/1.0.0`

      await this.node.handle(forwardProtocol, ({ stream, connection }) => {
        const sourcePeer = connection.remotePeer.toString()
        const destinationPeer = sourcePeer === fromPeer ? targetPeer : fromPeer

        this.forwardData(stream, destinationPeer, connectionId)
      })

      console.log("[v0] Data forwarding setup complete for:", connectionId)
    } catch (error) {
      console.error("[v0] Failed to setup data forwarding:", error)
    }
  }

  private async forwardData(sourceStream: any, destinationPeer: string, connectionId: string): Promise<void> {
    if (!this.node) return

    try {
      const destinationStream = await this.node.dialProtocol(destinationPeer, `/relay-receive/${connectionId}/1.0.0`)

      let bytesForwarded = 0
      const startTime = Date.now()

      for await (const chunk of sourceStream.source) {
        await destinationStream.sink([chunk])
        bytesForwarded += chunk.length

        const relayConnection = this.relayConnections.get(connectionId)
        if (relayConnection) {
          relayConnection.bandwidth = bytesForwarded / ((Date.now() - startTime) / 1000)
          relayConnection.lastActivity = Date.now()
        }

        if (bytesForwarded > this.relayBandwidthLimit) {
          console.log("[v0] Bandwidth limit exceeded for relay:", connectionId)
          break
        }
      }

      await destinationStream.close()
      console.log("[v0] Data forwarding completed:", bytesForwarded, "bytes")
    } catch (error) {
      console.error("[v0] Error forwarding data:", error)
    }
  }

  private cleanupRelayConnections(peerId: string): void {
    const connectionsToRemove: string[] = []

    this.relayConnections.forEach((connection, connectionId) => {
      if (connection.relayPeerId === peerId || connection.targetPeerId === peerId) {
        connectionsToRemove.push(connectionId)
      }
    })

    connectionsToRemove.forEach((connectionId) => {
      this.relayConnections.delete(connectionId)
      console.log("[v0] Cleaned up relay connection:", connectionId)
    })
  }

  private updateRelayMetrics(): void {
    const activeConnections = Array.from(this.relayConnections.values()).filter((conn) => conn.isActive)
    const totalBandwidth = activeConnections.reduce((sum, conn) => sum + conn.bandwidth, 0)
    const averageLatency =
      activeConnections.length > 0
        ? activeConnections.reduce((sum, conn) => sum + conn.latency, 0) / activeConnections.length
        : 0

    this.relayMetrics = {
      totalConnections: this.relayConnections.size,
      activeRelays: activeConnections.length,
      bandwidthUsed: totalBandwidth,
      averageLatency,
      successRate: this.calculateSuccessRate(),
    }

    if (this.onRelayStatusChange) {
      this.onRelayStatusChange(this.relayMetrics)
    }
  }

  private calculateSuccessRate(): number {
    const totalAttempts = this.relayConnections.size
    const successfulConnections = Array.from(this.relayConnections.values()).filter(
      (conn) => conn.isActive || Date.now() - conn.lastActivity < 30000,
    ).length

    return totalAttempts > 0 ? (successfulConnections / totalAttempts) * 100 : 100
  }

  async requestRelay(targetPeerId: string, relayPeerId: string): Promise<string | null> {
    if (!this.node) return null

    try {
      console.log("[v0] Requesting relay connection to:", targetPeerId, "via:", relayPeerId)

      const stream = await this.node.dialProtocol(relayPeerId, "/relay-request/1.0.0")
      const request = {
        targetPeerId,
        connectionType: "webrtc",
        requesterId: this.node.peerId.toString(),
      }

      const encoder = new TextEncoder()
      await stream.sink([encoder.encode(JSON.stringify(request))])

      const decoder = new TextDecoder()
      const chunks: Uint8Array[] = []

      for await (const chunk of stream.source) {
        chunks.push(chunk.subarray())
      }

      const response = JSON.parse(
        decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[]))),
      )

      if (response.success) {
        console.log("[v0] Relay connection established:", response.connectionId)
        return response.connectionId
      } else {
        console.error("[v0] Relay request failed:", response.error)
        return null
      }
    } catch (error) {
      console.error("[v0] Error requesting relay:", error)
      return null
    }
  }

  async findBestRelay(targetPeerId: string): Promise<string | null> {
    const availableRelays = Array.from(this.relayConnections.values())
      .filter((conn) => conn.isActive && conn.targetPeerId !== targetPeerId)
      .sort((a, b) => {
        // Sort by latency (lower is better) and bandwidth (higher is better)
        const scoreA = a.latency - a.bandwidth / 1000
        const scoreB = b.latency - b.bandwidth / 1000
        return scoreA - scoreB
      })

    if (availableRelays.length > 0) {
      console.log("[v0] Best relay found:", availableRelays[0].relayPeerId)
      return availableRelays[0].relayPeerId
    }

    console.log("[v0] No suitable relay found")
    return null
  }

  enableRelay(maxConnections = 10, bandwidthLimit = 1024 * 1024): void {
    this.isRelayEnabled = true
    this.maxRelayConnections = maxConnections
    this.relayBandwidthLimit = bandwidthLimit
    console.log(
      "[v0] Relay functionality enabled - Max connections:",
      maxConnections,
      "Bandwidth limit:",
      bandwidthLimit,
    )
  }

  disableRelay(): void {
    this.isRelayEnabled = false
    this.relayConnections.clear()
    console.log("[v0] Relay functionality disabled")
  }

  getRelayMetrics(): RelayMetrics {
    return { ...this.relayMetrics }
  }

  getActiveRelayConnections(): RelayConnection[] {
    return Array.from(this.relayConnections.values()).filter((conn) => conn.isActive)
  }

  setOnRelayStatusChange(callback: (status: RelayMetrics) => void): void {
    this.onRelayStatusChange = callback
  }

  isRelayActive(): boolean {
    return this.isRelayEnabled
  }
}
