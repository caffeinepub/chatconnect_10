import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { VoiceParticipant, backendInterface } from "../backend.d";
import { useActor } from "./useActor";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.stunprotocol.org:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:a.relay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export function useVoiceChat(token: bigint | null, myUsername: string | null) {
  const { actor } = useActor();
  const voiceActor = actor as backendInterface | null;

  const [isInChannel, setIsInChannel] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");

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
  // processedSignals set prevents re-processing old signals
  const processedSignalIds = useRef<Set<string>>(new Set());
  // Keep a ref to the latest processSignals so the interval always calls the fresh version
  const processSignalsRef = useRef<() => Promise<void>>(async () => {});

  // Check microphone permission on mount
  useEffect(() => {
    if (!navigator.permissions) {
      setMicPermission("unknown");
      return;
    }
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        setMicPermission(result.state as MicPermission);
        result.onchange = () => setMicPermission(result.state as MicPermission);
      })
      .catch(() => setMicPermission("unknown"));
  }, []);

  // Resume all audio elements when page becomes visible again (screen unlock / unminimize)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        for (const el of audioElements.current.values()) {
          if (el.paused && el.srcObject) {
            el.play().catch(() => {});
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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
      // Close any existing stale PC first
      const existing = peerConnections.current.get(username);
      if (existing) {
        existing.close();
        peerConnections.current.delete(username);
      }

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });

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
          audioEl.setAttribute("playsinline", "true");
          audioEl.setAttribute("x-webkit-airplay", "allow");
          document.body.appendChild(audioEl);
          audioElements.current.set(username, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.muted = speakerMutedRef.current;
        audioEl.play().catch(() => {});
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        }
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          toast.success(`Voice connected to ${username}!`);
        }
        if (pc.iceConnectionState === "disconnected") {
          // Attempt auto-recovery after 2s
          setTimeout(() => {
            if (pc.iceConnectionState === "disconnected") {
              pc.restartIce();
            }
          }, 2000);
        }
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

        // Build a unique key for this signal to avoid reprocessing
        const sigKey = `${from}:${signal.signalType}:${signal.data.slice(0, 32)}`;

        if (signal.signalType === "offer") {
          const pc = peerConnections.current.get(from);
          // Only process if we don't have a PC yet or it's in a state where we can accept an offer
          const canProcess =
            !pc ||
            pc.signalingState === "stable" ||
            pc.signalingState === "closed";

          if (canProcess && !processedSignalIds.current.has(sigKey)) {
            processedSignalIds.current.add(sigKey);
            // Limit cache size
            if (processedSignalIds.current.size > 500) {
              const iter = processedSignalIds.current.values();
              const oldest = iter.next().value;
              if (oldest !== undefined)
                processedSignalIds.current.delete(oldest);
            }

            let activePc = pc && pc.signalingState !== "closed" ? pc : null;
            if (!activePc) {
              activePc = createPeerConnection(from);
              addLocalTracks(activePc);
            }
            try {
              const offer = JSON.parse(signal.data);
              await activePc.setRemoteDescription(
                new RTCSessionDescription(offer),
              );
              await flushPendingIceCandidates(from, activePc);
              const answer = await activePc.createAnswer();
              await activePc.setLocalDescription(answer);
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
            } catch {
              // ignore per-signal errors
            }
          }
        } else if (signal.signalType === "answer") {
          const pc = peerConnections.current.get(from);
          if (
            pc &&
            pc.signalingState === "have-local-offer" &&
            !pc.remoteDescription
          ) {
            try {
              const answer = JSON.parse(signal.data);
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              await flushPendingIceCandidates(from, pc);
            } catch {
              // ignore
            }
          }
        } else if (signal.signalType === "ice") {
          const pc = peerConnections.current.get(from);
          if (pc && pc.signalingState !== "closed") {
            const candidate = JSON.parse(signal.data) as RTCIceCandidateInit;
            if (!pc.remoteDescription) {
              const pending = pendingIceCandidates.current.get(from) ?? [];
              pending.push(candidate);
              pendingIceCandidates.current.set(from, pending);
            } else {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {
                // ignore duplicate candidates
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

  // Keep the ref always pointing to the latest version
  useEffect(() => {
    processSignalsRef.current = processSignals;
  }, [processSignals]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      for (const track of stream.getTracks()) track.stop();
      setMicPermission("granted");
      return true;
    } catch (err: unknown) {
      const error = err as DOMException;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setMicPermission("denied");
      }
      return false;
    }
  }, []);

  const testMic = useCallback(async () => {
    if (isMicTesting) return;
    setIsMicTesting(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: false,
      });
      setMicPermission("granted");
    } catch (err: unknown) {
      setIsMicTesting(false);
      const error = err as DOMException;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setMicPermission("denied");
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
    if (isInChannelRef.current) return; // prevent double-join

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: false,
      });
      setMicPermission("granted");
    } catch (err: unknown) {
      const error = err as DOMException;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setMicPermission("denied");
        toast.error(
          "Microphone access was blocked. Tap the lock icon in your browser's address bar and allow microphone access, then try again.",
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
    processedSignalIds.current.clear();
    toast.success("Joined voice channel!");

    // Set MediaSession so audio plays in background / lock screen
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Wave Chat Voice",
          artist: "Lobby",
        });
        navigator.mediaSession.playbackState = "playing";
      }
    } catch {
      // ignore
    }

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

    // Use a ref-based interval so we always call the latest processSignals
    signalPollInterval.current = setInterval(() => {
      processSignalsRef.current();
    }, 100);

    // Poll participants every 3s
    participantPollInterval.current = setInterval(async () => {
      if (!voiceActor || !token || !isInChannelRef.current) return;
      try {
        const updated = await voiceActor.getVoiceParticipants(token);
        setParticipants(updated);

        // Connect to any new participants we haven't seen
        for (const p of updated) {
          if (p.username === myUsername) continue;
          if (!peerConnections.current.has(p.username)) {
            try {
              const pc = createPeerConnection(p.username);
              addLocalTracks(pc);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await voiceActor.sendSignal(
                token,
                p.username,
                "offer",
                JSON.stringify(offer),
              );
            } catch {
              // ignore
            }
          }
        }
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
    pendingIceCandidates.current.clear();
    processedSignalIds.current.clear();

    setIsInChannel(false);
    setParticipants([]);
    setIsMicMuted(false);

    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = "none";
      }
    } catch {
      // ignore
    }

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
    micPermission,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleSpeaker,
    testMic,
    requestMicPermission,
  };
}
