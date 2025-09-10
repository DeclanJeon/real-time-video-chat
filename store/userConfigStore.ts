import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface AppState {
  roomId: string | null
  userId: string | null
  nickname: string | null
  
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  
  isSignalingConnected: boolean
  webRTCConnectionState: RTCPeerConnectionState
  error: string | null
  
  isMediaLoading: boolean
  
  messages: Message[]
  isPeerTyping: boolean
  files: Record<string, FileState> // Add files state
}

export interface AppActions {
  init: (config: { roomId: string; userId: string; nickname: string }) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  
  toggleAudio: () => void
  toggleVideo: () => void
  setScreenSharing: (isSharing: boolean) => void
  
  setSignalingConnected: (isConnected: boolean) => void
  setWebRTCConnectionState: (state: RTCPeerConnectionState) => void
  setError: (error: string | null) => void
  
  setMediaLoading: (isLoading: boolean) => void
  
  addMessage: (message: Message) => void
  setPeerTyping: (isTyping: boolean) => void

  // File transfer actions
  addFile: (file: FileState) => void
  updateFile: (fileId: string, updates: Partial<FileState>) => void
  removeFile: (fileId: string) => void

  cleanup: () => void
}

export interface FileState {
  id: string
  name: string
  size: number
  type: string
  status: 'sending' | 'receiving' | 'completed' | 'failed' | 'uploading'
  progress: number
  url?: string
  rawChunks?: ArrayBuffer[]
}

export interface Message {
  id: string
  userId: string
  nickname: string
  content: string
  timestamp: Date
  type: "text" | "file" | "system"
  reactions?: { [emoji: string]: string[] } // emoji -> array of user IDs
  replyTo?: string // message ID being replied to
  edited?: boolean // Add edited
  delivered?: boolean // Add delivered
}

const initialState: AppState = {
  roomId: null,
  userId: null,
  nickname: null,
  localStream: null,
  remoteStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  isSignalingConnected: false,
  webRTCConnectionState: 'new',
  error: null,
  isMediaLoading: true,
  messages: [],
  isPeerTyping: false,
  files: {}, // Initialize files state
}

export const useAppStore = create<AppState & AppActions>()(
  immer((set, get) => ({
    ...initialState,

    init: (config) => set({ ...config }),
    
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),

    toggleAudio: () => {
      const stream = get().localStream
      if (stream) {
        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled
          set({ isAudioEnabled: audioTrack.enabled })
        }
      }
    },
    toggleVideo: () => {
      const stream = get().localStream
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled
          set({ isVideoEnabled: videoTrack.enabled })
        }
      }
    },
    setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),
    
    setSignalingConnected: (isConnected) => set({ isSignalingConnected: isConnected }),
    setWebRTCConnectionState: (state) => set({ webRTCConnectionState: state }),
    setError: (error) => set({ error }),
    
    setMediaLoading: (isLoading) => set({ isMediaLoading: isLoading }),

    addMessage: (message) => {
      set((state) => {
        state.messages.push(message)
      })
    },
    setPeerTyping: (isTyping) => set({ isPeerTyping: isTyping }),

    // File transfer actions
    addFile: (file: FileState) => {
      set((state) => {
        state.files[file.id] = file
      })
    },
    updateFile: (fileId: string, updates: Partial<FileState>) => {
      set((state) => {
        if (state.files[fileId]) {
          state.files[fileId] = { ...state.files[fileId], ...updates }
        }
      })
    },
    removeFile: (fileId: string) => {
      set((state) => {
        delete state.files[fileId]
      })
    },

    cleanup: () => {
      get().localStream?.getTracks().forEach(track => track.stop())
      get().remoteStream?.getTracks().forEach(track => track.stop())
      set(initialState)
    }
  }))
)