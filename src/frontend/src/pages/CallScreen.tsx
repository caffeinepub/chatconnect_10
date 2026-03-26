import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Mic, MicOff, Phone, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtendedBackend,
  LocalUser,
} from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  useEndCallAsLocal,
  useGetCallRequestsAsLocal,
} from "../hooks/useQueries";

const CALL_DURATION = 20 * 60; // 20 minutes in seconds

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
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

const AVATAR_GRADIENTS = [
  "from-purple-500 to-indigo-600",
  "from-teal-400 to-cyan-500",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-purple-500",
];

function getGradient(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };
    playTone(880, ctx.currentTime);
    playTone(1000, ctx.currentTime + 0.5);
  } catch {
    // AudioContext not available
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function OtherUserCard({
  username,
  localUsers,
  timeLeft,
}: { username: string; localUsers: LocalUser[]; timeLeft: number }) {
  const user = localUsers.find((u) => u.username === username);
  const displayName = user?.displayName || username;
  const gradient = getGradient(username);

  const timerColor =
    timeLeft <= 60
      ? "text-red-400 border-red-500/40 bg-red-500/10"
      : timeLeft <= 300
        ? "text-yellow-300 border-yellow-500/40 bg-yellow-500/10"
        : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Avatar with glowing animated ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow rings */}
        <span
          className="absolute w-52 h-52 rounded-full animate-ping"
          style={{
            background:
              "radial-gradient(circle, rgba(94,234,212,0.15) 0%, transparent 70%)",
            animationDuration: "2s",
          }}
        />
        <span
          className="absolute w-48 h-48 rounded-full"
          style={{
            boxShadow:
              "0 0 40px 10px rgba(94,234,212,0.25), 0 0 80px 20px rgba(139,92,246,0.15)",
          }}
        />
        {/* Avatar circle */}
        {user?.photo ? (
          <img
            src={user.photo.getDirectURL()}
            alt={displayName}
            className="w-40 h-40 rounded-full object-cover border-4 shadow-2xl"
            style={{ borderColor: "rgba(94,234,212,0.5)" }}
          />
        ) : (
          <div
            className={`w-40 h-40 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-5xl font-bold shadow-2xl border-4`}
            style={{ borderColor: "rgba(94,234,212,0.5)" }}
          >
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name & username */}
      <div className="text-center">
        <p className="text-white font-bold text-3xl tracking-tight">
          {displayName}
        </p>
        <p className="text-white/50 text-base mt-1">@{username}</p>
      </div>

      {/* Live Call badge */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 text-sm font-semibold tracking-wide">
          Live Call
        </span>
      </div>

      {/* Timer pill */}
      <div
        className={`flex items-center gap-2 px-5 py-2 rounded-full border font-mono font-bold text-2xl tabular-nums transition-colors ${timerColor}`}
      >
        {formatTime(timeLeft)}
      </div>

      {timeLeft <= 60 && (
        <p className="text-red-400 text-sm font-semibold animate-pulse">
          ⚠️ Less than 1 minute remaining
        </p>
      )}
    </div>
  );
}

export default function CallScreen() {
  const navigate = useNavigate();
  const { callId } = useParams({ from: "/call/$callId" });
  const { localSession, isLocalLoggedIn } = useLocalAuth();
  const { actor, isFetching: actorFetching } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [timeLeft, setTimeLeft] = useState(CALL_DURATION);
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callEnded, setCallEnded] = useState(false);
  const beepedRef = useRef(false);
  const callEndedRef = useRef(false);
  const endCallMutation = useEndCallAsLocal();

  // WebRTC refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const webrtcInitialized = useRef(false);

  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );

  const { data: localUsers = [] } = useQuery<LocalUser[]>({
    queryKey: ["localUsers"],
    queryFn: async () => {
      if (!extActor) return [];
      return extActor.getLocalUsers();
    },
    enabled: !!extActor && !actorFetching,
    refetchInterval: 10000,
  });

  const callRequest = callRequests.find((cr) => cr.id.toString() === callId);

  const cleanupWebRTC = useCallback(() => {
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
    pendingIceRef.current = [];
  }, []);

  const handleEndCall = useCallback(
    async (autoEnd = false) => {
      if (callEndedRef.current) return;
      callEndedRef.current = true;
      setCallEnded(true);
      cleanupWebRTC();
      if (localSession && callRequest) {
        try {
          await endCallMutation.mutateAsync({
            token: localSession.token,
            id: callRequest.id,
          });
        } catch {
          // ignore
        }
      }
      if (autoEnd) {
        toast.info("⏱️ Call time limit reached. Call ended.");
      } else {
        toast.info("Call ended");
      }
      setTimeout(() => navigate({ to: "/cards" }), 1200);
    },
    [localSession, callRequest, endCallMutation, navigate, cleanupWebRTC],
  );

  // Auth guard
  useEffect(() => {
    if (!isLocalLoggedIn) {
      navigate({ to: "/login" });
    }
  }, [isLocalLoggedIn, navigate]);

  // If call disappeared (ended by other party), go back
  useEffect(() => {
    if (callRequests.length > 0 && !callRequest && !callEndedRef.current) {
      toast.info("Call ended");
      navigate({ to: "/cards" });
    }
  }, [callRequests, callRequest, navigate]);

  // Timer countdown
  useEffect(() => {
    if (callEnded) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next === 60 && !beepedRef.current) {
          beepedRef.current = true;
          playBeep();
          toast.warning("⏰ 1 minute remaining!");
        }
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [callEnded]);

  // Auto end at 0
  useEffect(() => {
    if (timeLeft === 0 && !callEndedRef.current) {
      handleEndCall(true);
    }
  }, [timeLeft, handleEndCall]);

  // WebRTC setup — runs when callRequest becomes available
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once when callRequest is first available
  useEffect(() => {
    if (!callRequest || !localSession || !extActor || webrtcInitialized.current)
      return;
    webrtcInitialized.current = true;

    const myUsername = localSession.username;
    const token = localSession.token;
    const isCaller = myUsername === callRequest.callerUsername;
    const otherUsername = isCaller
      ? callRequest.calleeUsername
      : callRequest.callerUsername;
    const offerType = `call-${callId}-offer`;
    const answerType = `call-${callId}-answer`;
    const iceType = `call-${callId}-ice`;

    const setupWebRTC = async () => {
      // Get mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch (err) {
        const e = err as DOMException;
        toast.error(
          e.name === "NotAllowedError"
            ? "Microphone access blocked. Please allow mic in browser settings."
            : `Mic error: ${e.message || e.name}`,
        );
        return;
      }

      localStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Add local audio tracks
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      // Remote audio playback
      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          audio.muted = !speakerOn;
          document.body.appendChild(audio);
          remoteAudioRef.current = audio;
        }
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      };

      // Restart ICE on failure
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          pc.restartIce();
        }
      };

      // Send ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await extActor.sendSignal(
              token,
              otherUsername,
              iceType,
              JSON.stringify(event.candidate),
            );
          } catch {
            // ignore
          }
        }
      };

      const flushPendingIce = async () => {
        const candidates = [...pendingIceRef.current];
        pendingIceRef.current = [];
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            // ignore
          }
        }
      };

      if (isCaller) {
        // Caller: create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        try {
          await extActor.sendSignal(
            token,
            otherUsername,
            offerType,
            JSON.stringify(offer),
          );
        } catch {
          toast.error("Failed to send call offer. Check connection.");
        }

        // Poll for answer + ICE
        signalPollRef.current = setInterval(async () => {
          try {
            const signals = await extActor.getMySignals(token);
            for (const s of signals) {
              if (s.fromUsername !== otherUsername) continue;
              if (s.signalType === answerType && !pc.remoteDescription) {
                const answer = JSON.parse(s.data);
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answer),
                );
                await flushPendingIce();
              } else if (s.signalType === iceType) {
                const candidate = JSON.parse(s.data) as RTCIceCandidateInit;
                if (!pc.remoteDescription) {
                  pendingIceRef.current.push(candidate);
                } else {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch {
                    // ignore
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }, 700);
      } else {
        // Callee: poll for offer, then answer
        signalPollRef.current = setInterval(async () => {
          try {
            const signals = await extActor.getMySignals(token);
            for (const s of signals) {
              if (s.fromUsername !== otherUsername) continue;
              if (s.signalType === offerType && !pc.remoteDescription) {
                const offer = JSON.parse(s.data);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                await flushPendingIce();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                try {
                  await extActor.sendSignal(
                    token,
                    otherUsername,
                    answerType,
                    JSON.stringify(answer),
                  );
                } catch {
                  // ignore
                }
              } else if (s.signalType === iceType) {
                const candidate = JSON.parse(s.data) as RTCIceCandidateInit;
                if (!pc.remoteDescription) {
                  pendingIceRef.current.push(candidate);
                } else {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch {
                    // ignore
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }, 700);
      }
    };

    setupWebRTC();

    return () => {
      // Cleanup handled by handleEndCall / unmount effect below
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callRequest?.id, localSession?.token, extActor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, [cleanupWebRTC]);

  // Wire mic toggle to actual audio track
  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) track.enabled = next;
      }
      return next;
    });
  }, []);

  // Wire speaker toggle to remote audio element
  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !next;
      }
      return next;
    });
  }, []);

  const myUsername = localSession?.username ?? "";
  const otherUsername = callRequest
    ? myUsername === callRequest.callerUsername
      ? callRequest.calleeUsername
      : callRequest.callerUsername
    : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        animation: "gradientShift 10s ease infinite alternate",
      }}
      data-ocid="call.panel"
    >
      {/* Animated gradient keyframes */}
      <style>{`
        @keyframes gradientShift {
          0% { background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%); }
          33% { background: linear-gradient(135deg, #0d1b2a 0%, #1b4332 40%, #0f0c29 100%); }
          66% { background: linear-gradient(135deg, #1a0533 0%, #0c1445 50%, #1a2a3a 100%); }
          100% { background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%); }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.08); }
        }
      `}</style>

      {/* Background decorative blobs */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(94,234,212,0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Top: connected status */}
      <div className="w-full flex justify-center pt-8 z-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/70 text-sm font-medium">Connected</span>
        </div>
      </div>

      {/* Center: other user's profile card */}
      <div className="flex flex-col items-center justify-center flex-1 z-10 py-8">
        {callRequest && otherUsername ? (
          <OtherUserCard
            username={otherUsername}
            localUsers={localUsers}
            timeLeft={timeLeft}
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-full bg-white/10 animate-pulse" />
            <div className="text-white/40 text-lg">Connecting...</div>
          </div>
        )}
      </div>

      {/* Bottom: Controls — glassmorphism pill */}
      <div className="z-10 pb-10">
        <div
          className="flex items-end gap-6 px-8 py-5 rounded-full border border-white/10"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          data-ocid="call.card"
        >
          {/* Mic */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                micOn
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  : "bg-red-500/80 hover:bg-red-600 text-white border border-red-400/40"
              }`}
              data-ocid="call.toggle"
            >
              {micOn ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </button>
            <span className="text-white/40 text-xs">
              {micOn ? "Mute" : "Unmute"}
            </span>
          </div>

          {/* End Call */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleEndCall()}
              disabled={callEnded || endCallMutation.isPending}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white flex items-center justify-center shadow-2xl transition-all border-4 border-red-400/30"
              style={{ boxShadow: "0 0 30px rgba(239,68,68,0.4)" }}
              data-ocid="call.delete_button"
            >
              <Phone className="h-7 w-7 rotate-[135deg]" />
            </button>
            <span className="text-white/40 text-xs">End</span>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleSpeaker}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                speakerOn
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  : "bg-red-500/80 hover:bg-red-600 text-white border border-red-400/40"
              }`}
              data-ocid="call.toggle"
            >
              {speakerOn ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
            <span className="text-white/40 text-xs">
              {speakerOn ? "Speaker" : "Muted"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
