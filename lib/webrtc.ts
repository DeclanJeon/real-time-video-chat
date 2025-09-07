export class WebRTCManager {
  private peerConnections = new Map<string, RTCPeerConnection>()
  private localStream: MediaStream | null = null
  private socket: any = null
  private userId = ""
  private onRemoteStream?: (userId: string, stream: MediaStream) => void
  private onDataChannel?: (userId: string, channel: RTCDataChannel) => void

  constructor(socket: any, userId: string) {
    this.socket = socket
    this.userId = userId
    this.setupSocketListeners()
  }

  private setupSocketListeners() {
    this.socket.on("user-joined", ({ userId }: { userId: string }) => {
      console.log("[v0] User joined, creating offer for:", userId)
      this.createPeerConnection(userId, true)
    })

    this.socket.on("offer", async ({ fromUserId, offer }: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
      console.log("[v0] Received offer from:", fromUserId)
      const pc = this.createPeerConnection(fromUserId, false)
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.socket.emit("answer", { targetUserId: fromUserId, answer })
    })

    this.socket.on(
      "answer",
      async ({ fromUserId, answer }: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
        console.log("[v0] Received answer from:", fromUserId)
        const pc = this.peerConnections.get(fromUserId)
        if (pc) {
          await pc.setRemoteDescription(answer)
        }
      },
    )

    this.socket.on(
      "ice-candidate",
      async ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
        console.log("[v0] Received ICE candidate from:", fromUserId)
        const pc = this.peerConnections.get(fromUserId)
        if (pc) {
          await pc.addIceCandidate(candidate)
        }
      },
    )

    this.socket.on("user-left", ({ userId }: { userId: string }) => {
      console.log("[v0] User left:", userId)
      this.closePeerConnection(userId)
    })
  }

  private createPeerConnection(userId: string, isInitiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("[v0] Received remote stream from:", userId)
      if (this.onRemoteStream) {
        this.onRemoteStream(userId, event.streams[0])
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          targetUserId: userId,
          candidate: event.candidate,
        })
      }
    }

    // Create data channel for chat and file sharing
    if (isInitiator) {
      const dataChannel = pc.createDataChannel("chat", { ordered: true })
      this.setupDataChannel(userId, dataChannel)
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(userId, event.channel)
      }
    }

    this.peerConnections.set(userId, pc)

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer)
        this.socket.emit("offer", { targetUserId: userId, offer })
      })
    }

    return pc
  }

  private setupDataChannel(userId: string, channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log("[v0] Data channel opened with:", userId)
    }

    channel.onmessage = (event) => {
      console.log("[v0] Data channel message from:", userId, event.data)
    }

    if (this.onDataChannel) {
      this.onDataChannel(userId, channel)
    }
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream
    // Add tracks to existing connections
    this.peerConnections.forEach((pc) => {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })
    })
  }

  setOnRemoteStream(callback: (userId: string, stream: MediaStream) => void) {
    this.onRemoteStream = callback
  }

  setOnDataChannel(callback: (userId: string, channel: RTCDataChannel) => void) {
    this.onDataChannel = callback
  }

  closePeerConnection(userId: string) {
    const pc = this.peerConnections.get(userId)
    if (pc) {
      pc.close()
      this.peerConnections.delete(userId)
    }
  }

  closeAllConnections() {
    this.peerConnections.forEach((pc) => pc.close())
    this.peerConnections.clear()
  }
}
