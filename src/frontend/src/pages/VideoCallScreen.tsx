import { useNavigate, useParams } from "@tanstack/react-router";
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
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
];

export default function VideoCallScreen() {
  const params = useParams({ from: "/video-call/$callId" });
  const callId = params.callId;
  const navigate = useNavigate();
  const { actor } = useActor();
  const { localSession } = useLocalAuth();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [status, setStatus] = useState<"connecting" | "connected" | "ended">(
    "connecting",
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUsername, setRemoteUsername] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isInitiatorRef = useRef(false);

  // Parse callId: format is "<calleeUsername>_<timestamp>" or just timestamp
  useEffect(() => {
    if (!callId) return;
    const parts = callId.split("_");
    if (parts.length >= 2) {
      setRemoteUsername(parts[0]);
    }
  }, [callId]);

  const endCall = useCallback(() => {
    setStatus("ended");
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
    navigate({ to: "/messages" });
  }, [navigate]);

  const sendSignal = useCallback(
    async (toUsername: string, type: string, data: string) => {
      if (!extActor || !localSession) return;
      try {
        await extActor.sendSignal(localSession.token, toUsername, type, data);
      } catch {
        // ignore
      }
    },
    [extActor, localSession],
  );

  const initPeer = useCallback(
    async (toUsername: string, isInitiator: boolean) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000,
        } as MediaTrackConstraints,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });
      pcRef.current = pc;

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(
            toUsername,
            "video-ice",
            JSON.stringify(e.candidate.toJSON()),
          );
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          setStatus("connected");
        } else if (state === "failed" || state === "disconnected") {
          pc.restartIce();
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(toUsername, "video-offer", JSON.stringify(offer));
      }

      return pc;
    },
    [sendSignal],
  );

  const processSignals = useCallback(async () => {
    if (!extActor || !localSession || !callId) return;
    try {
      const signals = await extActor.getMySignals(localSession.token);
      for (const sig of signals) {
        const key = sig.id.toString();
        if (processedSignalsRef.current.has(key)) continue;
        if (!sig.signalType.startsWith("video-")) continue;
        processedSignalsRef.current.add(key);

        const fromUser = sig.fromUsername;

        if (sig.signalType === "video-offer") {
          const remoteUser = fromUser;
          setRemoteUsername(remoteUser);
          if (!pcRef.current) {
            await initPeer(remoteUser, false);
          }
          const pc = pcRef.current;
          if (!pc) continue;
          await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(sig.data)),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(remoteUser, "video-answer", JSON.stringify(answer));
        } else if (sig.signalType === "video-answer" && pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(sig.data)),
          );
        } else if (sig.signalType === "video-ice" && pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(JSON.parse(sig.data)),
            );
          } catch {
            // ignore
          }
        } else if (sig.signalType === "video-end") {
          endCall();
        }
      }
    } catch {
      // ignore
    }
  }, [extActor, localSession, callId, initPeer, sendSignal, endCall]);

  useEffect(() => {
    if (!extActor || !localSession || !callId) return;

    const parts = callId.split("_");
    const toUser = parts.length >= 2 ? parts[0] : null;
    isInitiatorRef.current = parts.length >= 2; // initiator passes toUser_timestamp

    if (toUser) {
      initPeer(toUser, true).catch((err) => {
        console.error(err);
        toast.error("Could not access camera/microphone");
        navigate({ to: "/messages" });
      });
    }

    pollingRef.current = setInterval(processSignals, 100);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [extActor, localSession, callId, initPeer, processSignals, navigate]);

  const handleEndCall = async () => {
    if (remoteUsername && extActor && localSession) {
      await sendSignal(remoteUsername, "video-end", "");
    }
    endCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = isMuted;
      }
      setIsMuted((v) => !v);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getVideoTracks()) {
        track.enabled = isCameraOff;
      }
      setIsCameraOff((v) => !v);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Remote video (full screen) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay when connecting */}
      <AnimatePresence>
        {status === "connecting" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mb-6" />
            <p className="text-white font-semibold tracking-wide text-lg">
              Connecting video...
            </p>
            {remoteUsername && (
              <p className="text-white/60 text-sm mt-2">@{remoteUsername}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local video (PiP top-right) */}
      <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl z-10">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isCameraOff && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <CameraOff className="h-8 w-8 text-white/50" />
          </div>
        )}
      </div>

      {/* Header label */}
      <div className="absolute top-4 left-4 z-10">
        {status === "connected" && remoteUsername && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5"
          >
            <p className="text-white text-sm font-semibold tracking-wide">
              @{remoteUsername}
            </p>
          </motion.div>
        )}
      </div>

      {/* Control bar */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe z-10">
        <div className="bg-black/60 backdrop-blur-md mx-4 mb-6 rounded-3xl px-6 py-4 flex items-center justify-center gap-6">
          {/* Mute */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500 text-white"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
            data-ocid="videocall.toggle"
          >
            {isMuted ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          {/* End call */}
          <button
            type="button"
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all shadow-lg shadow-red-600/40"
            data-ocid="videocall.delete_button"
          >
            <PhoneOff className="h-7 w-7" />
          </button>

          {/* Camera toggle */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isCameraOff
                ? "bg-red-500 text-white"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
            data-ocid="videocall.secondary_button"
          >
            {isCameraOff ? (
              <CameraOff className="h-6 w-6" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
