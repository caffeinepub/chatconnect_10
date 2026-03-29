import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useLocalAuth } from "../hooks/useLocalAuth";
import { useGetCallRequestsAsLocal } from "../hooks/useQueries";

export function GlobalCallWatcher() {
  const navigate = useNavigate();
  const { localSession, isLocalLoggedIn } = useLocalAuth();
  const { data: callRequests = [] } = useGetCallRequestsAsLocal(
    localSession?.token,
  );

  const navigatedCallsRef = useRef<Set<string>>(new Set());

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
  }, [callRequests, isLocalLoggedIn, localSession, navigate]);

  return null;
}
