import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { User, backendInterface } from "../backend.d";
import { useActor } from "../hooks/useActor";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
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

interface VoiceCallModalProps {
  user: User;
  /** The username of the caller (person calling us) */
  callerUsername?: string;
  /** Our own username (we are the callee) */
  myUsername?: string;
  onClose: () => void;
}

export function VoiceCallModal({
  user,
  callerUsername,
  myUsername,
  onClose,
}: VoiceCallModalProps) {
  const { actor } = useActor();
  const voiceActor = actor as backendInterface | null;

  const [callState, setCallState] = useState<
    "calling" | "connected" | "declined" | "error"
  >("calling");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // We need a session token for signaling — derive from local session
  const [sessionToken, setSessionToken] = useState<bigint | null>(null);

  useEffect(() => {
    // Try to get session token from localStorage (same as useLocalAuth)
    try {
      const raw = localStorage.getItem("localSession");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token !== undefined) {
          setSessionToken(BigInt(parsed.token));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const cleanupCall = useCallback(() => {
    if (signalPollRef.current) {
      clearInterval(signalPollRef.current);
      signalPollRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop();
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
  }, []);

  // Signal channel key for 1-on-1 calls
  const getSignalChannelKey = () => {
    if (!callerUsername || !myUsername) return null;
    return `call:${callerUsername}:${myUsername}`;
  };

  const handleAccept = async () => {
    // If no username info, fall back to fake connected state
    if (!callerUsername || !myUsername || !voiceActor || !sessionToken) {
      setCallState("connected");
      return;
    }

    // Request mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (err: unknown) {
      const error = err as DOMException;
      let msg = "Could not access microphone.";
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        msg =
          "Microphone access was blocked. Please allow mic in browser settings.";
      } else if (error.name === "NotFoundError") {
        msg = "No microphone found. Please connect a microphone.";
      }
      setMicError(msg);
      toast.error(msg);
      return;
    }

    localStreamRef.current = stream;

    // Create peer connection — callee answers the offer from caller
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    pcRef.current = pc;

    // Add local tracks
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    // On remote audio
    pc.ontrack = (event) => {
      if (!remoteAudioRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = speakerMuted;
        document.body.appendChild(audio);
        remoteAudioRef.current = audio;
      }
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    // Send ICE candidates to caller
    const channelKey = getSignalChannelKey();
    pc.onicecandidate = async (event) => {
      if (event.candidate && voiceActor && sessionToken && channelKey) {
        try {
          // Send ICE to caller using their username as target
          await voiceActor.sendSignal(
            sessionToken,
            callerUsername,
            `${channelKey}:ice`,
            JSON.stringify(event.candidate),
          );
        } catch {
          // ignore
        }
      }
    };

    // Poll for offer from caller, then send answer
    const pollForOffer = async () => {
      if (!voiceActor || !sessionToken || !channelKey) return;
      try {
        const signals = await voiceActor.getMySignals(sessionToken);
        const offerSignal = signals.find(
          (s) =>
            s.fromUsername === callerUsername &&
            s.signalType === `${channelKey}:offer`,
        );
        if (
          offerSignal &&
          pc.signalingState === "stable" &&
          !pc.remoteDescription
        ) {
          const offer = JSON.parse(offerSignal.data);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await voiceActor.sendSignal(
            sessionToken,
            callerUsername,
            `${channelKey}:answer`,
            JSON.stringify(answer),
          );

          // Now poll for ICE from caller
          signalPollRef.current = setInterval(async () => {
            if (!voiceActor || !sessionToken) return;
            try {
              const iceSignals = await voiceActor.getMySignals(sessionToken);
              for (const s of iceSignals) {
                if (
                  s.fromUsername === callerUsername &&
                  s.signalType === `${channelKey}:ice`
                ) {
                  try {
                    await pc.addIceCandidate(
                      new RTCIceCandidate(JSON.parse(s.data)),
                    );
                  } catch {
                    // ignore
                  }
                }
              }
            } catch {
              // ignore
            }
          }, 100);
        }
      } catch {
        // ignore
      }
    };

    // Send our offer first (we're callee but we initiate WebRTC from our side too)
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await voiceActor.sendSignal(
        sessionToken,
        callerUsername,
        `${channelKey}:offer-callee`,
        JSON.stringify(offer),
      );
    } catch {
      // ignore — will still try to answer if caller sent offer
    }

    // Poll for offer signal
    const offerPollInterval = setInterval(async () => {
      await pollForOffer();
    }, 100);

    // Stop polling after 15s
    setTimeout(() => clearInterval(offerPollInterval), 15000);

    setCallState("connected");
  };

  const handleDecline = () => {
    setCallState("declined");
    cleanupCall();
    setTimeout(onClose, 800);
  };

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cleanupCall();
    onClose();
  };

  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) track.enabled = muted; // toggle: if currently muted, enable
    }
    setMuted((m) => !m);
  };

  const handleToggleSpeaker = () => {
    const newMuted = !speakerMuted;
    setSpeakerMuted(newMuted);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = newMuted;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  const name = user.fname || user.name || "Unknown";
  const initials = name.slice(0, 2).toUpperCase();
  const color = "#7C3AED"; // fallback color since User doesn't have color field

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: "rgba(7, 10, 16, 0.92)",
          backdropFilter: "blur(12px)",
        }}
        data-ocid="voicecall.modal"
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="relative flex flex-col items-center gap-6 rounded-3xl px-10 py-12 w-[360px]"
          style={{
            background: "#1A232E",
            border: "1px solid #2A3442",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Avatar with pulsing rings */}
          <div className="relative flex items-center justify-center">
            {callState === "calling" && (
              <>
                <div
                  className="absolute animate-pulse-ring-2 rounded-full"
                  style={{ width: 128, height: 128, background: `${color}22` }}
                />
                <div
                  className="absolute animate-pulse-ring rounded-full"
                  style={{ width: 108, height: 108, background: `${color}33` }}
                />
              </>
            )}
            <div
              className="relative z-10 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{
                width: 88,
                height: 88,
                background: color,
                boxShadow: `0 0 0 4px ${color}55`,
              }}
            >
              {user.photo ? (
                <img
                  src={user.photo.getDirectURL()}
                  alt={name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </div>

          {/* Name & status */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{name}</h2>
            <p className="text-sm mt-1" style={{ color: "#9AA8BA" }}>
              {callState === "calling" && (
                <span className="flex items-center justify-center gap-1">
                  <span>Calling</span>
                  <DotDotDot />
                </span>
              )}
              {callState === "connected" && (
                <span className="flex items-center justify-center gap-2">
                  <span className="online-dot w-2 h-2 rounded-full inline-block" />
                  <span>Connected · {formatTime(seconds)}</span>
                </span>
              )}
              {callState === "declined" && (
                <span style={{ color: "#e74c3c" }}>Call Declined</span>
              )}
              {callState === "error" && (
                <span style={{ color: "#e74c3c" }}>Connection Error</span>
              )}
            </p>
            {micError && (
              <p className="text-xs mt-2 px-2" style={{ color: "#f59e0b" }}>
                {micError}
              </p>
            )}
          </div>

          {/* Role */}
          <p className="text-xs" style={{ color: "#6F7F93" }}>
            {user.role}
          </p>

          {/* Controls - calling state */}
          {callState === "calling" && (
            <div className="flex gap-6 mt-2" data-ocid="voicecall.panel">
              <button
                type="button"
                onClick={handleDecline}
                className="flex flex-col items-center gap-2 group"
                data-ocid="voicecall.cancel_button"
                aria-label="Decline call"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#e74c3c" }}
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs" style={{ color: "#9AA8BA" }}>
                  Decline
                </span>
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="flex flex-col items-center gap-2 group"
                data-ocid="voicecall.confirm_button"
                aria-label="Accept call"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#2ECC71" }}
                >
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs" style={{ color: "#9AA8BA" }}>
                  Accept
                </span>
              </button>
            </div>
          )}

          {/* Controls - connected state */}
          {callState === "connected" && (
            <div className="flex gap-5 mt-2">
              <button
                type="button"
                onClick={handleToggleMic}
                className="flex flex-col items-center gap-2 group"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: muted ? "#2A3440" : "#1f4a2e",
                    border: "1px solid #2A3442",
                  }}
                >
                  {muted ? (
                    <MicOff className="w-5 h-5" style={{ color: "#9AA8BA" }} />
                  ) : (
                    <Mic className="w-5 h-5" style={{ color: "#4ade80" }} />
                  )}
                </div>
                <span className="text-xs" style={{ color: "#6F7F93" }}>
                  {muted ? "Unmute" : "Mute"}
                </span>
              </button>
              <button
                type="button"
                onClick={handleToggleSpeaker}
                className="flex flex-col items-center gap-2 group"
                aria-label={speakerMuted ? "Unmute Speaker" : "Mute Speaker"}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: speakerMuted ? "#2A3440" : "#1a3047",
                    border: "1px solid #2A3442",
                  }}
                >
                  {speakerMuted ? (
                    <VolumeX className="w-5 h-5" style={{ color: "#9AA8BA" }} />
                  ) : (
                    <Volume2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
                  )}
                </div>
                <span className="text-xs" style={{ color: "#6F7F93" }}>
                  {speakerMuted ? "Speaker Off" : "Speaker"}
                </span>
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                className="flex flex-col items-center gap-2 group"
                data-ocid="voicecall.close_button"
                aria-label="End call"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#e74c3c" }}
                >
                  <PhoneOff className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs" style={{ color: "#6F7F93" }}>
                  End
                </span>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DotDotDot() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : `${d}.`));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return <span>{dots}</span>;
}
