"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Users, Wifi, WifiOff, Play as Relay, Globe } from "lucide-react"
import type { PeerInfo } from "@/lib/libp2p-manager"

interface PeerDiscoveryPanelProps {
  peers: PeerInfo[]
  connectedPeers: PeerInfo[]
  localPeerId: string | null
  localMultiaddrs: string[]
  onConnectPeer?: (peerId: string) => void
  onDisconnectPeer?: (peerId: string) => void
  relayEnabled: boolean
  onToggleRelay?: () => void
}

export function PeerDiscoveryPanel({
  peers,
  connectedPeers,
  localPeerId,
  localMultiaddrs,
  onConnectPeer,
  onDisconnectPeer,
  relayEnabled,
  onToggleRelay,
}: PeerDiscoveryPanelProps) {
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null)

  const formatPeerId = (peerId: string) => {
    return `${peerId.slice(0, 8)}...${peerId.slice(-8)}`
  }

  const formatMultiaddr = (multiaddr: string) => {
    return multiaddr.length > 50 ? `${multiaddr.slice(0, 50)}...` : multiaddr
  }

  const getConnectionStatus = (peer: PeerInfo) => {
    if (peer.isConnected) {
      return (
        <Badge variant="default" className="bg-green-500">
          <Wifi className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        <WifiOff className="w-3 h-3 mr-1" />
        Discovered
      </Badge>
    )
  }

  const isRelayPeer = (peer: PeerInfo) => {
    return peer.protocols.includes("/libp2p/circuit/relay/0.2.0/hop")
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Peer Discovery
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {connectedPeers.length} connected • {peers.length} discovered
          </div>
          <Button
            variant={relayEnabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleRelay}
            className="flex items-center gap-1"
          >
            <Relay className="w-3 h-3" />
            {relayEnabled ? "Relay On" : "Relay Off"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Local Peer Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Local Peer</span>
          </div>
          {localPeerId && <div className="text-xs text-muted-foreground font-mono">{formatPeerId(localPeerId)}</div>}
          <div className="text-xs text-muted-foreground">{localMultiaddrs.length} address(es)</div>
        </div>

        <Separator />

        {/* Discovered Peers */}
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {peers.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">No peers discovered yet</div>
            ) : (
              peers.map((peer) => (
                <div key={peer.peerId} className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getConnectionStatus(peer)}
                        {isRelayPeer(peer) && (
                          <Badge variant="outline" className="text-xs">
                            <Relay className="w-3 h-3 mr-1" />
                            Relay
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate">
                        {formatPeerId(peer.peerId)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {peer.protocols.length} protocol(s) • {peer.multiaddrs.length} address(es)
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPeer(expandedPeer === peer.peerId ? null : peer.peerId)}
                      >
                        {expandedPeer === peer.peerId ? "−" : "+"}
                      </Button>
                      {!peer.isConnected && onConnectPeer && (
                        <Button variant="outline" size="sm" onClick={() => onConnectPeer(peer.peerId)}>
                          Connect
                        </Button>
                      )}
                      {peer.isConnected && onDisconnectPeer && (
                        <Button variant="outline" size="sm" onClick={() => onDisconnectPeer(peer.peerId)}>
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded peer details */}
                  {expandedPeer === peer.peerId && (
                    <div className="ml-4 p-2 bg-muted rounded text-xs space-y-2">
                      <div>
                        <div className="font-medium mb-1">Protocols:</div>
                        {peer.protocols.length > 0 ? (
                          peer.protocols.map((protocol, idx) => (
                            <div key={idx} className="font-mono text-muted-foreground">
                              {protocol}
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">None identified</div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium mb-1">Addresses:</div>
                        {peer.multiaddrs.map((addr, idx) => (
                          <div key={idx} className="font-mono text-muted-foreground break-all">
                            {formatMultiaddr(addr)}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="font-medium mb-1">Last Seen:</div>
                        <div className="text-muted-foreground">{new Date(peer.lastSeen).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
