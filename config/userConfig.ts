export const USER_CONFIG = {
    // User identification
    nickname: "",
    userId: "",
    
    // Connection status
    connectionStatus: "disconnected",
    connectionError: null,
    
    // Media settings
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    isMuted: false,
    
    // Audio/Video devices
    selectedCamera: "",
    selectedMicrophone: "",
    selectedSpeaker: "",
    selectedVideoDevice: "",
    selectedAudioDevice: "",
    selectedOutputDevice: "",
    selectedAudioOutputDevice: "",
    
    // Audio levels
    volume: 0,
    remoteVolume: 0,
    localAudioLevel: 0,
    remoteAudioLevel: 0,
    
    // Media streams
    localStream: null,
    remoteStream: null,
    
    // Media quality settings
    quality: "medium", // "low" | "medium" | "high"
    echoCancellation: true,
    noiseSuppression: true,
    
    // Chat features
    messages: [],
    isTyping: false,
    otherUserTyping: false,
    
    // File sharing
    sharedFiles: [],
    uploadingFiles: [],
    
    // Speech recognition
    isSpeechToTextActive: false,
    transcript: "",
    language: "ko-KR",
    
    // Translation
    isTranslationActive: false,
    sourceText: "",
    translatedText: "",
    sourceLang: "auto",
    targetLang: "en",
    
    // Room settings
    roomId: "",
    isPolite: false,
    
    // Display controls
    isFullscreen: false,
    isPiPEnabled: false,
    
    // Waiting room
    waitingMessage: "",
}
