import { useNavigate } from "@tanstack/react-router";
import { Check, PhoneMissed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  useAcceptCallRequestAsLocal,
  useDenyCallRequestAsLocal,
  useGetCallRequestsAsLocal,
} from "../hooks/useQueries";

export function GlobalCallWatcher() {
  const navigate = useNavigate();
  const { localSession, isLocalLoggedIn } = useLocalAuth();
  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );
  const acceptCall = useAcceptCallRequestAsLocal();
  const denyCall = useDenyCallRequestAsLocal();

  const navigatedCallsRef = useRef<Set<string>>(new Set());
  const [callerName, setCallerName] = useState<string | null>(null);
  const [incomingCallId, setIncomingCallId] = useState<bigint | null>(null);

  useEffect(() => {
    if (!isLocalLoggedIn || !localSession) return;

    for (const req of callRequests) {
      const idKey = req.id.toString();

      // I am the caller and my request was accepted — auto-navigate to call screen
      if (
        req.callerUsername === localSession.username &&
        req.status === "accepted" &&
        !navigatedCallsRef.current.has(idKey)
      ) {
        navigatedCallsRef.current.add(idKey);
        navigate({ to: "/call/$callId", params: { callId: idKey } });
      }
    }

    // Detect incoming pending call
    const incoming = callRequests.find(
      (req) =>
        req.calleeUsername === localSession.username &&
        req.status === "pending",
    );
    if (incoming) {
      setIncomingCallId(incoming.id);
      setCallerName(incoming.callerUsername);
    } else {
      setIncomingCallId(null);
      setCallerName(null);
    }
  }, [callRequests, isLocalLoggedIn, localSession, navigate]);

  const handleAccept = async () => {
    if (!incomingCallId || !localSession) return;
    try {
      await acceptCall.mutateAsync({
        token: localSession.token,
        id: incomingCallId,
      });
      navigate({
        to: "/call/$callId",
        params: { callId: incomingCallId.toString() },
      });
      setIncomingCallId(null);
      setCallerName(null);
    } catch {
      // ignore
    }
  };

  const handleDeny = async () => {
    if (!incomingCallId || !localSession) return;
    try {
      await denyCall.mutateAsync({
        token: localSession.token,
        id: incomingCallId,
      });
      setIncomingCallId(null);
      setCallerName(null);
    } catch {
      // ignore
    }
  };

  if (!incomingCallId || !callerName) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-3 shadow-xl"
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d1054 100%)",
        animation: "incoming-call-blink 1s ease-in-out infinite alternate",
      }}
      data-ocid="incoming_call.panel"
    >
      <div className="flex items-center gap-3">
        {/* Pulsing avatar */}
        <div className="relative">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm"
            style={{ animation: "call-ring-pulse 1s ease-in-out infinite" }}
          >
            {callerName.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-ping" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold">{callerName}</p>
          <p className="text-violet-300 text-[10px]">Incoming call...</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-400 text-white text-xs font-semibold transition-colors"
          data-ocid="incoming_call.confirm_button"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>
        <button
          type="button"
          onClick={handleDeny}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors"
          data-ocid="incoming_call.cancel_button"
        >
          <PhoneMissed className="h-3.5 w-3.5" />
          Deny
        </button>
      </div>
      <style>{`
        @keyframes incoming-call-blink {
          from { opacity: 0.9; box-shadow: 0 0 0 0 rgba(124,58,237,0.6); }
          to { opacity: 1; box-shadow: 0 0 20px 4px rgba(124,58,237,0.5); }
        }
        @keyframes call-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,199,183,0.7); }
          50% { box-shadow: 0 0 0 8px rgba(34,199,183,0); }
        }
      `}</style>
    </div>
  );
}
