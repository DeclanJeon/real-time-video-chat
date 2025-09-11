import { create } from "zustand"

interface UserConfig {
  id: string
  nickname: string
  socketId: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  selectedDevices: {
    camera: string
    microphone: string
    speaker: string
  }
}

interface UserConfigActions {
  setUserId: (id: string) => void
  setNickname: (nickname: string) => void
  setSocketId: (socketId: string) => void
  setIsVideoEnabled: (enabled: boolean) => void
  setIsAudioEnabled: (enabled: boolean) => void
  setSelectedDevices: (devices: { camera: string; microphone: string; speaker: string }) => void
}

export const useUserStore = create<UserConfig & UserConfigActions>((set) => ({
  id: "",
  nickname: "",
  socketId: "",
  isVideoEnabled: true,
  isAudioEnabled: true,
  selectedDevices: {
    camera: "",
    microphone: "",
    speaker: "",
  },
  setUserId: (id) => set({ id }),
  setNickname: (nickname) => set({ nickname }),
  setSocketId: (socketId) => set({ socketId }),
  setIsVideoEnabled: (enabled) => set({ isVideoEnabled: enabled }),
  setIsAudioEnabled: (enabled) => set({ isAudioEnabled: enabled }),
  setSelectedDevices: (devices) => set({ selectedDevices: devices }),
}))
