export interface NetworkQuality {
  latency: number
  bandwidth: number
  packetLoss: number
  jitter: number
  score: number
}

export interface OptimizationSettings {
  videoQuality: "low" | "medium" | "high" | "auto"
  audioQuality: "low" | "medium" | "high" | "auto"
  adaptiveBitrate: boolean
  relayPreference: "direct" | "relay" | "auto"
  connectionTimeout: number
  maxRetries: number
}

export class P2POptimizer {
  private networkQuality: NetworkQuality = {
    latency: 0,
    bandwidth: 0,
    packetLoss: 0,
    jitter: 0,
    score: 0,
  }
  private settings: OptimizationSettings = {
    videoQuality: "auto",
    audioQuality: "auto",
    adaptiveBitrate: true,
    relayPreference: "auto",
    connectionTimeout: 10000,
    maxRetries: 3,
  }
  private onQualityChange?: (quality: NetworkQuality) => void
  private onSettingsChange?: (settings: OptimizationSettings) => void
  private qualityMonitorInterval: NodeJS.Timeout | null = null

  startQualityMonitoring(peerConnection: RTCPeerConnection): void {
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval)
    }

    this.qualityMonitorInterval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats()
        const quality = this.analyzeConnectionStats(stats)
        this.updateNetworkQuality(quality)
        this.adaptSettings(quality)
      } catch (error) {
        console.error("[v0] Error monitoring connection quality:", error)
      }
    }, 2000)

    console.log("[v0] Started network quality monitoring")
  }

  private analyzeConnectionStats(stats: RTCStatsReport): NetworkQuality {
    let latency = 0
    let bandwidth = 0
    let packetLoss = 0
    let jitter = 0

    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        latency = report.currentRoundTripTime * 1000 || 0
      }

      if (report.type === "inbound-rtp" && report.mediaType === "video") {
        const bytesReceived = report.bytesReceived || 0
        const timestamp = report.timestamp || Date.now()
        bandwidth = (bytesReceived * 8) / (timestamp / 1000) // bits per second
        packetLoss = ((report.packetsLost || 0) / (report.packetsReceived || 1)) * 100
        jitter = report.jitter || 0
      }
    })

    const score = this.calculateQualityScore(latency, bandwidth, packetLoss, jitter)

    return { latency, bandwidth, packetLoss, jitter, score }
  }

  private calculateQualityScore(latency: number, bandwidth: number, packetLoss: number, jitter: number): number {
    // Scoring algorithm (0-100)
    let score = 100

    // Latency penalty (0-50ms = 0 penalty, >200ms = -50 points)
    if (latency > 50) {
      score -= Math.min(50, (latency - 50) / 3)
    }

    // Bandwidth bonus/penalty (>1Mbps = bonus, <500kbps = penalty)
    if (bandwidth > 1000000) {
      score += Math.min(20, (bandwidth - 1000000) / 100000)
    } else if (bandwidth < 500000) {
      score -= (500000 - bandwidth) / 10000
    }

    // Packet loss penalty (>1% = significant penalty)
    if (packetLoss > 1) {
      score -= packetLoss * 10
    }

    // Jitter penalty (>30ms = penalty)
    if (jitter > 30) {
      score -= (jitter - 30) / 2
    }

    return Math.max(0, Math.min(100, score))
  }

  private updateNetworkQuality(quality: NetworkQuality): void {
    this.networkQuality = quality
    if (this.onQualityChange) {
      this.onQualityChange(quality)
    }
  }

  private adaptSettings(quality: NetworkQuality): void {
    const newSettings = { ...this.settings }
    let changed = false

    // Adaptive video quality based on network score
    if (this.settings.videoQuality === "auto") {
      let targetQuality: "low" | "medium" | "high"
      if (quality.score > 80) {
        targetQuality = "high"
      } else if (quality.score > 50) {
        targetQuality = "medium"
      } else {
        targetQuality = "low"
      }

      if (targetQuality !== this.getCurrentVideoQuality()) {
        console.log("[v0] Adapting video quality to:", targetQuality, "Score:", quality.score)
        changed = true
      }
    }

    // Adaptive relay preference
    if (this.settings.relayPreference === "auto") {
      if (quality.latency > 200 || quality.packetLoss > 5) {
        newSettings.relayPreference = "relay"
        changed = true
      } else if (quality.score > 70) {
        newSettings.relayPreference = "direct"
        changed = true
      }
    }

    // Adaptive connection timeout
    if (quality.latency > 100) {
      newSettings.connectionTimeout = Math.min(30000, this.settings.connectionTimeout + 2000)
      changed = true
    } else if (quality.latency < 50) {
      newSettings.connectionTimeout = Math.max(5000, this.settings.connectionTimeout - 1000)
      changed = true
    }

    if (changed) {
      this.settings = newSettings
      if (this.onSettingsChange) {
        this.onSettingsChange(newSettings)
      }
    }
  }

  private getCurrentVideoQuality(): "low" | "medium" | "high" {
    // This would be implemented based on current video constraints
    return "medium" // placeholder
  }

  getOptimalVideoConstraints(): MediaTrackConstraints {
    const quality = this.settings.videoQuality === "auto" ? this.getAutoVideoQuality() : this.settings.videoQuality

    switch (quality) {
      case "high":
        return {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        }
      case "medium":
        return {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        }
      case "low":
        return {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 24 },
        }
      default:
        return {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 },
        }
    }
  }

  getOptimalAudioConstraints(): MediaTrackConstraints {
    const quality = this.settings.audioQuality === "auto" ? this.getAutoAudioQuality() : this.settings.audioQuality

    switch (quality) {
      case "high":
        return {
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      case "medium":
        return {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      case "low":
        return {
          sampleRate: 22050,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        }
      default:
        return {
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
    }
  }

  private getAutoVideoQuality(): "low" | "medium" | "high" {
    if (this.networkQuality.score > 80) return "high"
    if (this.networkQuality.score > 50) return "medium"
    return "low"
  }

  private getAutoAudioQuality(): "low" | "medium" | "high" {
    if (this.networkQuality.score > 70) return "high"
    if (this.networkQuality.score > 40) return "medium"
    return "low"
  }

  shouldUseRelay(): boolean {
    if (this.settings.relayPreference === "relay") return true
    if (this.settings.relayPreference === "direct") return false

    // Auto decision based on network quality
    return this.networkQuality.latency > 200 || this.networkQuality.packetLoss > 5
  }

  getConnectionTimeout(): number {
    return this.settings.connectionTimeout
  }

  getMaxRetries(): number {
    return this.settings.maxRetries
  }

  updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings)
    }
  }

  getNetworkQuality(): NetworkQuality {
    return { ...this.networkQuality }
  }

  getSettings(): OptimizationSettings {
    return { ...this.settings }
  }

  setOnQualityChange(callback: (quality: NetworkQuality) => void): void {
    this.onQualityChange = callback
  }

  setOnSettingsChange(callback: (settings: OptimizationSettings) => void): void {
    this.onSettingsChange = callback
  }

  stopQualityMonitoring(): void {
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval)
      this.qualityMonitorInterval = null
    }
    console.log("[v0] Stopped network quality monitoring")
  }

  // Diagnostic methods
  async runConnectionTest(
    targetPeerId: string,
    libp2pManager: any,
  ): Promise<{
    directConnection: boolean
    relayConnection: boolean
    latency: number
    bandwidth: number
  }> {
    console.log("[v0] Running connection test to:", targetPeerId)

    const results = {
      directConnection: false,
      relayConnection: false,
      latency: 0,
      bandwidth: 0,
    }

    try {
      // Test direct connection
      const startTime = Date.now()
      const directSuccess = await this.testDirectConnection(targetPeerId, libp2pManager)
      if (directSuccess) {
        results.directConnection = true
        results.latency = Date.now() - startTime
      }

      // Test relay connection if direct failed
      if (!directSuccess) {
        const relayStartTime = Date.now()
        const relaySuccess = await libp2pManager.connectToPeerViaRelay(targetPeerId)
        if (relaySuccess) {
          results.relayConnection = true
          results.latency = Date.now() - relayStartTime
        }
      }

      console.log("[v0] Connection test results:", results)
      return results
    } catch (error) {
      console.error("[v0] Connection test failed:", error)
      return results
    }
  }

  private async testDirectConnection(targetPeerId: string, libp2pManager: any): Promise<boolean> {
    try {
      // This would implement a direct connection test
      // For now, return a placeholder result
      return Math.random() > 0.3 // 70% success rate simulation
    } catch (error) {
      return false
    }
  }
}
