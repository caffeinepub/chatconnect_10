import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { backendInterface as ExtendedBackend } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useLocalAuth } from "../hooks/useLocalAuth";

export function MessagesButton() {
  const { isLocalLoggedIn, localSession } = useLocalAuth();
  const { actor } = useActor();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const extActor = actor as unknown as ExtendedBackend | null;

  const fetchUnread = useCallback(async () => {
    if (!isLocalLoggedIn || !localSession || !extActor) return;
    try {
      const count = await extActor.getUnreadDMCount(localSession.token);
      setUnreadCount(Number(count));
    } catch {
      // silently ignore
    }
  }, [isLocalLoggedIn, localSession, extActor]);

  useEffect(() => {
    if (!isLocalLoggedIn) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 5_000);
    return () => clearInterval(interval);
  }, [isLocalLoggedIn, fetchUnread]);

  if (!isLocalLoggedIn) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`rounded-full relative gap-2 ${
        unreadCount > 0 ? "animate-pulse text-primary" : ""
      }`}
      onClick={() => navigate({ to: "/messages" })}
      data-ocid="nav.messages_button"
    >
      <Mail className="h-4 w-4" />
      <span className="hidden md:block">Messages</span>
      {unreadCount > 0 && (
        <Badge
          className="absolute -top-1 -right-1 h-4 w-4 min-w-0 p-0 flex items-center justify-center text-[10px] bg-primary text-white border-0"
          data-ocid="nav.messages_badge"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
