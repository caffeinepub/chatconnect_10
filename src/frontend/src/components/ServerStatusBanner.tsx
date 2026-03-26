import { useEffect, useRef, useState } from "react";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";

/**
 * Periodically pings the backend. When it goes offline, shows a yellow
 * "Reconnecting..." banner. When it comes back, shows a green "Back online"
 * toast for 3s then hides. Uses exponential backoff so we don't spam the
 * canister while it's restarting.
 */
export function ServerStatusBanner() {
  const { actor } = useActor();
  const extActor = actor as unknown as ExtendedBackend | null;

  const [status, setStatus] = useState<"online" | "offline" | "reconnecting">(
    "online",
  );
  const [showOnline, setShowOnline] = useState(false);
  const retryDelayRef = useRef(10000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const extActorRef = useRef(extActor);
  extActorRef.current = extActor;

  useEffect(() => {
    if (!extActor) return;

    const ping = async () => {
      if (!extActorRef.current) return;
      try {
        await extActorRef.current.getLocalUsers();
        consecutiveFailuresRef.current = 0;
        retryDelayRef.current = 10000;

        setStatus((prev) => {
          if (prev === "offline" || prev === "reconnecting") {
            setShowOnline(true);
            setTimeout(() => setShowOnline(false), 3000);
          }
          return "online";
        });
      } catch {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) {
          setStatus("offline");
        } else {
          setStatus("reconnecting");
        }
        retryDelayRef.current = Math.min(retryDelayRef.current * 1.5, 30000);
      } finally {
        timerRef.current = setTimeout(ping, retryDelayRef.current);
      }
    };

    timerRef.current = setTimeout(ping, 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [extActor]);

  if (showOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white"
        style={{ background: "#16a34a" }}
      >
        <span className="w-2 h-2 rounded-full bg-white inline-block" />
        Server back online
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white"
        style={{ background: "#b45309" }}
      >
        <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block" />
        Server offline — reconnecting automatically...
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white"
        style={{ background: "#92400e" }}
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
        Checking server...
      </div>
    );
  }

  return null;
}
