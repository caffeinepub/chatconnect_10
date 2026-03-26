import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  useAcceptCallRequestAsLocal,
  useDenyCallRequestAsLocal,
  useGetCallRequestsAsLocal,
} from "../hooks/useQueries";

export function GlobalCallWatcher() {
  const navigate = useNavigate();
  const { localSession, isLocalLoggedIn } = useLocalAuth();
  const acceptCall = useAcceptCallRequestAsLocal();
  const denyCall = useDenyCallRequestAsLocal();
  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );

  const seenIdsRef = useRef<Set<string>>(new Set());
  const navigatedCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isLocalLoggedIn || !localSession) return;

    for (const req of callRequests) {
      const idKey = req.id.toString();

      // Incoming call for me (callee)
      if (
        req.calleeUsername === localSession.username &&
        req.status === "pending" &&
        !seenIdsRef.current.has(idKey)
      ) {
        seenIdsRef.current.add(idKey);
        const callerName = req.callerUsername;
        const reqId = req.id;
        const token = localSession.token;
        toast(`📞 ${callerName} is calling you!`, {
          duration: 30000,
          action: {
            label: "Accept",
            onClick: () => {
              acceptCall.mutate(
                { token, id: reqId },
                {
                  onSuccess: () => {
                    navigate({
                      to: "/call/$callId",
                      params: { callId: idKey },
                    });
                  },
                },
              );
            },
          },
          cancel: {
            label: "Deny",
            onClick: () => {
              denyCall.mutate({ token, id: reqId });
            },
          },
        });
      }

      // I am the caller, my request was accepted -- auto-navigate to call screen
      if (
        req.callerUsername === localSession.username &&
        req.status === "accepted" &&
        !navigatedCallsRef.current.has(idKey)
      ) {
        navigatedCallsRef.current.add(idKey);
        navigate({ to: "/call/$callId", params: { callId: idKey } });
      }
    }
  }, [
    callRequests,
    isLocalLoggedIn,
    localSession,
    acceptCall,
    denyCall,
    navigate,
  ]);

  return null;
}
