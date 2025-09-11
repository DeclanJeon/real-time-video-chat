import { create } from "zustand"

export interface PeerInfo {
  id: string
  nickname: string
  socketId: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  stream: MediaStream | null
  peerConnection: RTCPeerConnection | null
}

interface PeerStore {
  remotePeer: PeerInfo | null
  setRemotePeer: (peer: PeerInfo | null) => void
  updateRemotePeer: (updates: Partial<PeerInfo>) => void
}

export const usePeerStore = create<PeerStore>((set) => ({
  remotePeer: null,
  setRemotePeer: (peer) => set({ remotePeer: peer }),
  updateRemotePeer: (updates) => set((state) => ({
    remotePeer: state.remotePeer ? { ...state.remotePeer, ...updates } : null,
  })),
}))
