// ICE servers configuration
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "turn:turn.peerterra.com:3478", username: "kron_turn", credential: "kron1234" },
]

export const MEDIA_STREAM_CONSTRAINTS = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000
    }
}

export const MEDIA_DEVICE_CONSTRAINTS = (
    isVideoEnabled: boolean,
    isAudioEnabled: boolean,
    selectedDevices: { camera?: string, microphone?: string }
) => {
    return {
      video: isVideoEnabled
      ? {
          deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false,
      audio: isAudioEnabled
      ? {
          deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false
    }
}
