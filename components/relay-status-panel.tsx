"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Activity, Zap, Clock, TrendingUp, Play as Relay, Pause, BarChart3 } from "lucide-react"
import type { RelayMetrics, RelayConnection } from "@/lib/peer-relay-manager"

interface RelayStatusPanelProps {
  metrics: RelayMetrics
  connections: RelayConnection[]
  isEnabled: boolean
  onToggleRelay?: () => void
  onOptimizeRelay?: () => void
}

export function RelayStatusPanel({
  metrics,
  connections,
  isEnabled,
  onToggleRelay,
  onOptimizeRelay,
}: RelayStatusPanelProps) {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatLatency = (ms: number) => {
    return `${ms.toFixed(0)}ms`
  }

  const getConnectionStatusColor = (connection: RelayConnection) => {
    const timeSinceActivity = Date.now() - connection.lastActivity
    if (timeSinceActivity < 5000) return "bg-green-500"
    if (timeSinceActivity < 30000) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getRelayHealthScore = () => {
    const latencyScore = Math.max(0, 100 - metrics.averageLatency / 10)
    const bandwidthScore = Math.min(100, (metrics.bandwidthUsed / (1024 * 1024)) * 50)
    const successScore = metrics.successRate
    return Math.round((latencyScore + bandwidthScore + successScore) / 3)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Relay className="w-5 h-5" />
          Relay Status
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {metrics.activeRelays} active • {metrics.totalConnections} total
          </div>
          <div className="flex gap-2">
            <Button
              variant={isEnabled ? "default" : "outline"}
              size="sm"
              onClick={onToggleRelay}
              className="flex items-center gap-1"
            >
              {isEnabled ? <Pause className="w-3 h-3" /> : <Relay className="w-3 h-3" />}
              {isEnabled ? "Disable" : "Enable"}
            </Button>
            {onOptimizeRelay && (
              <Button variant="outline" size="sm" onClick={onOptimizeRelay}>
                <TrendingUp className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Relay Health Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Health Score</span>
            <Badge
              variant={
                getRelayHealthScore() > 70 ? "default" : getRelayHealthScore() > 40 ? "secondary" : "destructive"
              }
            >
              {getRelayHealthScore()}%
            </Badge>
          </div>
          <Progress value={getRelayHealthScore()} className="h-2" />
        </div>

        <Separator />

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Bandwidth</span>
            </div>
            <div className="text-sm font-medium">{formatBytes(metrics.bandwidthUsed)}/s</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Latency</span>
            </div>
            <div className="text-sm font-medium">{formatLatency(metrics.averageLatency)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
            <div className="text-sm font-medium">{metrics.successRate.toFixed(1)}%</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-sm font-medium">{metrics.activeRelays}</div>
          </div>
        </div>

        <Separator />

        {/* Active Connections */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Active Connections</span>
            <Badge variant="secondary">{connections.length}</Badge>
          </div>

          <ScrollArea className="h-32">
            <div className="space-y-2">
              {connections.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">No active relay connections</div>
              ) : (
                connections.map((connection) => (
                  <div
                    key={connection.connectionId}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedConnection === connection.connectionId ? "bg-accent" : "hover:bg-muted"
                    }`}
                    onClick={() =>
                      setSelectedConnection(
                        selectedConnection === connection.connectionId ? null : connection.connectionId,
                      )
                    }
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(connection)}`} />
                        <span className="text-xs font-mono">{connection.targetPeerId.slice(0, 8)}...</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatBytes(connection.bandwidth)}/s
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatLatency(connection.latency)}</span>
                      <span>{Math.round((Date.now() - connection.lastActivity) / 1000)}s ago</span>
                    </div>

                    {selectedConnection === connection.connectionId && (
                      <div className="mt-2 pt-2 border-t text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Connection ID:</span>
                          <span className="font-mono">{connection.connectionId.slice(-8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created:</span>
                          <span>{new Date(connection.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant={connection.isActive ? "default" : "secondary"} className="text-xs">
                            {connection.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center p-2 rounded-lg bg-muted">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isEnabled ? "bg-green-500" : "bg-gray-400"}`} />
            <span className="text-muted-foreground">Relay {isEnabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
