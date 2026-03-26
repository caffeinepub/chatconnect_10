import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { User, backendInterface } from "../backend.d";
import { useActor } from "../hooks/useActor";

// Shared ICE server config — matches CallScreen for consistency
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

interface VoiceCallModalProps {
  user: User;
  callerUsername?: string;
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

  // "calling" = waiting to accept, "connecting" = WebRTC handshake in progress,
  // "connected" = ICE connected and audio flowing, "declined"/"error" = terminal
  const [callState, setCallState] = useState<
    "calling" | "connecting" | "connected" | "declined" | "error"
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
  // Watchdog: restart ICE if still not connected after 20s
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessionToken, setSessionToken] = useState<bigint | null>(null);

  useEffect(() => {
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
      }, 1000);
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
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
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

  const getSignalChannelKey = () => {
    if (!callerUsername || !myUsername) return null;
    return `call:${callerUsername}:${myUsername}`;
  };

  const handleAccept = async () => {
    if (!callerUsername || !myUsername || !voiceActor || !sessionToken) {
      // Fallback if signaling info missing
      setCallState("connected");
      return;
    }

    setCallState("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // AGC amplifies echo
          channelCount: 1,
          sampleRate: 48000,
        },
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
      setCallState("error");
      return;
    }

    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    pcRef.current = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    // Only mark as connected when WebRTC ICE actually completes
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        // Clear watchdog — we made it
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
        setCallState("connected");
      } else if (state === "failed") {
        // Restart ICE negotiation automatically
        pc.restartIce();
        // Reset watchdog for the retry
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === "failed") {
            toast.error("Voice connection failed. Try calling again.");
            setCallState("error");
          }
        }, 15000);
      } else if (state === "disconnected") {
        // Transient — try restart before giving up
        setTimeout(() => {
          if (
            pcRef.current &&
            pcRef.current.iceConnectionState === "disconnected"
          ) {
            pcRef.current.restartIce();
          }
        }, 3000);
      }
    };

    pc.ontrack = (event) => {
      if (!remoteAudioRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = speakerMuted;
        document.body.appendChild(audio);
        remoteAudioRef.current = audio;
      }
      remoteAudioRef.current.srcObject = event.streams[0];
      remoteAudioRef.current.play().catch(() => {});
    };

    const channelKey = getSignalChannelKey();
    pc.onicecandidate = async (event) => {
      if (event.candidate && voiceActor && sessionToken && channelKey) {
        try {
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

    // Watchdog: if not connected in 25s, restart ICE once
    watchdogRef.current = setTimeout(() => {
      if (pcRef.current && callState !== "connected") {
        pcRef.current.restartIce();
        toast.info("Connection slow — retrying...");
        // Give another 15s before hard failure
        watchdogRef.current = setTimeout(() => {
          if (
            pcRef.current &&
            pcRef.current.iceConnectionState !== "connected" &&
            pcRef.current.iceConnectionState !== "completed"
          ) {
            toast.error("Could not connect voice. Please try again.");
            setCallState("error");
          }
        }, 15000);
      }
    }, 25000);

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

          // Poll for ongoing ICE from caller
          if (signalPollRef.current) clearInterval(signalPollRef.current);
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
                    // ignore duplicate candidates
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

    // Send our offer (callee-initiated for faster negotiation)
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
      // ignore — will still answer caller's offer
    }

    // Poll for caller's offer — extended to 30s
    const offerPollInterval = setInterval(async () => {
      await pollForOffer();
    }, 100);
    setTimeout(() => clearInterval(offerPollInterval), 30000);
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
      if (track) track.enabled = muted;
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

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  const name = user.fname || user.name || "Unknown";
  const initials = name.slice(0, 2).toUpperCase();
  const color = "#7C3AED";

  const isInProgress = callState === "connecting" || callState === "connected";

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
          {/* Avatar */}
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
                  <span>Incoming call</span>
                  <DotDotDot />
                </span>
              )}
              {callState === "connecting" && (
                <span className="flex items-center justify-center gap-1 text-yellow-400">
                  <span>Connecting</span>
                  <DotDotDot />
                </span>
              )}
              {callState === "connected" && (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                  <span>Connected · {formatTime(seconds)}</span>
                </span>
              )}
              {callState === "declined" && (
                <span style={{ color: "#e74c3c" }}>Call Declined</span>
              )}
              {callState === "error" && (
                <span style={{ color: "#e74c3c" }}>Connection Failed</span>
              )}
            </p>
            {micError && (
              <p className="text-xs mt-2 px-2" style={{ color: "#f59e0b" }}>
                {micError}
              </p>
            )}
          </div>

          {/* Controls - incoming call state */}
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

          {/* Controls - connecting/connected state */}
          {isInProgress && (
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
                aria-label={speakerMuted ? "Speaker Off" : "Speaker On"}
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

          {/* Error state retry */}
          {callState === "error" && (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-full text-sm font-semibold text-white"
              style={{ background: "#e74c3c" }}
            >
              Close
            </button>
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
