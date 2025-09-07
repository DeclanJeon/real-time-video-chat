"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  Wifi,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Play,
  RefreshCw,
} from "lucide-react"
import type { NetworkQuality, OptimizationSettings } from "@/lib/p2p-optimizer"
import type { RelayMetrics } from "@/lib/peer-relay-manager"

interface SystemDiagnosticsPanelProps {
  networkQuality: NetworkQuality
  optimizationSettings: OptimizationSettings
  relayMetrics: RelayMetrics
  onRunDiagnostics?: () => void
  onOptimizeSettings?: () => void
  onUpdateSettings?: (settings: Partial<OptimizationSettings>) => void
}

export function SystemDiagnosticsPanel({
  networkQuality,
  optimizationSettings,
  relayMetrics,
  onRunDiagnostics,
  onOptimizeSettings,
  onUpdateSettings,
}: SystemDiagnosticsPanelProps) {
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false)
  const [diagnosticsHistory, setDiagnosticsHistory] = useState<
    Array<{
      timestamp: Date
      score: number
      issues: string[]
      recommendations: string[]
    }>
  >([])

  const getQualityColor = (score: number) => {
    if (score > 80) return "text-green-500"
    if (score > 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getQualityIcon = (score: number) => {
    if (score > 80) return <CheckCircle className="w-4 h-4 text-green-500" />
    if (score > 50) return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    return <AlertTriangle className="w-4 h-4 text-red-500" />
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true)

    // Simulate diagnostics run
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const issues: string[] = []
    const recommendations: string[] = []

    if (networkQuality.latency > 200) {
      issues.push("High latency detected")
      recommendations.push("Consider using relay connections")
    }

    if (networkQuality.packetLoss > 5) {
      issues.push("Packet loss detected")
      recommendations.push("Reduce video quality")
    }

    if (relayMetrics.successRate < 80) {
      issues.push("Low relay success rate")
      recommendations.push("Enable more relay nodes")
    }

    const newDiagnostic = {
      timestamp: new Date(),
      score: networkQuality.score,
      issues,
      recommendations,
    }

    setDiagnosticsHistory((prev) => [newDiagnostic, ...prev.slice(0, 9)])
    setIsRunningDiagnostics(false)

    if (onRunDiagnostics) {
      onRunDiagnostics()
    }
  }

  const getSystemHealthStatus = () => {
    const avgScore = (networkQuality.score + relayMetrics.successRate) / 2
    if (avgScore > 80) return { status: "Excellent", color: "text-green-500" }
    if (avgScore > 60) return { status: "Good", color: "text-yellow-500" }
    if (avgScore > 40) return { status: "Fair", color: "text-orange-500" }
    return { status: "Poor", color: "text-red-500" }
  }

  const systemHealth = getSystemHealthStatus()

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Diagnostics
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">System Health:</span>
            <Badge variant="outline" className={systemHealth.color}>
              {systemHealth.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={isRunningDiagnostics}
              className="flex items-center gap-1 bg-transparent"
            >
              {isRunningDiagnostics ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {isRunningDiagnostics ? "Running..." : "Run Test"}
            </Button>
            {onOptimizeSettings && (
              <Button variant="outline" size="sm" onClick={onOptimizeSettings}>
                <TrendingUp className="w-3 h-3 mr-1" />
                Optimize
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="relay">Relay</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Overall Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Score</span>
                <div className="flex items-center gap-2">
                  {getQualityIcon(networkQuality.score)}
                  <span className={`font-medium ${getQualityColor(networkQuality.score)}`}>
                    {networkQuality.score.toFixed(0)}%
                  </span>
                </div>
              </div>
              <Progress value={networkQuality.score} className="h-2" />
            </div>

            <Separator />

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Latency</span>
                </div>
                <div className="text-sm font-medium">{networkQuality.latency.toFixed(0)}ms</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Bandwidth</span>
                </div>
                <div className="text-sm font-medium">{formatBytes(networkQuality.bandwidth)}/s</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Packet Loss</span>
                </div>
                <div className="text-sm font-medium">{networkQuality.packetLoss.toFixed(1)}%</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Relay Success</span>
                </div>
                <div className="text-sm font-medium">{relayMetrics.successRate.toFixed(1)}%</div>
              </div>
            </div>

            {/* Recent Diagnostics */}
            {diagnosticsHistory.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm font-medium">Recent Diagnostics</span>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {diagnosticsHistory.map((diagnostic, index) => (
                        <div key={index} className="p-2 rounded-lg border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {diagnostic.timestamp.toLocaleTimeString()}
                            </span>
                            <Badge
                              variant={
                                diagnostic.score > 70 ? "default" : diagnostic.score > 40 ? "secondary" : "destructive"
                              }
                              className="text-xs"
                            >
                              {diagnostic.score.toFixed(0)}%
                            </Badge>
                          </div>
                          {diagnostic.issues.length > 0 && (
                            <div className="text-xs text-muted-foreground">Issues: {diagnostic.issues.join(", ")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">Network Performance</span>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Latency</span>
                    <span className="text-xs font-mono">{networkQuality.latency.toFixed(0)}ms</span>
                  </div>
                  <Progress value={Math.max(0, 100 - networkQuality.latency / 5)} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs">Bandwidth</span>
                    <span className="text-xs font-mono">{formatBytes(networkQuality.bandwidth)}/s</span>
                  </div>
                  <Progress value={Math.min(100, (networkQuality.bandwidth / (1024 * 1024)) * 50)} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs">Packet Loss</span>
                    <span className="text-xs font-mono">{networkQuality.packetLoss.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.max(0, 100 - networkQuality.packetLoss * 10)} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-xs">Jitter</span>
                    <span className="text-xs font-mono">{networkQuality.jitter.toFixed(0)}ms</span>
                  </div>
                  <Progress value={Math.max(0, 100 - networkQuality.jitter / 2)} className="h-1" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="relay" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Active Relays</span>
                <div className="text-sm font-medium">{relayMetrics.activeRelays}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total Connections</span>
                <div className="text-sm font-medium">{relayMetrics.totalConnections}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Bandwidth Used</span>
                <div className="text-sm font-medium">{formatBytes(relayMetrics.bandwidthUsed)}/s</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Avg Latency</span>
                <div className="text-sm font-medium">{relayMetrics.averageLatency.toFixed(0)}ms</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <span className="text-sm font-medium">Relay Performance</span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Success Rate</span>
                  <span className="text-xs font-mono">{relayMetrics.successRate.toFixed(1)}%</span>
                </div>
                <Progress value={relayMetrics.successRate} className="h-2" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">Current Settings</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Video Quality:</span>
                    <Badge variant="outline">{optimizationSettings.videoQuality}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Quality:</span>
                    <Badge variant="outline">{optimizationSettings.audioQuality}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Adaptive Bitrate:</span>
                    <Badge variant={optimizationSettings.adaptiveBitrate ? "default" : "secondary"}>
                      {optimizationSettings.adaptiveBitrate ? "On" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Relay Preference:</span>
                    <Badge variant="outline">{optimizationSettings.relayPreference}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <span className="text-sm font-medium">Advanced Settings</span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Connection Timeout:</span>
                    <span className="font-mono">{optimizationSettings.connectionTimeout}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Retries:</span>
                    <span className="font-mono">{optimizationSettings.maxRetries}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
