import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { VoiceParticipant, backendInterface } from "../backend.d";
import { useActor } from "./useActor";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function useVoiceChat(token: bigint | null, myUsername: string | null) {
  const { actor } = useActor();
  const voiceActor = actor as backendInterface | null;

  const [isInChannel, setIsInChannel] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const signalPollInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const participantPollInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isInChannelRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const micLevelAnimFrame = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );

  // Start mic level monitoring using AnalyserNode
  const startMicLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micLevelAnimFrame.current = requestAnimationFrame(tick);
      };
      micLevelAnimFrame.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext not available
    }
  }, []);

  const stopMicLevelMonitor = useCallback(() => {
    if (micLevelAnimFrame.current !== null) {
      cancelAnimationFrame(micLevelAnimFrame.current);
      micLevelAnimFrame.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const createPeerConnection = useCallback(
    (username: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = async (event) => {
        if (event.candidate && voiceActor && token) {
          try {
            await voiceActor.sendSignal(
              token,
              username,
              "ice",
              JSON.stringify(event.candidate),
            );
          } catch {
            // ignore
          }
        }
      };

      pc.ontrack = (event) => {
        let audioEl = audioElements.current.get(username);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
          audioElements.current.set(username, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.muted = speakerMutedRef.current;
      };

      peerConnections.current.set(username, pc);
      return pc;
    },
    [voiceActor, token],
  );

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    if (localStream.current) {
      for (const track of localStream.current.getTracks()) {
        pc.addTrack(track, localStream.current);
      }
    }
  }, []);

  const flushPendingIceCandidates = useCallback(
    async (from: string, pc: RTCPeerConnection) => {
      const flush = pendingIceCandidates.current.get(from) ?? [];
      for (const c of flush) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          // ignore
        }
      }
      pendingIceCandidates.current.delete(from);
    },
    [],
  );

  const processSignals = useCallback(async () => {
    if (!voiceActor || !token || !myUsername || !isInChannelRef.current) return;
    try {
      const signals = await voiceActor.getMySignals(token);
      for (const signal of signals) {
        const from = signal.fromUsername;
        if (from === myUsername) continue;

        if (signal.signalType === "offer") {
          let pc = peerConnections.current.get(from);
          if (!pc) {
            pc = createPeerConnection(from);
            addLocalTracks(pc);
          }
          const offer = JSON.parse(signal.data);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          // Flush any buffered ICE candidates
          await flushPendingIceCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          try {
            await voiceActor.sendSignal(
              token,
              from,
              "answer",
              JSON.stringify(answer),
            );
          } catch {
            // ignore
          }
        } else if (signal.signalType === "answer") {
          const pc = peerConnections.current.get(from);
          if (pc) {
            const answer = JSON.parse(signal.data);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Flush any buffered ICE candidates
            await flushPendingIceCandidates(from, pc);
          }
        } else if (signal.signalType === "ice") {
          const pc = peerConnections.current.get(from);
          if (pc) {
            const candidate = JSON.parse(signal.data) as RTCIceCandidateInit;
            if (!pc.remoteDescription) {
              // Buffer until remote description is set
              const pending = pendingIceCandidates.current.get(from) ?? [];
              pending.push(candidate);
              pendingIceCandidates.current.set(from, pending);
            } else {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }, [
    voiceActor,
    token,
    myUsername,
    createPeerConnection,
    addLocalTracks,
    flushPendingIceCandidates,
  ]);

  // Test mic: loopback for 3 seconds with level display
  const testMic = useCallback(async () => {
    if (isMicTesting) return;
    setIsMicTesting(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (err: unknown) {
      setIsMicTesting(false);
      const error = err as DOMException;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        toast.error(
          "Microphone access was blocked. Please allow mic access in your browser settings.",
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        toast.error(
          "No microphone found. Please connect a microphone and try again.",
        );
      } else {
        toast.error(`Microphone error: ${error.message || error.name}`);
      }
      return;
    }

    // Play back to self (loopback) so user can hear their own mic
    let loopbackCtx: AudioContext | null = null;
    try {
      loopbackCtx = new AudioContext();
      const source = loopbackCtx.createMediaStreamSource(stream);
      source.connect(loopbackCtx.destination);
    } catch {
      // If loopback fails, still show level
    }

    startMicLevelMonitor(stream);
    toast.success("Mic test started — speak into your mic for 3 seconds!");

    await new Promise<void>((resolve) => setTimeout(resolve, 3000));

    // Stop
    for (const track of stream.getTracks()) track.stop();
    if (loopbackCtx) loopbackCtx.close().catch(() => {});
    stopMicLevelMonitor();
    setIsMicTesting(false);
    toast.success("Mic test complete! Your mic is working.");
  }, [isMicTesting, startMicLevelMonitor, stopMicLevelMonitor]);

  const joinChannel = useCallback(async () => {
    if (!token || !myUsername) {
      toast.error("Please log in to use voice chat");
      return;
    }

    // Request mic permission FIRST
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (err: unknown) {
      const error = err as DOMException;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        toast.error(
          "Microphone access was blocked. Click the lock icon in your browser's address bar and allow microphone access, then try again.",
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        toast.error(
          "No microphone found. Please connect a microphone and try again.",
        );
      } else {
        toast.error(
          `Could not access microphone: ${(error as DOMException).message || (error as DOMException).name}`,
        );
      }
      return;
    }

    localStream.current = stream;
    startMicLevelMonitor(stream);

    // Attempt backend join — if it fails, show error and abort
    if (!voiceActor) {
      toast.error("Voice signaling unavailable. Try again later.");
      for (const track of stream.getTracks()) track.stop();
      localStream.current = null;
      stopMicLevelMonitor();
      return;
    }

    let existingParticipants: VoiceParticipant[] = [];
    try {
      existingParticipants = await voiceActor.joinVoiceChannel(token);
    } catch {
      toast.error("Voice signaling unavailable. Try again later.");
      for (const track of stream.getTracks()) track.stop();
      localStream.current = null;
      stopMicLevelMonitor();
      return;
    }

    isInChannelRef.current = true;
    setIsInChannel(true);
    setParticipants(existingParticipants);
    toast.success("Joined voice channel!");

    // Connect to existing participants as offerer
    for (const participant of existingParticipants) {
      if (participant.username === myUsername) continue;
      try {
        const pc = createPeerConnection(participant.username);
        addLocalTracks(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await voiceActor.sendSignal(
          token,
          participant.username,
          "offer",
          JSON.stringify(offer),
        );
      } catch {
        // ignore per-peer errors
      }
    }

    // Poll signals every 1.5s
    signalPollInterval.current = setInterval(processSignals, 1500);

    // Poll participants every 3s
    participantPollInterval.current = setInterval(async () => {
      if (!voiceActor || !token || !isInChannelRef.current) return;
      try {
        const updated = await voiceActor.getVoiceParticipants(token);
        setParticipants(updated);
      } catch {
        // ignore
      }
    }, 3000);
  }, [
    voiceActor,
    token,
    myUsername,
    createPeerConnection,
    addLocalTracks,
    processSignals,
    startMicLevelMonitor,
    stopMicLevelMonitor,
  ]);

  const leaveChannel = useCallback(async () => {
    isInChannelRef.current = false;

    if (signalPollInterval.current) {
      clearInterval(signalPollInterval.current);
      signalPollInterval.current = null;
    }
    if (participantPollInterval.current) {
      clearInterval(participantPollInterval.current);
      participantPollInterval.current = null;
    }

    if (localStream.current) {
      for (const track of localStream.current.getTracks()) track.stop();
      localStream.current = null;
    }

    stopMicLevelMonitor();

    for (const pc of peerConnections.current.values()) pc.close();
    peerConnections.current.clear();

    for (const el of audioElements.current.values()) {
      el.srcObject = null;
      el.remove();
    }
    audioElements.current.clear();

    // Clear pending ICE candidates
    pendingIceCandidates.current.clear();

    setIsInChannel(false);
    setParticipants([]);
    setIsMicMuted(false);

    if (voiceActor && token) {
      try {
        await voiceActor.leaveVoiceChannel(token);
      } catch {
        // ignore
      }
    }
  }, [voiceActor, token, stopMicLevelMonitor]);

  const toggleMic = useCallback(async () => {
    if (!localStream.current) return;
    const newMuted = !isMicMuted;
    const track = localStream.current.getAudioTracks()[0];
    if (track) track.enabled = !newMuted;
    setIsMicMuted(newMuted);
    if (voiceActor && token) {
      try {
        await voiceActor.setMicActive(token, !newMuted);
      } catch {
        // ignore
      }
    }
  }, [isMicMuted, voiceActor, token]);

  const toggleSpeaker = useCallback(() => {
    const newMuted = !isSpeakerMuted;
    speakerMutedRef.current = newMuted;
    setIsSpeakerMuted(newMuted);
    for (const el of audioElements.current.values()) {
      el.muted = newMuted;
    }
  }, [isSpeakerMuted]);

  useEffect(() => {
    return () => {
      if (isInChannelRef.current) {
        leaveChannel();
      }
      stopMicLevelMonitor();
    };
  }, [leaveChannel, stopMicLevelMonitor]);

  return {
    isInChannel,
    isMicMuted,
    isSpeakerMuted,
    participants,
    micLevel,
    isMicTesting,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleSpeaker,
    testMic,
  };
}
