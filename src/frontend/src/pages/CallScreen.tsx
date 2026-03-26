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

function UserCard({
  username,
  localUsers,
}: { username: string; localUsers: LocalUser[] }) {
  const user = localUsers.find((u) => u.username === username);
  const displayName = user?.displayName || username;
  const gradient = getGradient(username);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {user?.photo ? (
          <img
            src={user.photo.getDirectURL()}
            alt={displayName}
            className="w-32 h-32 rounded-full object-cover border-4 border-white/20 shadow-2xl"
          />
        ) : (
          <div
            className={`w-32 h-32 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-4xl font-bold shadow-2xl border-4 border-white/10`}
          >
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-400 rounded-full border-2 border-white/20" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl">{displayName}</p>
        <p className="text-white/50 text-sm">@{username}</p>
      </div>
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

  const urgentColor =
    timeLeft <= 60
      ? "text-red-400"
      : timeLeft <= 300
        ? "text-yellow-300"
        : "text-white";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.15 0.03 260) 0%, oklch(0.10 0.02 280) 50%, oklch(0.08 0.04 300) 100%)",
      }}
      data-ocid="call.panel"
    >
      {/* Top: Timer */}
      <div className="flex flex-col items-center gap-2 pt-8">
        <p className="text-white/50 text-sm uppercase tracking-widest font-semibold">
          Call in progress
        </p>
        <div
          className={`font-mono font-bold text-7xl tabular-nums ${urgentColor} transition-colors`}
          data-ocid="call.section"
        >
          {formatTime(timeLeft)}
        </div>
        {timeLeft <= 60 && (
          <p className="text-red-400 text-sm font-semibold animate-pulse">
            ⚠️ Less than 1 minute remaining
          </p>
        )}
      </div>

      {/* Middle: User cards */}
      <div className="flex items-center justify-center gap-12 md:gap-24 my-8">
        {callRequest ? (
          <>
            <UserCard
              username={callRequest.callerUsername}
              localUsers={localUsers}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <Phone className="h-6 w-6 text-green-400" />
              </div>
              <span className="text-white/40 text-xs">Connected</span>
            </div>
            <UserCard
              username={callRequest.calleeUsername}
              localUsers={localUsers}
            />
          </>
        ) : (
          <div className="text-white/40 text-lg">Loading call info...</div>
        )}
      </div>

      {/* Bottom: Controls */}
      <div className="flex items-center gap-5 pb-8" data-ocid="call.card">
        <button
          type="button"
          onClick={handleToggleMic}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            micOn
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              : "bg-red-500/80 hover:bg-red-600 text-white border border-red-400/40"
          }`}
          data-ocid="call.toggle"
        >
          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>

        <button
          type="button"
          onClick={() => handleEndCall()}
          disabled={callEnded || endCallMutation.isPending}
          className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white flex items-center justify-center shadow-2xl transition-all scale-110 border-4 border-red-400/30"
          data-ocid="call.delete_button"
        >
          <Phone className="h-7 w-7 rotate-[135deg]" />
        </button>

        <button
          type="button"
          onClick={handleToggleSpeaker}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
            speakerOn
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              : "bg-red-500/80 hover:bg-red-600 text-white border border-red-400/40"
          }`}
          data-ocid="call.toggle"
        >
          {speakerOn ? (
            <Volume2 className="h-6 w-6" />
          ) : (
            <VolumeX className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}
